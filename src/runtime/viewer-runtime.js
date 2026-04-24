/**
 * @file viewer-runtime.js
 * @description Internal viewer runtime for rendering spectral cubes using WebGPU and WebAssembly.
 * @author yongyinli
 * @version 1.0.6 - Implemented 'Time to Initial View' metric and modularized performance tracking.
 *
 * @class ViewerRuntime
 * @classdesc Internal runtime class that controls cube rendering and orchestration.
 */

import { createEnviFormatAdapter } from '../formats/envi-format-adapter.js';
import { AutoRenderer } from '../rendering/auto-renderer.js';
import {
    pixelToWorld as mapPixelToWorld,
    worldToPixel as mapWorldToPixel,
} from '../spatial/coordinate-mapper.js';
import { RequestTracker } from './request-tracker.js';
import { RenderSession } from './render-session.js';
import { ViewerRuntimeLifecycleController } from './runtime-lifecycle-controller.js';
import { ViewerRuntimePolicy } from './runtime-policy.js';
import { ViewerRuntimeTransitionController } from './runtime-transition-controller.js';
import { ViewerRuntimeViewController } from './runtime-view-controller.js';
import {
    planStatsCompletionReaction,
    planTileCompletionReaction,
    planTileErrorReaction,
} from './runtime-reaction-plan.js';
import { ViewerRuntimeWorkExecutor } from './runtime-work-executor.js';
import {
    buildSpectrumWorkerRequest,
    buildWorkerCancelRequest,
} from './worker-dispatch-policy.js';
import {
    classifyWorkerRuntimeMessage,
    normalizeWorkerRuntimeMessage,
} from './worker-message-router.js';
import { WorkScheduler } from './work-scheduler.js';
import { ViewerWorkerPool } from './worker-pool.js';
import {
    DEFAULT_METADATA_CACHE_POLICY,
    DEFAULT_STATS_CACHE_POLICY,
    SourceMapCache,
    SourceValueCache,
} from './source-cache.js';
import {
    DEFAULT_RGB_BANDS,
    normalizeViewerBands,
    selectDefaultBandsForHeader,
    uniqueBands,
} from './band-selection.js';
import { createEnviLoadSource } from '../sources/load-source.js';
import { serializeDataSource } from '../sources/data-source.js';
import { CubeStore } from '../store/cube-store.js';

// A simple, self-contained event emitter class to handle decoupling.
class EventEmitter {
    constructor() { this.events = {}; }
    on(eventName, listener) { if (!this.events[eventName]) { this.events[eventName] = []; } this.events[eventName].push(listener); }
    emit(eventName, ...args) { if (this.events[eventName]) { this.events[eventName].forEach(listener => listener(...args)); } }
    off(eventName, listenerToRemove) { if (!this.events[eventName]) return; this.events[eventName] = this.events[eventName].filter(listener => listener !== listenerToRemove); }
}

export class ViewerRuntime extends EventEmitter {
    // --- Private Class Fields ---

    // Core state
    #wasmModule = null; 
    #header = null;
    #hdrBytes = null;
    #dataSourceDescriptor = null;
    #cubeStore = null;
    #formatAdapter = null;
    #runtimePolicy = new ViewerRuntimePolicy();

    // Rendering & Tile state
    #renderer = null;
    #renderSession = new RenderSession();
    #globalStats = null;
    #currentBands = DEFAULT_RGB_BANDS;
    #metadataCache = new SourceValueCache(DEFAULT_METADATA_CACHE_POLICY);
    #statsCache = new SourceMapCache(DEFAULT_STATS_CACHE_POLICY);
    #lifecycle;
    #transitionController;
    #viewController;

    // Worker state
    #MAX_WORKERS;
    #workerPool = new ViewerWorkerPool();
    #workScheduler = new WorkScheduler();
    #workExecutor;
    #pendingSpectrumResolvers = new Map();
    #requestTracker = new RequestTracker();
    #activeSourceId = 0;
    #rendererPreference;
    #pendingRendererRecoveryDisabledKinds = null;
    
    // Core components & configuration
    #canvas;
    #wasmPaths;
    #config;
    #resizeObserver;
    #onCanvasReplaced = null;

    // Interaction state
    #isDragging = false;
    #lastMousePos = { x: 0, y: 0 };

    constructor(canvas, options = {}) {
        super();
        this.#canvas = canvas;
        this.#wasmPaths = {
            wasmJsPath: options.wasmJsPath || './pkg/envi_parser.js',
            wasmWasmPath: options.wasmWasmPath || './pkg/envi_parser_bg.wasm',
            workerPath: options.workerPath || 'worker.js'
        };
        this.#config = {
            backgroundStats: options.enableBackgroundStats ?? true,
            tilePreloading: options.enableTilePreloading ?? true
        };
        this.#rendererPreference = options.rendererPreference ?? 'auto';
        this.#onCanvasReplaced = options.onCanvasReplaced ?? null;
        this.#formatAdapter = createEnviFormatAdapter({
            getWasmModule: async () => this.#wasmModule
                ?? await import(/* @vite-ignore */ this.#wasmPaths.wasmJsPath),
        });
        this.#renderer = this.#createRenderer();
        this.#workExecutor = new ViewerRuntimeWorkExecutor({
            scheduler: this.#workScheduler,
            emitLog: (message) => this.emit('log', message),
            emitError: (message) => this.emit('error', message),
            emitProgress: (payload) => this.emit('progress', payload),
            postTrackedWorkerRequest: (worker, request) => this.#postTrackedWorkerRequest(worker, request),
            debugLog: (...args) => console.log(...args),
        });
        this.#lifecycle = new ViewerRuntimeLifecycleController({
            emitLog: (message) => this.emit('log', message),
            emitError: (message) => this.emit('error', message),
            requestAnimationFrameImpl: (callback) => requestAnimationFrame(callback),
        });
        this.#transitionController = new ViewerRuntimeTransitionController({
            emitStateChange: (payload) => this.emit('statechange', payload),
            requestAnimationFrameImpl: (callback) => requestAnimationFrame(callback),
            setTimeoutImpl: (callback, delay) => setTimeout(callback, delay),
            postTrackedWorkerRequest: (worker, request) => this.#postTrackedWorkerRequest(worker, request),
            debugLog: (...args) => console.log(...args),
        });
        this.#viewController = new ViewerRuntimeViewController({
            emitLog: (message) => this.emit('log', message),
            requestAnimationFrameImpl: (callback) => requestAnimationFrame(callback),
            setTimeoutImpl: (callback, delay) => setTimeout(callback, delay),
            getDevicePixelRatio: () => window.devicePixelRatio || 1,
        });
        function getAdaptiveMaxWorkers(options = {}) {
            const defaultConcurrency = 4; 
            const hardwareConcurrency = navigator.hardwareConcurrency || defaultConcurrency;
            let workers;
            if (hardwareConcurrency <= 2) { workers = 1; }
            else if (hardwareConcurrency <= 4) { workers = Math.floor(hardwareConcurrency / 2); }
            else if (hardwareConcurrency <= 8) { workers = Math.floor(hardwareConcurrency / 3); }
            else { workers = Math.min(Math.floor(hardwareConcurrency / 2), hardwareConcurrency - 2); }
            if (workers < 1) workers = 1;
            if (options.maxWorkers && Number.isInteger(options.maxWorkers) && options.maxWorkers > 0) { workers = options.maxWorkers; }
            return workers;
        }
        this.#MAX_WORKERS = getAdaptiveMaxWorkers(options);
        
        
    }
    getHeader() {
        return this.#cubeStore?.getHeader() ?? this.#header;
    }

    getDataSourceDescriptor() {
        return this.#cubeStore?.getDataSourceDescriptor() ?? this.#dataSourceDescriptor;
    }

    getHdrBytes() {
        return this.#cubeStore?.getHeaderBytes() ?? this.#hdrBytes;
    }

    unload() {
        this.emit('log', '卸载当前数据源...');
        const sourceIdToCancel = this.#cubeStore?.getSourceId() ?? this.#activeSourceId;
        this.#activeSourceId += 1;
        this.#resetSourceState({
            canceledSourceId: sourceIdToCancel,
            cancelReason: 'viewer-unload',
        });
        this.#clearCanvas();
        this.emit('statechange', { loading: false });
    }

    async getSpectralProfile(x, y) {
        const header = this.getHeader();
        const dataSource = this.getDataSourceDescriptor();
        const hdrBytes = this.getHdrBytes();
        if (!header || !dataSource || !hdrBytes) return null;
        const sourceId = this.#cubeStore?.getSourceId() ?? this.#activeSourceId;
        const spectrumRequest = buildSpectrumWorkerRequest({
            sourceId,
            hdrBytes,
            dataSource,
            x,
            y,
            header,
        });
        const requestId = spectrumRequest.requestId;
        return new Promise((resolve, reject) => {
            this.#pendingSpectrumResolvers.set(requestId, { resolve, reject, sourceId });
            this.#requestTracker.track(sourceId, requestId);
            const dispatch = () => {
                if (!this.#pendingSpectrumResolvers.has(requestId) || !this.#requestTracker.has(sourceId, requestId)) {
                    return;
                }
                if (this.#workScheduler.hasIdleWorker()) {
                    const worker = this.#workScheduler.takeIdleWorker();
                    worker.postMessage(spectrumRequest.envelope);
                } else {
                    setTimeout(dispatch, 200);
                }
            };
            dispatch();
        });
    }

    pixelToWorld(x, y) {
        return this.#cubeStore?.pixelToWorld(x, y)
            ?? mapPixelToWorld(this.getHeader(), x, y);
    }

    worldToPixel(x, y) {
        return this.#cubeStore?.worldToPixel(x, y)
            ?? mapWorldToPixel(this.getHeader(), x, y);
    }
    // --- Public API ---

    async init() {
        this.emit('log', 'Library initialization started...');
        try {
            const wasmModule = await import(/* @vite-ignore */ this.#wasmPaths.wasmJsPath);
            this.#wasmModule = wasmModule;
            const wasmPath = new URL(this.#wasmPaths.wasmWasmPath, import.meta.url).href;
            this.emit('log', wasmPath);
            await wasmModule.default({ module_or_path: wasmPath });
            wasmModule.set_logging_enabled(false);
            this.emit('log', 'Main thread WASM initialization completed.');
            this.#resizeCanvas();
            await this.#renderer.init();
            {
                const initReport = this.#renderer.getLastInitReport?.() ?? null;
                const rendererKind = initReport?.selectedKind ?? this.#renderer.getKind?.() ?? 'unknown';
                const fallbackMode = initReport?.usedFallback ? ', fallback mode' : '';
                this.emit('log', `Renderer initialization completed (${rendererKind}${fallbackMode}).`);
            }
            await this.#initWorkers();
            this.#attachEventListeners();
            this.emit('ready');
            this.emit('log', 'Library initialization completed and ready.');
        } catch (error) {
            const errorMessage = `Initialization failed: ${error.message}`;
            this.emit('error', errorMessage);
            console.error(error);
            throw error;
        }
    }
    /**
     * 创建一个新的 EnviReader 实例供外部模块使用
     * @returns {EnviReader | null}
     */
    createReader() {
        const hdrBytes = this.getHdrBytes();
        if (!this.#wasmModule || !hdrBytes) {
            this.emit('error', 'WASM 模块或 HDR 数据未准备好，无法创建 Reader。');
            return null;
        }
        return new this.#wasmModule.EnviReader(hdrBytes);
    }
    async load(source, legacyDataFile) {
        let loadSource;
        try {
            loadSource = createEnviLoadSource(source, legacyDataFile);
        } catch (error) {
            this.emit('error', error.message);
            throw error;
        }

        const { headerSource, dataSource } = loadSource;
        const sourceIdToCancel = this.#cubeStore?.getSourceId() ?? this.#activeSourceId;
        this.#activeSourceId += 1;
        this.#resetSourceState({
            canceledSourceId: sourceIdToCancel,
            cancelReason: 'source-switch',
        });
        this.emit('loadstart');
        this.emit('log', `开始加载: ${headerSource.name}, ${dataSource.name}`);
        this.#runtimePolicy.beginLoad();
        try {
            this.#hdrBytes = new Uint8Array(await headerSource.readAll());
            this.#header = await this.#formatAdapter.parseHeader({
                headerSource,
                headerBytes: this.#hdrBytes,
            });
            this.emit('headerloaded', this.#header);
            this.emit('log', `HDR 解析成功。 格式(Interleave): ${this.#header.interleave}`);
            const defaultBands = selectDefaultBandsForHeader(this.#header);
            const defaultBandsChanged = (
                defaultBands.r !== this.#currentBands.r
                || defaultBands.g !== this.#currentBands.g
                || defaultBands.b !== this.#currentBands.b
            );
            this.#currentBands = defaultBands;
            if (defaultBandsChanged) {
                this.emit('bandschanged', this.#currentBands);
            }
            this.emit('log', `默认显示波段: R:${this.#currentBands.r}, G:${this.#currentBands.g}, B:${this.#currentBands.b}。`);

            const metadataSummary = await this.#lifecycle.createMetadataSummary({
                dataSource,
                header: this.#header,
            });
            this.#metadataCache.set(this.#activeSourceId, metadataSummary);
            this.emit('metadata', metadataSummary);

            this.#resizeCanvas();
            this.#dataSourceDescriptor = serializeDataSource(dataSource);
            this.#cubeStore = new CubeStore({
                sourceId: this.#activeSourceId,
                header: this.#header,
                headerBytes: this.#hdrBytes,
                headerSource,
                dataSource,
                dataSourceDescriptor: this.#dataSourceDescriptor,
            });
            this.emit('log', "正在为初始视图计算统计值...");
            this.emit('statechange', { loading: true, message: '计算统计值...' });
            const initialBands = uniqueBands([this.#currentBands.r, this.#currentBands.g, this.#currentBands.b])
                .filter(b => !this.#hasBandStats(b));
            const dispatchResult = this.#dispatchStatsCalculation(initialBands, true);
            if (dispatchResult.errored) {
                throw new Error('Initial statistics task could not be dispatched.');
            }
        } catch (err) {
            this.emit('error', `文件加载或解析失败: ${err.message}`);
            this.emit('loadend');
            this.emit('statechange', { loading: false });
            this.#resetSourceState({
                canceledSourceId: this.#activeSourceId,
                cancelReason: 'load-failed',
            });
            throw err;
        }
    }

    #hasBandStats(band) {
        return this.#statsCache.has(this.#activeSourceId, band);
    }

    #getBandStats(band) {
        return this.#statsCache.get(this.#activeSourceId, band);
    }

    #setBandStats(band, stats) {
        this.#statsCache.set(this.#activeSourceId, band, stats);
    }

    setBands(bands) {
        if (this.#renderSession.isTransitioning() || !this.#header) return;
        let requestedBands;
        try {
            requestedBands = normalizeViewerBands(bands, this.#header);
        } catch (error) {
            this.emit('error', error.message);
            throw error;
        }
        const transitionPlan = this.#transitionController.planBandSelectionChange({
            currentBands: this.#currentBands,
            requestedBands,
            resolveBandStatsPlan: ({ bands }) => this.#runtimePolicy.resolveBandStatsPlan({
                bands: uniqueBands(bands),
                hasBandStats: (band) => this.#hasBandStats(band),
                getBandStats: (band) => this.#getBandStats(band),
            }),
        });
        if (!transitionPlan.changed) return;
        this.#currentBands = transitionPlan.nextBands;
        this.emit('bandschanged', this.#currentBands);
        this.#runtimePolicy.beginBandSwitch();
        console.log('[PERF-LOG] 计时器启动: Band Switch Time');
        this.emit('log', `波段组合已更改为 R:${requestedBands.r}, G:${requestedBands.g}, B:${requestedBands.b}。`);
        const plan = transitionPlan.plan;
        if (plan.ready) {
            this.emit('log', "从缓存加载统计值，开始平滑过渡...");
            this.#globalStats = plan.globalStats;
            this.#startTransition();
        } else {
            this.emit('log', `缓存缺失，正在为波段 ${plan.missingBands.join(',')} 计算统计值...`);
            this.emit('statechange', { loading: true, message: '计算统计值...' });
            this.#workScheduler.startWaitingForStats();
            this.#dispatchStatsCalculation(plan.missingBands, false);
        }
    }

    destroy() {
        this.emit('log', '销毁 viewer runtime 实例...');
        const sourceIdToCancel = this.#cubeStore?.getSourceId() ?? this.#activeSourceId;
        this.#activeSourceId += 1;
        this.#resetSourceState({
            canceledSourceId: sourceIdToCancel,
            cancelReason: 'viewer-destroy',
        });
        this.#detachEventListeners();
        this.#workerPool.terminateAll();
        this.#workScheduler.resetWorkers();
        this.#renderer?.destroy();
        this.#renderer = null;
        this.emit('destroyed');
        this.events = {};
    }

    updateConfig(newConfig = {}) {
        const oldConfig = { ...this.#config };
        this.#config = { ...this.#config, ...newConfig };
        this.emit('log', `配置已更新: ${JSON.stringify(this.#config)}`);
        if (this.#config.backgroundStats && !oldConfig.backgroundStats) {
            this.emit('log', '后台统计已在运行时开启，尝试启动...');
            if (this.#header) { this.#startBackgroundStatCalculation(); }
        }
        if (this.#config.tilePreloading && !oldConfig.tilePreloading) {
            this.emit('log', '瓦片预加载已在运行时开启，尝试启动...');
            if (this.#header) { this.#startPreloading(); }
        }
    }

    // 在 viewer runtime 中添加这个新方法
    #handleCanvasClick = (e) => {
        // 如果头文件还没加载，无法进行任何计算
        if (!this.#header) return;

        // 1. 获取鼠标点击位置相对于 <canvas> 元素的坐标
        const rect = this.#canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const pixel = this.#renderSession.canvasPointToPixel({
            canvasX,
            canvasY,
            canvasWidth: this.#canvas.clientWidth,
            canvasHeight: this.#canvas.clientHeight,
            header: this.#header,
        });

        if (pixel) {
            this.emit('log', `图像被点击，像素坐标: (${pixel.x}, ${pixel.y})`);
            this.emit('image-clicked', pixel);
        }
    }
    // --- Private Methods ---
    
    #attachEventListeners = () => {
        this.#canvas.addEventListener('mousedown', this.#handleMouseDown);
        this.#canvas.addEventListener('mouseup', this.#handleMouseUp);
        this.#canvas.addEventListener('mouseleave', this.#handleMouseLeave);
        this.#canvas.addEventListener('mousemove', this.#handleMouseMove);
        this.#canvas.addEventListener('wheel', this.#handleWheel, { passive: false });
        this.#canvas.addEventListener('click', this.#handleCanvasClick);
        this.#canvas.style.cursor = 'grab';
        this.#resizeObserver = new ResizeObserver(this.#handleResize);
        this.#resizeObserver.observe(this.#canvas.parentElement);
    }
    
    #detachEventListeners = () => {
        this.#canvas.removeEventListener('mousedown', this.#handleMouseDown);
        this.#canvas.removeEventListener('mouseup', this.#handleMouseUp);
        this.#canvas.removeEventListener('mouseleave', this.#handleMouseLeave);
        this.#canvas.removeEventListener('mousemove', this.#handleMouseMove);
        this.#canvas.removeEventListener('wheel', this.#handleWheel);
        this.#canvas.removeEventListener('click', this.#handleCanvasClick); 
        if (this.#resizeObserver) {
            this.#resizeObserver.disconnect();
            this.#resizeObserver = null;
        }
    }

    #handleResize = () => {
        if (this.#resizeCanvas()) {
            this.#updateAndDraw();
        }
    }

    #handleMouseDown = (e) => {
        this.#isDragging = true;
        this.#lastMousePos = { x: e.clientX, y: e.clientY };
        this.#canvas.style.cursor = 'grabbing';
    }

    #handleMouseUp = () => {
        this.#isDragging = false;
        this.#canvas.style.cursor = 'grab';
    }

    #handleMouseLeave = () => {
        this.#isDragging = false;
        this.#canvas.style.cursor = 'grab';
    }

    #handleMouseMove = (e) => {
        if (!this.#isDragging || !this.#header || this.#renderSession.getScale() <= 1.0) return;
        const dx = (e.clientX - this.#lastMousePos.x) * 2 / this.#canvas.clientWidth;
        const dy = (e.clientY - this.#lastMousePos.y) * 2 / this.#canvas.clientHeight;
        this.#renderSession.panBy({
            dx,
            dy,
            aspect: this.#getAspectRatioCorrection(),
        });
        this.#lastMousePos = { x: e.clientX, y: e.clientY };
        requestAnimationFrame(() => this.#updateAndDraw());
    }

    #handleWheel = (e) => {
        e.preventDefault();
        if (!this.#header) return;
        const rect = this.#canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / rect.width * 2 - 1;
        const mouseY = (e.clientY - rect.top) / rect.height * -2 + 1;
        const zoomFactor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        this.#renderSession.zoomAround({
            zoomFactor,
            anchorX: mouseX,
            anchorY: mouseY,
        });
        requestAnimationFrame(() => this.#updateAndDraw());
    }
    
    async #initWorkers() {
        try {
            const absoluteWasmJsPath = new URL(this.#wasmPaths.wasmJsPath, import.meta.url).href;
            const absoluteWasmWasmPath = new URL(this.#wasmPaths.wasmWasmPath, import.meta.url).href;
            await this.#workerPool.init({
                count: this.#MAX_WORKERS,
                workerUrl: this.#wasmPaths.workerPath,
                wasmJsPath: absoluteWasmJsPath,
                wasmWasmPath: absoluteWasmWasmPath,
                onWorkerReady: (worker) => {
                    this.#workScheduler.registerIdleWorker(worker);
                },
                onRuntimeMessage: (event) => {
                    this.#handleWorkerMessage(event);
                },
                onWorkerFatalError: (error) => {
                    this.emit('log', `A worker encountered a fatal error: ${error.message}`);
                },
            });
            this.emit('log', `${this.#workScheduler.getIdleWorkerCount()} workers initialized and ready.`);
        } catch (error) {
            this.emit('error', "Worker pool initialization failed.");
            console.error("Worker pool init failed:", error);
            throw error;
        }
    }

    #handleWorkerMessage(e) {
        const message = normalizeWorkerRuntimeMessage(e);
        if (message.requestId) {
            this.#requestTracker.release(message.sourceId, message.requestId);
        }
        const route = classifyWorkerRuntimeMessage(message, {
            activeSourceId: this.#activeSourceId,
            currentBands: this.#currentBands,
        });
        const { worker, requestId, payload } = message;

        switch (route.kind) {
        case 'stale-source':
            this.#registerIdleWorkerAndDrain(worker, {
                tiles: true,
                stats: true,
                preload: true,
            });
            return;
        case 'canceled': {
            const resolver = requestId ? this.#pendingSpectrumResolvers.get(requestId) : null;
            if (resolver) {
                resolver.reject(new Error('Worker request canceled.'));
                this.#pendingSpectrumResolvers.delete(requestId);
            }
            this.#registerIdleWorkerAndDrain(worker, {
                tiles: true,
                stats: true,
                preload: true,
            });
            return;
        }
        case 'stats-complete':
            {
                const reaction = planStatsCompletionReaction({
                    route,
                    currentBands: this.#currentBands,
                    hasBandStats: (band) => Boolean(route.stats?.[band]) || this.#hasBandStats(band),
                    getBandStats: (band) => route.stats?.[band] ?? this.#getBandStats(band),
                    isTransitioning: this.#renderSession.isTransitioning(),
                    isWaitingForStats: this.#workScheduler.isWaitingForStats(),
                    resolveBandStatsPlan: (input) => this.#runtimePolicy.resolveBandStatsPlan(input),
                });
                for (const entry of reaction.statsToCache) {
                    this.#setBandStats(entry.band, entry.stats);
                }
                this.#registerIdleWorkerAndDrain(worker, reaction.drain);
                if (reaction.nextGlobalStats) {
                    this.#globalStats = reaction.nextGlobalStats;
                }
                if (reaction.logMessage) {
                    this.emit('log', reaction.logMessage);
                }
                if (reaction.shouldStopWaitingForStats) {
                    this.#workScheduler.stopWaitingForStats();
                }
                if (reaction.shouldSetInitialView) {
                    this.#setInitialViewAndDraw();
                }
                if (reaction.shouldEmitLoadEnd) {
                    this.emit('loadend');
                }
                if (reaction.nextStateChange) {
                    this.emit('statechange', reaction.nextStateChange);
                }
                if (reaction.shouldStartBackgroundStats) {
                    this.#startBackgroundStatCalculation();
                }
                if (reaction.shouldStartTransition) {
                    this.#startTransition();
                }
                if (reaction.shouldProcessBackgroundStatsQueue) {
                    this.#processBackgroundStatsQueue();
                }
            }
            return;
        case 'tile-complete-malformed':
            this.emit('log', `[ERROR] Received malformed tile payload; discarded. Payload: ${route.detail}`);
            this.#registerIdleWorkerAndDrain(worker, {
                tiles: true,
                preload: true,
            });
            return;
        case 'tile-complete-stale-bands':
            this.emit('log', `Discarded stale tile (requested bands: ${route.requestedBandsText}, current bands: ${this.#currentBands.r},${this.#currentBands.g},${this.#currentBands.b})`);
            this.#registerIdleWorkerAndDrain(worker, {
                tiles: true,
                preload: true,
            });
            return;
        case 'tile-complete': {
            const tileKey = route.tileKey;
            const slot = this.#renderSession.getCurrentRenderSlot();
            const stored = this.#renderer.storeTile({
                sourceId: this.#activeSourceId,
                slot,
                header: this.#header,
                tilePayload: payload,
            });
            const isTransitioning = this.#renderSession.isTransitioning();
            let completionMetric = null;
            let transitionTilesRemaining = null;
            if (stored) {
                this.#renderSession.markCurrentTileLoaded(tileKey);
                if (isTransitioning) {
                    transitionTilesRemaining = this.#renderSession.consumeTransitionTile();
                    if (transitionTilesRemaining === 0) {
                        completionMetric = this.#runtimePolicy.completeBandSwitchMetric();
                    }
                } else {
                    completionMetric = this.#runtimePolicy.recordCompletedInitialTile(tileKey);
                }
            }
            const reaction = planTileCompletionReaction({
                stored,
                isTransitioning,
                transitionTilesRemaining,
                initialViewMetric: completionMetric,
            });
            if (reaction.shouldRemoveCurrentTile) {
                this.#renderSession.removeCurrentTile(tileKey);
            }
            if (reaction.performanceMetric) {
                if (reaction.performanceMetric.name === 'bandSwitchTime') {
                    console.log(`%c[PERF-LOG] Band switch completed! Time: ${reaction.performanceMetric.value.toFixed(0)} ms`, 'color: green; font-weight: bold;');
                } else if (reaction.performanceMetric.name === 'timeToInitialView') {
                    console.log(`%c[PERF-LOG] All initial tiles loaded. Emitting 'performance' event.`, 'color: green; font-weight: bold;');
                    console.log(`%c[PERF-LOG] Time to Initial View: ${reaction.performanceMetric.value.toFixed(0)} ms`, 'color: green; font-weight: bold;');
                }
                this.emit('performance', reaction.performanceMetric);
            }
            if (reaction.shouldFinalizeTransitionFrame) {
                this.#finalizeTransitionFrame();
            }
            if (reaction.shouldRequestAnimationFrameDraw) {
                requestAnimationFrame(() => this.#updateAndDraw());
            }
            this.#registerIdleWorkerAndDrain(worker, reaction.drain);
            return;
        }
        case 'spectrum-complete': {
            const resolver = this.#pendingSpectrumResolvers.get(requestId);
            if (resolver) {
                resolver.resolve(new Float32Array(route.spectrum ?? []));
                this.#pendingSpectrumResolvers.delete(requestId);
            }
            this.#registerIdleWorkerAndDrain(worker);
            return;
        }
        case 'spectrum-error': {
            const resolver = this.#pendingSpectrumResolvers.get(requestId);
            if (resolver) {
                resolver.reject(new Error(route.message || 'Spectrum error'));
                this.#pendingSpectrumResolvers.delete(requestId);
            }
            this.#registerIdleWorkerAndDrain(worker);
            return;
        }
        case 'tile-error': {
            const isTransitioning = this.#renderSession.isTransitioning();
            const transitionTilesRemaining = isTransitioning
                ? this.#renderSession.consumeTransitionTile()
                : null;
            const reaction = planTileErrorReaction({
                tileKey: route.tileKey,
                message: route.message,
                isTransitioning,
                transitionTilesRemaining,
            });
            if (reaction.shouldFinalizeTransitionFrame) {
                this.#finalizeTransitionFrame();
            }
            this.emit('log', reaction.logMessage);
            const slot = this.#renderSession.getCurrentRenderSlot();
            this.#renderSession.removeCurrentTile(reaction.tileKey);
            this.#renderer.dropTile({
                sourceId: this.#activeSourceId,
                slot,
                tileKey: reaction.tileKey,
            });
            this.#registerIdleWorkerAndDrain(worker, reaction.drain);
            return;
        }
        case 'error':
        case 'unknown':
            this.emit('error', route.message);
            this.#registerIdleWorkerAndDrain(worker);
            return;
        }
    }

    #registerIdleWorkerAndDrain(worker, {
        tiles = false,
        stats = false,
        preload = false,
    } = {}) {
        if (worker) {
            this.#workScheduler.registerIdleWorker(worker);
        }

        if (tiles) {
            this.#processTileRequestQueue();
        }
        if (stats) {
            this.#processBackgroundStatsQueue();
        }
        if (preload) {
            this.#processPreloadQueue();
        }
    }

    #postTrackedWorkerRequest(worker, request) {
        if (request.requestId) {
            this.#requestTracker.track(request.sourceId, request.requestId);
        }

        worker.postMessage(request.envelope);
    }

    #broadcastCancelRequest(sourceId, requestId, reason) {
        if (!(sourceId > 0) || !requestId) {
            return;
        }

        const cancelMessage = buildWorkerCancelRequest({
            sourceId,
            requestId,
            reason,
        });
        this.#workerPool.broadcast(cancelMessage);
    }

    #cancelSourceRequests(sourceId, reason) {
        if (!(sourceId > 0)) {
            return;
        }

        const requestIds = this.#requestTracker.invalidateSource(sourceId);

        for (const requestId of requestIds) {
            const resolver = this.#pendingSpectrumResolvers.get(requestId);
            if (resolver) {
                resolver.reject(new Error(`Viewer source invalidated: ${reason}.`));
                this.#pendingSpectrumResolvers.delete(requestId);
            }

            this.#broadcastCancelRequest(sourceId, requestId, reason);
        }
    }

    #dispatchStatsCalculation(bands, isInitial = false) {
        return this.#workExecutor.dispatchStatsCalculation({
            bands,
            isInitial,
            sourceId: this.#activeSourceId,
            hdrBytes: this.#hdrBytes,
            dataSource: this.#dataSourceDescriptor,
            header: this.#header,
        });
    }
    
    #startTransition() {
        this.#transitionController.startTransition({
            renderSession: this.#renderSession,
            renderer: this.#renderer,
            sourceId: this.#activeSourceId,
            getVisibleTiles: () => this.#calculateVisibleTiles(),
            takeIdleWorker: () => this.#workScheduler.takeIdleWorker(),
            enqueueTileRequest: (tileKey, tile) => this.#workScheduler.enqueueTileRequest(tileKey, tile),
            stopPreloading: () => this.#workScheduler.stopPreloading(),
            requestDraw: () => this.#updateAndDraw(),
            hdrBytes: this.#hdrBytes,
            dataSource: this.#dataSourceDescriptor,
            currentBands: this.#currentBands,
            globalStats: this.#globalStats,
            header: this.#header,
        });
    }

    #startBackgroundStatCalculation() {
        const result = this.#workExecutor.startBackgroundStatsCalculation({
            enabled: this.#config?.backgroundStats,
            header: this.#header,
            hasBandStats: (band) => this.#hasBandStats(band),
        });
        if (result.started) {
            this.#processBackgroundStatsQueue();
        }
    }

    #processBackgroundStatsQueue() {
        return this.#workExecutor.processBackgroundStatsQueue({
            isTransitioning: this.#renderSession.isTransitioning(),
            sourceId: this.#activeSourceId,
            hdrBytes: this.#hdrBytes,
            dataSource: this.#dataSourceDescriptor,
            header: this.#header,
        });
    }
    
    #processTileRequestQueue() {
        return this.#workExecutor.processTileRequestQueue({
            isTransitioning: this.#renderSession.isTransitioning(),
            sourceId: this.#activeSourceId,
            hdrBytes: this.#hdrBytes,
            dataSource: this.#dataSourceDescriptor,
            header: this.#header,
            currentBands: this.#currentBands,
            globalStats: this.#globalStats,
        });
    }

    #updateAndDraw() {
        return this.#viewController.updateAndDraw({
            header: this.#header,
            renderer: this.#renderer,
            sourceId: this.#activeSourceId,
            renderSession: this.#renderSession,
            runtimePolicy: this.#runtimePolicy,
            globalStats: this.#globalStats,
            canvas: this.#canvas,
            workScheduler: this.#workScheduler,
            enqueueTileRequest: (tileKey, tile) => this.#workScheduler.enqueueTileRequest(tileKey, tile),
            processTileRequestQueue: () => this.#processTileRequestQueue(),
            processPreloadQueue: () => this.#processPreloadQueue(),
        });
    }
    
    #calculateVisibleTiles() {
        return this.#viewController.calculateVisibleTiles({
            renderSession: this.#renderSession,
            header: this.#header,
            canvas: this.#canvas,
        });
    }
    
    #setInitialViewAndDraw() {
        return this.#viewController.setInitialViewAndDraw({
            header: this.#header,
            renderSession: this.#renderSession,
            requestDraw: () => this.#updateAndDraw(),
            startPreloading: () => this.#startPreloading(),
        });
    }

    #startPreloading() {
        const result = this.#workExecutor.startPreloading({
            enabled: this.#config?.tilePreloading,
            isPreloading: this.#workScheduler.isPreloading(),
            header: this.#header,
            globalStats: this.#globalStats,
            tileSize: this.#renderSession.getTileSize(),
            visibleTiles: this.#calculateVisibleTiles(),
            hasActiveTile: (tileKey) => this.#renderSession.hasActiveTile(tileKey),
            buildPreloadEntries: (input) => this.#runtimePolicy.buildPreloadEntries(input),
        });
        if (result.started) {
            this.#processPreloadQueue();
        }
    }

    #processPreloadQueue() {
        return this.#workExecutor.processPreloadQueue({
            isTransitioning: this.#renderSession.isTransitioning(),
            sourceId: this.#activeSourceId,
            hdrBytes: this.#hdrBytes,
            dataSource: this.#dataSourceDescriptor,
            header: this.#header,
            currentBands: this.#currentBands,
            globalStats: this.#globalStats,
            markActiveTilePending: (tileKey) => this.#renderSession.markActiveTilePending(tileKey),
            removeCurrentTile: (tileKey) => this.#renderSession.removeCurrentTile(tileKey),
        });
    }

    #clearCanvas() {
        this.#renderer?.clearCanvas();
    }

    #createRenderer({ disabledKinds = [] } = {}) {
        this.#renderer = new AutoRenderer(this.#canvas, {
            disabledKinds,
            onLifecycleEvent: (event) => this.#handleRendererLifecycleEvent(event),
            preference: this.#rendererPreference,
        });
        return this.#renderer;
    }

    #replaceCanvasForRendererRecovery({ disabledKinds = [] } = {}) {
        const parent = this.#canvas?.parentElement;
        if (!parent) {
            return this.#renderer;
        }

        const previousCanvas = this.#canvas;
        this.#detachEventListeners();

        const nextCanvas = document.createElement('canvas');
        nextCanvas.className = previousCanvas.className;
        nextCanvas.style.cssText = previousCanvas.style.cssText;
        nextCanvas.width = previousCanvas.width;
        nextCanvas.height = previousCanvas.height;

        parent.replaceChild(nextCanvas, previousCanvas);
        this.#canvas = nextCanvas;
        this.#renderer?.destroy();
        const nextRenderer = this.#createRenderer({ disabledKinds });
        this.#resizeCanvas();
        this.#attachEventListeners();
        this.#onCanvasReplaced?.(nextCanvas);
        return nextRenderer;
    }

    #rejectPendingSpectrumRequests(message) {
        for (const resolver of this.#pendingSpectrumResolvers.values()) {
            resolver.reject(new Error(message));
        }
        this.#pendingSpectrumResolvers.clear();
    }

    #finalizeTransitionFrame() {
        this.#transitionController.finalizeTransitionFrame({
            canvas: this.#canvas,
            renderSession: this.#renderSession,
            renderer: this.#renderer,
            sourceId: this.#activeSourceId,
            requestDraw: () => this.#updateAndDraw(),
        });
    }

    #resetSourceState({
        canceledSourceId = this.#cubeStore?.getSourceId() ?? 0,
        cancelReason = 'source-invalidated',
    } = {}) {
        this.#lifecycle.resetSourceState({
            canceledSourceId,
            cancelReason,
            cancelSourceRequests: (sourceId, reason) => this.#cancelSourceRequests(sourceId, reason),
            resetWorkState: () => this.#workScheduler.resetSourceWorkState(),
            rejectPendingSpectrumRequests: (message) => this.#rejectPendingSpectrumRequests(message),
            disposeRendererSource: (sourceId) => this.#renderer?.disposeSource(sourceId),
            clearMetadataCache: (sourceId) => this.#metadataCache.clearSource(sourceId),
            clearStatsCache: (sourceId) => this.#statsCache.clearSource(sourceId),
            clearRequestTracker: () => this.#requestTracker.clear(),
            unloadCubeStore: () => this.#cubeStore?.unload(),
            clearRuntimeState: () => {
                this.#globalStats = null;
                this.#cubeStore = null;
                this.#hdrBytes = null;
                this.#dataSourceDescriptor = null;
                this.#header = null;
            },
            resetRuntimePolicy: () => this.#runtimePolicy.reset(),
            resetRenderSession: () => this.#renderSession.resetSourceState(),
        });
    }

    #getAspectRatioCorrection() {
        return this.#viewController.getAspectRatioCorrection({
            renderSession: this.#renderSession,
            header: this.#header,
            canvas: this.#canvas,
        });
    }

    #resizeCanvas() {
        return this.#viewController.resizeCanvas(this.#canvas);
    }
    #handleRendererLifecycleEvent(event) {
        if (event?.type === 'renderer-fallback-armed') {
            this.#pendingRendererRecoveryDisabledKinds = event.disabledKinds ?? null;
        }
        void this.#lifecycle.handleRendererLifecycleEvent({
            event,
            resetForRendererRecovery: () => this.#renderSession.resetForRendererRecovery(),
            clearTileRequests: () => this.#workScheduler.clearTileRequests(),
            stopPreloading: () => this.#workScheduler.stopPreloading(),
            recoverRenderer: () => this.#recoverRendererAfterDeviceLoss(),
        });
    }

    async #recoverRendererAfterDeviceLoss() {
        const recoveryRenderer = this.#pendingRendererRecoveryDisabledKinds?.length
            ? this.#replaceCanvasForRendererRecovery({
                disabledKinds: this.#pendingRendererRecoveryDisabledKinds,
            })
            : this.#renderer;
        this.#pendingRendererRecoveryDisabledKinds = null;
        return this.#lifecycle.recoverRendererAfterDeviceLoss({
            renderer: recoveryRenderer,
            hasRenderableSource: () => Boolean(this.#header && this.#globalStats),
            startTransition: () => this.#startTransition(),
            requestDraw: () => this.#updateAndDraw(),
        });
    }
}
