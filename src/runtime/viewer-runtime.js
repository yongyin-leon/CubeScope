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
import { ProgressType } from '../protocol/worker-protocol.js';
import { AutoRenderer } from '../rendering/auto-renderer.js';
import { createRendererInput } from '../rendering/renderer-contract.js';
import {
    pixelToWorld as mapPixelToWorld,
    worldToPixel as mapWorldToPixel,
} from '../spatial/coordinate-mapper.js';
import { RequestTracker } from './request-tracker.js';
import { RenderSession } from './render-session.js';
import {
    buildSpectrumWorkerRequest,
    buildStatsWorkerRequest,
    buildTileWorkerRequest,
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
    #performance = { 
        loadStartTime: 0,
        bandSwitchStartTime: 0,
        isInitialLoading: false,
        initialVisibleTiles: new Set(),
        completedInitialTiles: new Set(),
    };

    // Rendering & Tile state
    #renderer = null;
    #renderSession = new RenderSession();
    #globalStats = null;
    #currentBands = { r: 30, g: 20, b: 10 };
    #metadataCache = new SourceValueCache(DEFAULT_METADATA_CACHE_POLICY);
    #statsCache = new SourceMapCache(DEFAULT_STATS_CACHE_POLICY);
    #rendererRecoveryPromise = null;
    #resumeTransitionAfterRendererRecovery = false;

    // Worker state
    #MAX_WORKERS;
    #workerPool = new ViewerWorkerPool();
    #workScheduler = new WorkScheduler();
    #pendingSpectrumResolvers = new Map();
    #requestTracker = new RequestTracker();
    #activeSourceId = 0;
    
    // Core components & configuration
    #canvas;
    #wasmPaths;
    #config;
    #resizeObserver;

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
        this.#formatAdapter = createEnviFormatAdapter({
            getWasmModule: async () => this.#wasmModule
                ?? await import(/* @vite-ignore */ this.#wasmPaths.wasmJsPath),
        });
        this.#renderer = new AutoRenderer(this.#canvas, {
            onLifecycleEvent: (event) => this.#handleRendererLifecycleEvent(event),
            preference: options.rendererPreference ?? 'auto',
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
            this.emit('log', `Renderer initialization completed (${this.#renderer.getKind?.() ?? 'unknown'}).`);
            await this.#initWorkers();
            this.#attachEventListeners();
            this.emit('ready');
            this.emit('log', 'Library initialization completed and ready.');
        } catch (error) {
            const errorMessage = `Initialization failed: ${error.message}`;
            this.emit('error', errorMessage);
            console.error(error);
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
            return;
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
        
        this.#performance.loadStartTime = performance.now();
        this.#performance.isInitialLoading = true;
        this.#performance.initialVisibleTiles.clear();
        this.#performance.completedInitialTiles.clear();
        try {
            this.#hdrBytes = new Uint8Array(await headerSource.readAll());
            this.#header = await this.#formatAdapter.parseHeader({
                headerSource,
                headerBytes: this.#hdrBytes,
            });
            this.emit('headerloaded', this.#header);
            this.emit('log', `HDR 解析成功。 格式(Interleave): ${this.#header.interleave}`);

            const metadataSummary = await this.#createMetadataSummary({
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
            const initialBands = [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b];
            this.#dispatchStatsCalculation(initialBands.filter(b => !this.#hasBandStats(b)), true);
        } catch (err) {
            this.emit('error', `文件加载或解析失败: ${err.message}`);
            this.emit('loadend');
            this.emit('statechange', { loading: false });
        }
    }

    async #createMetadataSummary({ dataSource, header }) {
        let fileSize = null;

        try {
            fileSize = await dataSource.size();
        } catch {}

        return {
                fileName: dataSource.name,
                fileSize,
                sourceKind: dataSource.kind,
                dimensions: {
                    samples: header.samples,
                    lines: header.lines,
                    bands: header.bands,
                },
                format: {
                    interleave: header.interleave.toUpperCase(),
                    dataType: header.dataType,
                    byteOrder: header.byteOrder.toUpperCase(),
                }
        };
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

    setBands({ r, g, b }) {
        if (this.#renderSession.isTransitioning() || !this.#header) return;
        const newR = parseInt(r, 10), newG = parseInt(g, 10), newB = parseInt(b, 10);
        if (newR === this.#currentBands.r && newG === this.#currentBands.g && newB === this.#currentBands.b) return;
        this.#currentBands = { r: newR, g: newG, b: newB };
        this.emit('bandschanged', this.#currentBands);
        this.#performance.bandSwitchStartTime = performance.now();
        console.log('[PERF-LOG] 计时器启动: Band Switch Time');
        this.emit('log', `波段组合已更改为 R:${r}, G:${g}, B:${b}。`);
        const neededBands = [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b];
        const missingBands = neededBands.filter(b => !this.#hasBandStats(b));
        if (missingBands.length === 0) {
            this.emit('log', "从缓存加载统计值，开始平滑过渡...");
            this.#globalStats = {};
            neededBands.forEach(b => this.#globalStats[b] = this.#getBandStats(b));
            this.#startTransition();
        } else {
            this.emit('log', `缓存缺失，正在为波段 ${missingBands.join(',')} 计算统计值...`);
            this.emit('statechange', { loading: true, message: '计算统计值...' });
            this.#workScheduler.startWaitingForStats();
            this.#dispatchStatsCalculation(missingBands, false);
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
            for (const band of route.bands) {
                if (route.stats[band]) {
                    this.#setBandStats(band, route.stats[band]);
                }
            }
            this.#registerIdleWorkerAndDrain(worker, { stats: false });
            if (route.isInitial) {
                this.#globalStats = {};
                [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b].forEach(b => {
                    if (this.#hasBandStats(b)) { this.#globalStats[b] = this.#getBandStats(b); }
                });
                this.emit('log', `Initial statistics calculation completed: ${JSON.stringify(this.#globalStats)}`);
                const setupAndDraw = () => {
                    this.#setInitialViewAndDraw();
                    this.emit('loadend');
                    this.emit('statechange', { loading: false });
                };
                setupAndDraw();
                this.#startBackgroundStatCalculation();
            } else {
                if (!this.#renderSession.isTransitioning() && this.#workScheduler.isWaitingForStats()) {
                    const neededBands = [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b];
                    const isNowReady = neededBands.every(b => this.#hasBandStats(b));
                    if (isNowReady) {
                        this.emit('log', "Requested band statistics computed; starting smooth transition...");
                        this.#workScheduler.stopWaitingForStats();
                        this.#globalStats = {};
                        neededBands.forEach(b => this.#globalStats[b] = this.#getBandStats(b));
                        this.#startTransition();
                    }
                }
            }
            this.#processBackgroundStatsQueue();
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
            if (!stored) {
                this.#renderSession.removeCurrentTile(tileKey);
                this.#registerIdleWorkerAndDrain(worker, {
                    tiles: true,
                    preload: true,
                });
                return;
            }
            this.#renderSession.markCurrentTileLoaded(tileKey);
            if (this.#renderSession.isTransitioning()) {
                if (this.#renderSession.consumeTransitionTile() === 0) {
                    //
                    // 结束计时
                    const bandSwitchTime = performance.now() - this.#performance.bandSwitchStartTime;
                    console.log(`%c[PERF-LOG] Band switch completed! Time: ${bandSwitchTime.toFixed(0)} ms`, 'color: green; font-weight: bold;');

                    // 发送新的 performance 事件
                    this.emit('performance', {
                        name: 'bandSwitchTime',
                        value: bandSwitchTime,
                        unit: 'ms'
                    });
                    this.#finalizeTransitionFrame();
                }
            } else {
                if (this.#performance.isInitialLoading) {
                    if (this.#performance.initialVisibleTiles.has(tileKey)) {
                        this.#performance.completedInitialTiles.add(tileKey);
                        this.#checkInitialViewCompletion();
                    }
                }
                requestAnimationFrame(() => this.#updateAndDraw());
            }
            this.#registerIdleWorkerAndDrain(worker, {
                tiles: true,
                preload: true,
            });
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
            if (this.#renderSession.isTransitioning()) {
                 if (this.#renderSession.consumeTransitionTile() === 0) {
                    this.#finalizeTransitionFrame();
                 }
            }
            const tileKey = route.tileKey ?? 'unknown';
            this.emit('log', `Worker failed to load tile (${tileKey}) : ${route.message || 'Unknown error'}`);
            const slot = this.#renderSession.getCurrentRenderSlot();
            this.#renderSession.removeCurrentTile(tileKey);
            this.#renderer.dropTile({
                sourceId: this.#activeSourceId,
                slot,
                tileKey,
            });
            this.#registerIdleWorkerAndDrain(worker, {
                tiles: true,
                preload: true,
            });
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
        if (this.#workScheduler.hasIdleWorker()) {
            const worker = this.#workScheduler.takeIdleWorker();
            this.#postTrackedWorkerRequest(worker, buildStatsWorkerRequest({
                sourceId: this.#activeSourceId,
                hdrBytes: this.#hdrBytes,
                dataSource: this.#dataSourceDescriptor,
                bands,
                header: this.#header,
                isInitial,
            }));
        } else {
            if (!isInitial) {
                this.emit('log', "No idle worker; task queued for background.");
                this.#workScheduler.prependBackgroundStatsBands(bands);
            } else {
                this.emit('error', "No available worker for initial stats task!");
            }
        }
    }
    
    #startTransition() {
        if (!this.#renderSession.beginTransition({
            renderer: this.#renderer,
            sourceId: this.#activeSourceId,
        })) return;
        this.emit('statechange', { loading: true, message: 'Switching bands...' });
        const visibleTiles = this.#calculateVisibleTiles();
        this.#renderSession.setTransitionTileCount(visibleTiles.length);
        if (visibleTiles.length === 0) {
            this.#renderSession.cancelTransition();
            requestAnimationFrame(() => this.#updateAndDraw());
            this.emit('statechange', { loading: false });
            return;
        }
        for (const tile of visibleTiles) {
            const worker = this.#workScheduler.takeIdleWorker();
            if (worker) {
                const bandsPayload = [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b];
                console.log(`[主线程-1-发送任务] (过渡) tile: (${tile.x}, ${tile.y}), bands:`, bandsPayload);
                this.#postTrackedWorkerRequest(worker, buildTileWorkerRequest({
                    sourceId: this.#activeSourceId,
                    hdrBytes: this.#hdrBytes,
                    dataSource: this.#dataSourceDescriptor,
                    tile,
                    bands: bandsPayload,
                    globalStats: this.#globalStats,
                    header: this.#header,
                    phase: 'transition',
                }));
            } else {
                this.#renderSession.consumeTransitionTile();
                this.#workScheduler.enqueueTileRequest(`${tile.x},${tile.y}`, tile);
            }
        }
        this.#workScheduler.stopPreloading();
    }

    #startBackgroundStatCalculation() {
        if (!this.#config?.backgroundStats) {
            this.emit('log', '后台统计功能已关闭。');
            return;
        }
        const pendingBands = [];
        for (let i = 1; i <= this.#header.bands; i++) {
            if (!this.#hasBandStats(i)) {
                pendingBands.push(i);
            }
        }
        this.#workScheduler.replaceBackgroundStatsQueue(pendingBands);
        if (!this.#workScheduler.hasBackgroundStatsWork()) {
            this.emit('log', `所有波段统计值已在缓存中，无需后台计算。`);
            return;
        }
        this.emit('log', `开始后台统计... 队列中有 ${this.#workScheduler.getBackgroundStatsCount()} 个波段待处理。`);
        this.#processBackgroundStatsQueue();
    }

    #processBackgroundStatsQueue() {
        if (this.#renderSession.isTransitioning()) return;
        if (this.#workScheduler.hasIdleWorker() && this.#workScheduler.hasBackgroundStatsWork()) {
            const worker = this.#workScheduler.takeIdleWorker();
            const nextBand = this.#workScheduler.takeNextBackgroundStatsBand();
            if (!worker || !nextBand) {
                return;
            }
            this.emit('progress', {
                type: ProgressType.STATS_CALCULATION,
                processed: nextBand.processed,
                total: nextBand.total,
                progress: nextBand.progressPercent
            });
            this.#postTrackedWorkerRequest(worker, buildStatsWorkerRequest({
                sourceId: this.#activeSourceId,
                hdrBytes: this.#hdrBytes,
                dataSource: this.#dataSourceDescriptor,
                bands: [nextBand.band],
                header: this.#header,
                isInitial: false,
            }));
        }
    }
    
    #processTileRequestQueue() {
        if (this.#renderSession.isTransitioning()) return;
        while (this.#workScheduler.hasIdleWorker() && this.#workScheduler.hasTileRequests()) {
            const nextTile = this.#workScheduler.takeNextTileRequest();
            const worker = this.#workScheduler.takeIdleWorker();
            if (!nextTile || !worker || !nextTile.tile) {
                continue;
            }
            const { tile } = nextTile;
            const bandsPayload = [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b];
            console.log(`[主线程-1-发送任务] tile: (${tile.x}, ${tile.y}), bands:`, bandsPayload);
            this.#postTrackedWorkerRequest(worker, buildTileWorkerRequest({
                sourceId: this.#activeSourceId,
                hdrBytes: this.#hdrBytes,
                dataSource: this.#dataSourceDescriptor,
                tile,
                bands: bandsPayload,
                globalStats: this.#globalStats,
                header: this.#header,
                phase: 'visible',
            }));
        }
    }

    #updateAndDraw() {
        if (!this.#header || !this.#renderer || !this.#globalStats) return;
        const visibleTiles = this.#calculateVisibleTiles();
        if (this.#performance.isInitialLoading && this.#performance.initialVisibleTiles.size === 0 && visibleTiles.length > 0) {
            this.#performance.initialVisibleTiles = new Set(visibleTiles.map(t => `${t.x},${t.y}`));
        }
        const renderResult = this.#renderer.render(createRendererInput({
            sourceId: this.#activeSourceId,
            slot: 'active',
            header: this.#header,
            viewState: this.#renderSession.getViewState(),
            tiles: visibleTiles,
            clearMode: this.#renderSession.isTransitioning() ? 'load' : 'clear',
        }));
        if (renderResult.rendererReady === false) {
            return;
        }
        let needsLoad = false;
        for (const tile of renderResult.missingTiles) {
            const tileKey = `${tile.x},${tile.y}`;
            if (this.#renderSession.markActiveTilePending(tileKey)) {
                this.#workScheduler.enqueueTileRequest(tileKey, tile);
                needsLoad = true;
            }
        }
        if (needsLoad) { this.#processTileRequestQueue(); }
        if (!needsLoad && this.#workScheduler.isPreloading() && !this.#workScheduler.hasTileRequests() && this.#workScheduler.hasPreloadEntries()) { this.#processPreloadQueue(); }
    }
    
    #calculateVisibleTiles() {
        return this.#renderSession.calculateVisibleTiles({
            header: this.#header,
            canvasWidth: this.#canvas.clientWidth,
            canvasHeight: this.#canvas.clientHeight,
        });
    }
    
    #setInitialViewAndDraw() {
        const scale = this.#renderSession.setInitialView(this.#header);
        this.emit('log', `Setting initial focused view: scale ${scale.toFixed(2)}x`);
        requestAnimationFrame(() => this.#updateAndDraw());
        setTimeout(() => this.#startPreloading(), 500);
    }

    #startPreloading() {
        if (!this.#config?.tilePreloading) {
            this.emit('log', 'Tile preloading is disabled.');
            return;
        }
        if (this.#workScheduler.isPreloading() || !this.#header || !this.#globalStats) return;
        const preloadEntries = [];
        const tileSize = this.#renderSession.getTileSize();
        const maxTileX = Math.ceil(this.#header.samples / tileSize);
        const maxTileY = Math.ceil(this.#header.lines / tileSize);
        const visibleTiles = this.#calculateVisibleTiles();
        const visibleSet = new Set(visibleTiles.map(t => `${t.x},${t.y}`));
        const centerX = Math.floor((visibleTiles.reduce((sum, t) => sum + t.x, 0) / visibleTiles.length) || 0);
        const centerY = Math.floor((visibleTiles.reduce((sum, t) => sum + t.y, 0) / visibleTiles.length) || 0);
        for (let y = 0; y < maxTileY; y++) {
            for (let x = 0; x < maxTileX; x++) {
                const tileKey = `${x},${y}`;
                if (!visibleSet.has(tileKey) && !this.#renderSession.hasActiveTile(tileKey)) {
                    const dist = Math.abs(x - centerX) + Math.abs(y - centerY);
                    preloadEntries.push({ tile: { x, y }, dist });
                }
            }
        }
        preloadEntries.sort((a, b) => a.dist - b.dist);
        this.#workScheduler.startPreloading(preloadEntries);
        this.emit('log', `Starting smart preloading: ${this.#workScheduler.getPreloadCount()} tiles queued for background loading.`);
        this.#processPreloadQueue();
    }

    #processPreloadQueue() {
        if (!this.#workScheduler.isPreloading() || this.#renderSession.isTransitioning()) return;
        while (this.#workScheduler.hasIdleWorker() && this.#workScheduler.hasPreloadEntries() && !this.#workScheduler.hasTileRequests()) {
            const nextEntry = this.#workScheduler.takeNextPreloadEntry();
            if (!nextEntry?.tile) {
                continue;
            }
            const { tile } = nextEntry;
            const tileKey = `${tile.x},${tile.y}`;
            if (this.#renderSession.markActiveTilePending(tileKey)) {
                const worker = this.#workScheduler.takeIdleWorker();
                if (!worker) {
                    this.#renderSession.removeCurrentTile(tileKey);
                    this.#workScheduler.enqueueTileRequest(tileKey, tile);
                    break;
                }
                const bandsPayload = [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b];
                 console.log(`[主线程-1-发送任务] (预加载) tile: (${tile.x}, ${tile.y}), bands:`, bandsPayload);
                this.#postTrackedWorkerRequest(worker, buildTileWorkerRequest({
                    sourceId: this.#activeSourceId,
                    hdrBytes: this.#hdrBytes,
                    dataSource: this.#dataSourceDescriptor,
                    tile,
                    bands: bandsPayload,
                    globalStats: this.#globalStats,
                    header: this.#header,
                    phase: 'preload',
                }));
            }
        }
        if (!this.#workScheduler.hasPreloadEntries() && this.#workScheduler.isPreloading()) {
            this.#workScheduler.stopPreloading();
            this.emit('log', "All tile preloads completed.");
        }
    }

    #clearCanvas() {
        this.#renderer?.clearCanvas();
    }

    #rejectPendingSpectrumRequests(message) {
        for (const resolver of this.#pendingSpectrumResolvers.values()) {
            resolver.reject(new Error(message));
        }
        this.#pendingSpectrumResolvers.clear();
    }

    #finalizeTransitionFrame() {
        this.#canvas.style.opacity = '0';
        setTimeout(() => {
            this.#renderSession.completeTransition({
                renderer: this.#renderer,
                sourceId: this.#activeSourceId,
            });
            requestAnimationFrame(() => this.#updateAndDraw());
            this.emit('statechange', { loading: false });
            setTimeout(() => this.#canvas.style.opacity = '1', 20);
        }, 200);
    }

    #resetSourceState({
        canceledSourceId = this.#cubeStore?.getSourceId() ?? 0,
        cancelReason = 'source-invalidated',
    } = {}) {
        this.#cancelSourceRequests(canceledSourceId, cancelReason);
        this.#workScheduler.resetSourceWorkState();
        this.#rejectPendingSpectrumRequests('Viewer source unloaded.');
        this.#renderer?.disposeSource(canceledSourceId);
        this.#metadataCache.clearSource(canceledSourceId);
        this.#statsCache.clearSource(canceledSourceId);
        this.#globalStats = null;
        this.#requestTracker.clear();
        this.#cubeStore?.unload();
        this.#cubeStore = null;
        this.#hdrBytes = null;
        this.#dataSourceDescriptor = null;
        this.#header = null;
        this.#performance = {
            loadStartTime: 0,
            bandSwitchStartTime: 0,
            isInitialLoading: false,
            initialVisibleTiles: new Set(),
            completedInitialTiles: new Set(),
        };
        this.#renderSession.resetSourceState();
    }

    #getAspectRatioCorrection() {
        return this.#renderSession.getAspectRatioCorrection({
            header: this.#header,
            canvasWidth: this.#canvas.clientWidth,
            canvasHeight: this.#canvas.clientHeight,
        });
    }

    #resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = Math.round(this.#canvas.clientWidth * dpr);
        const displayHeight = Math.round(this.#canvas.clientHeight * dpr);
        if (this.#canvas.width !== displayWidth || this.#canvas.height !== displayHeight) {
            this.#canvas.width = displayWidth;
            this.#canvas.height = displayHeight;
            return true;
        }
        return false;
    }
    #checkInitialViewCompletion() {
        if (!this.#performance.isInitialLoading || this.#performance.initialVisibleTiles.size === 0) {
            return;
        }

        if (this.#performance.completedInitialTiles.size >= this.#performance.initialVisibleTiles.size) {
            const timeToInitialView = performance.now() - this.#performance.loadStartTime;
            console.log(`%c[PERF-LOG] All initial tiles loaded. Emitting 'performance' event.`, 'color: green; font-weight: bold;');
            console.log(`%c[PERF-LOG] Time to Initial View: ${timeToInitialView.toFixed(0)} ms`, 'color: green; font-weight: bold;');
            this.emit('performance', {
                name: 'timeToInitialView',
                value: timeToInitialView,
                unit: 'ms'
            });

            this.#performance.isInitialLoading = false;
        }
    }

    #handleRendererLifecycleEvent(event) {
        if (!event || event.type !== 'device-loss') {
            return;
        }

        const message = event.message ?? 'WebGPU device lost.';
        const shouldResumeTransition = this.#renderSession.resetForRendererRecovery();
        this.emit('log', `Renderer lifecycle event: ${message}`);
        this.#workScheduler.clearTileRequests();
        this.#workScheduler.stopPreloading();
        this.#resumeTransitionAfterRendererRecovery = shouldResumeTransition;
        void this.#recoverRendererAfterDeviceLoss();
    }

    async #recoverRendererAfterDeviceLoss() {
        if (!this.#renderer || this.#rendererRecoveryPromise) {
            return this.#rendererRecoveryPromise;
        }

        this.#rendererRecoveryPromise = (async () => {
            try {
                this.emit('log', 'Reinitializing renderer after device loss...');
                await this.#renderer.init();
                this.emit('log', `Renderer recovered after device loss (${this.#renderer.getKind?.() ?? 'unknown'}).`);

                if (this.#resumeTransitionAfterRendererRecovery && this.#header && this.#globalStats) {
                    this.#resumeTransitionAfterRendererRecovery = false;
                    this.#startTransition();
                } else if (this.#header && this.#globalStats) {
                    requestAnimationFrame(() => this.#updateAndDraw());
                }
            } catch (error) {
                this.emit('error', `Renderer recovery failed: ${error.message}`);
            } finally {
                this.#resumeTransitionAfterRendererRecovery = false;
                this.#rendererRecoveryPromise = null;
            }
        })();

        return this.#rendererRecoveryPromise;
    }
}
