/**
 * @file EnviViewer.js
 * @description A reusable JavaScript library for rendering ENVI hyperspectral imaging files using WebGPU and WebAssembly.
 * @author yongyinli
 * @version 1.0.6 - Implemented 'Time to Initial View' metric and modularized performance tracking.
 *
 * @class EnviViewer
 * @classdesc Main class to control the ENVI file rendering canvas.
 */

// A simple, self-contained event emitter class to handle decoupling.
class EventEmitter {
    constructor() { this.events = {}; }
    on(eventName, listener) { if (!this.events[eventName]) { this.events[eventName] = []; } this.events[eventName].push(listener); }
    emit(eventName, ...args) { if (this.events[eventName]) { this.events[eventName].forEach(listener => listener(...args)); } }
    off(eventName, listenerToRemove) { if (!this.events[eventName]) return; this.events[eventName] = this.events[eventName].filter(listener => listener !== listenerToRemove); }
}

export class EnviViewer extends EventEmitter {
    // --- Private Class Fields ---

    // Core state
    #wasmModule = null; 
    #header = null;
    #hdrBytes = null;
    #imgFile = null;
    #performance = { 
        loadStartTime: 0,
        bandSwitchStartTime: 0,
        isInitialLoading: false,
        initialVisibleTiles: new Set(),
        completedInitialTiles: new Set(),
    };

    // WebGPU state
    #device = null;
    #context = null;
    #pipeline = null;
    #sampler = null;

    // Rendering & Tile state
    #TILE_SIZE = 512;
    #tileCache = new Map();
    #TILE_RENDERING_KEY = 'rendering';
    #globalStats = null;
    #currentBands = { r: 30, g: 20, b: 10 };

    // Viewport state
    #scale = 1.0;
    #offsetX = 0.0;
    #offsetY = 0.0;

    // Worker state
    #MAX_WORKERS;
    #idleWorkers = [];
    #tileRequestQueue = new Map();
    #bandStatsCache = new Map();
    #backgroundStatsQueue = [];
    #totalBandsForStats = 0;
    #isWaitingForStats = false; 
    #pendingSpectrumResolvers = new Map();

    // Transition animation state
    #isTransitioning = false;
    #newTileCache = null;
    #transitionTileCounter = 0;

    // Preloading state
    #preloadQueue = [];
    #isPreloading = false;
    
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
        return this.#header;
    }

    getImageFile() {
        return this.#imgFile;
    }

    getHdrBytes() {
        return this.#hdrBytes;
    }

    async getSpectralProfile(x, y) {
        if (!this.#header || !this.#imgFile || !this.#hdrBytes) return null;
        const requestId = `spec_${Date.now()}_${Math.random()}`;
        return new Promise((resolve, reject) => {
            const dispatch = () => {
                if (this.#idleWorkers.length > 0) {
                    const worker = this.#idleWorkers.pop();
                    worker.postMessage({ type: 'get_spectrum', payload: { hdrBytes: this.#hdrBytes, imgFile: this.#imgFile, x, y, header: this.#header, requestId } });
                    this.#pendingSpectrumResolvers.set(requestId, { resolve, reject });
                } else {
                    setTimeout(dispatch, 200);
                }
            };
            dispatch();
        });
    }
    // --- Public API ---

    async init() {
        this.emit('log', 'Library initialization started...');
        try {
            this.#wasmModule = await import(this.#wasmPaths.wasmJsPath);
            const wasmModule = await import(this.#wasmPaths.wasmJsPath);
            const wasmPath = new URL(this.#wasmPaths.wasmWasmPath, import.meta.url).href;
            this.emit('log', wasmPath);
            await wasmModule.default(wasmPath);
            wasmModule.set_logging_enabled(false);
            this.emit('log', 'Main thread WASM initialization completed.');
            await this.#initWebGPU();
            await this.#initWorkers();
            this.#attachEventListeners();
            this.#resizeCanvas();
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
        if (!this.#wasmModule || !this.#hdrBytes) {
            this.emit('error', 'WASM 模块或 HDR 数据未准备好，无法创建 Reader。');
            return null;
        }
        return new this.#wasmModule.EnviReader(this.#hdrBytes);
    }
    async load(hdrFile, imgFile) {
        if (!hdrFile || !imgFile) {
            this.emit('error', '必须同时提供 HDR 和 图像文件。');
            return;
        }
        this.emit('loadstart');
        this.emit('log', `开始加载: ${hdrFile.name}, ${imgFile.name}`);
        
        this.#performance.loadStartTime = performance.now();
        this.#performance.isInitialLoading = true;
        this.#performance.initialVisibleTiles.clear();
        this.#performance.completedInitialTiles.clear();
        
        this.#tileCache.clear();
        this.#globalStats = null;
        this.#bandStatsCache.clear();
        this.#backgroundStatsQueue = [];
        this.#preloadQueue = [];
        this.#isPreloading = false;
        this.#scale = 1.0;
        this.#offsetX = 0.0;
        this.#offsetY = 0.0;
        try {
            this.#hdrBytes = new Uint8Array(await hdrFile.arrayBuffer());
            const { EnviReader } = await import(this.#wasmPaths.wasmJsPath);
            const enviReader = new EnviReader(this.#hdrBytes);
            this.#header = enviReader.getHeaderAsJsObject();
            this.#header.interleave = this.#header.interleave.toLowerCase();
            if (!['bil', 'bsq', 'bip'].includes(this.#header.interleave)) { throw new Error(`不支持的 Interleave 格式: ${this.#header.interleave}`); }
            this.emit('headerloaded', this.#header);
            this.emit('log', `HDR 解析成功。 格式(Interleave): ${this.#header.interleave}`);

            this.emit('metadata', {
                fileName: imgFile.name,
                fileSize: imgFile.size, // 文件大小 (bytes)
                dimensions: {
                    samples: this.#header.samples,
                    lines: this.#header.lines,
                    bands: this.#header.bands,
                },
                format: {
                    interleave: this.#header.interleave.toUpperCase(),
                    dataType: this.#header.dataType, // 假设您的 to_js() 方法会转换这个
                    byteOrder: this.#header.byteOrder === 1 ? 'LSB' : 'MSB', // 假设 1=LSB
                }
            });

            this.#resizeCanvas();
            this.#imgFile = imgFile;
            this.emit('log', "正在为初始视图计算统计值...");
            this.emit('statechange', { loading: true, message: '计算统计值...' });
            const initialBands = [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b];
            this.#dispatchStatsCalculation(initialBands.filter(b => !this.#bandStatsCache.has(b)), true);
        } catch (err) {
            this.emit('error', `文件加载或解析失败: ${err.message}`);
            this.emit('loadend');
            this.emit('statechange', { loading: false });
        }
    }

    setBands({ r, g, b }) {
        if (this.#isTransitioning || !this.#header) return;
        const newR = parseInt(r, 10), newG = parseInt(g, 10), newB = parseInt(b, 10);
        if (newR === this.#currentBands.r && newG === this.#currentBands.g && newB === this.#currentBands.b) return;
        this.#currentBands = { r: newR, g: newG, b: newB };
        this.emit('bandschanged', this.#currentBands);
        this.#performance.bandSwitchStartTime = performance.now();
        console.log('[PERF-LOG] 计时器启动: Band Switch Time');
        this.emit('log', `波段组合已更改为 R:${r}, G:${g}, B:${b}。`);
        const neededBands = [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b];
        const missingBands = neededBands.filter(b => !this.#bandStatsCache.has(b));
        if (missingBands.length === 0) {
            this.emit('log', "从缓存加载统计值，开始平滑过渡...");
            this.#globalStats = {};
            neededBands.forEach(b => this.#globalStats[b] = this.#bandStatsCache.get(b));
            this.#startTransition();
        } else {
            this.emit('log', `缓存缺失，正在为波段 ${missingBands.join(',')} 计算统计值...`);
            this.emit('statechange', { loading: true, message: '计算统计值...' });
            this.#isWaitingForStats = true;
            this.#dispatchStatsCalculation(missingBands, false);
        }
    }

    destroy() {
        this.emit('log', '销毁 EnviViewer 实例...');
        this.#isPreloading = false;
        this.#preloadQueue = [];
        this.#tileRequestQueue.clear();
        this.#detachEventListeners();
        this.#idleWorkers.forEach(worker => worker.terminate());
        this.#idleWorkers = [];
        this.#device = null;
        this.#context = null;
        this.#pipeline = null;
        this.#tileCache.clear();
        this.#bandStatsCache.clear();
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

    // --- Public Methods to Expose Internal State ---
    
    // 获取是否有活跃的瓦片请求
    get hasActiveTileRequests() {
        return this.#tileRequestQueue.size > 0;
    }
    
    // 获取是否有后台统计任务
    get hasBackgroundStatsTasks() {
        return this.#backgroundStatsQueue.length > 0;
    }
    
    // 获取是否有预加载任务
    get hasPreloadTasks() {
        return this.#preloadQueue.length > 0;
    }
    
    // 获取是否正在进行波段切换
    get isTransitioning() {
        return this.#isTransitioning;
    }
    
    // 获取是否在等待统计值
    get isWaitingForStats() {
        return this.#isWaitingForStats;
    }
    
    // 获取空闲Worker数量
    get idleWorkerCount() {
        return this.#idleWorkers.length;
    }
    
    // 获取总Worker数量
    get totalWorkerCount() {
        return this.#MAX_WORKERS;
    }
    // 在 EnviViewer 类中添加这个新方法
    #handleCanvasClick = (e) => {
        // 如果头文件还没加载，无法进行任何计算
        if (!this.#header) return;

        // 1. 获取鼠标点击位置相对于 <canvas> 元素的坐标
        const rect = this.#canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;

        // 2. 将 canvas 坐标转换为标准化设备坐标 (NDC)，范围从 -1 到 +1
        const mouseX = (canvasX / this.#canvas.clientWidth) * 2 - 1;
        const mouseY = (canvasY / this.#canvas.clientHeight) * -2 + 1; // WebGPU/OpenGL的Y轴是向上的，所以要翻转

        // 3. 反向应用平移和缩放变换，得到视口坐标
        // 这是渲染变换的逆过程
        const { x: aspectX, y: aspectY } = this.#getAspectRatioCorrection();
        
        const viewX = (mouseX - this.#offsetX) / this.#scale;
        const viewY = (mouseY - this.#offsetY) / this.#scale;

        // 4. 将视口坐标转换回图像的 UV 坐标 (范围从 0 到 1)
        const imageU = (viewX / aspectX + 1) / 2;
        const imageV = (viewY / -aspectY + 1) / 2; // 再次处理Y轴翻转

        // 5. 最后，将 UV 坐标乘以图像的宽高，得到最终的整数像素坐标
        const imageX = Math.floor(imageU * this.#header.samples);
        const imageY = Math.floor(imageV * this.#header.lines);

        // 6. 边界检查，确保计算出的坐标在图像范围内
        if (imageX >= 0 && imageX < this.#header.samples && imageY >= 0 && imageY < this.#header.lines) {
            this.emit('log', `图像被点击，像素坐标: (${imageX}, ${imageY})`);
            
            // 7. 触发自定义的 'image-clicked' 事件，并把精确的图像坐标作为数据传递出去
            this.emit('image-clicked', { x: imageX, y: imageY });
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
        if (!this.#isDragging || !this.#header || this.#scale <= 1.0) return;
        const dx = (e.clientX - this.#lastMousePos.x) * 2 / this.#canvas.clientWidth;
        const dy = (e.clientY - this.#lastMousePos.y) * 2 / this.#canvas.clientHeight;
        this.#offsetX += dx;
        this.#offsetY -= dy;
        const { x: aspectX, y: aspectY } = this.#getAspectRatioCorrection();
        const limitX = (this.#scale - 1) * aspectX;
        const limitY = (this.#scale - 1) * aspectY;
        this.#offsetX = Math.max(-limitX, Math.min(limitX, this.#offsetX));
        this.#offsetY = Math.max(-limitY, Math.min(limitY, this.#offsetY));
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
        const newScale = this.#scale * zoomFactor;
        if (this.#scale > 1.0 && newScale <= 1.0) {
            this.#scale = 1.0;
            this.#offsetX = 0;
            this.#offsetY = 0;
        } else {
            this.#scale = Math.max(1.0, newScale);
            if (this.#scale > 1.0) {
                this.#offsetX = (this.#offsetX - mouseX) * zoomFactor + mouseX;
                this.#offsetY = (this.#offsetY - mouseY) * zoomFactor + mouseY;
            }
        }
        requestAnimationFrame(() => this.#updateAndDraw());
    }
    
    async #initWebGPU() {
        try {
            if (!navigator.gpu) { throw new Error("WebGPU is not supported"); }
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) { throw new Error("Failed to acquire WebGPU adapter"); }
            this.#device = await adapter.requestDevice();
            this.#context = this.#canvas.getContext("webgpu");
            const format = navigator.gpu.getPreferredCanvasFormat();
            this.#context.configure({ device: this.#device, format, alphaMode: 'premultiplied' });
            this.emit('log', "WebGPU initialization completed.");
        } catch (e) {
            this.emit('error', `WebGPU initialization failed: ${e.message}`);
            throw e; 
        }
    }

    async #initWorkers() {
        const workerUrl = this.#wasmPaths.workerPath;
        const cacheBustingUrl = `${workerUrl}?t=${new Date().getTime()}`;
        console.log(`Loading Worker from URL (cache-busting): ${cacheBustingUrl}`);
        const initPromises = [];
        for (let i = 0; i < this.#MAX_WORKERS; i++) {
            const worker = new Worker(cacheBustingUrl, { type: 'module' });
            const promise = new Promise((resolve, reject) => {
                worker.onmessage = (e) => {
                    if (e.data.type === 'init_complete') { this.#idleWorkers.push(worker); resolve(); }
                    else if (e.data.type === 'error') { this.emit('log', `Worker 初始化错误: ${e.data.message}`); reject(new Error(e.data.message)); }
                    else { this.#handleWorkerMessage(e); }
                };
                worker.onerror = (err) => { this.emit('log', `A worker encountered a fatal error: ${err.message}`); reject(err); };
            });
            const absoluteWasmJsPath = new URL(this.#wasmPaths.wasmJsPath, import.meta.url).href;
            const absoluteWasmWasmPath = new URL(this.#wasmPaths.wasmWasmPath, import.meta.url).href;
            worker.postMessage({ type: 'init', payload: { wasmJsPath: absoluteWasmJsPath, wasmWasmPath: absoluteWasmWasmPath }});
            initPromises.push(promise);
        }
        try {
            await Promise.all(initPromises);
            this.emit('log', `${this.#idleWorkers.length} workers initialized and ready.`);
        } catch (error) {
            this.emit('error', "Worker pool initialization failed.");
            console.error("Worker pool init failed:", error);
            throw error;
        }
    }

    #handleWorkerMessage(e) {
        const { type, payload } = e.data;
        const worker = e.target;
        if (type === 'stats_complete') {
            const { stats, bands, isInitial } = payload;
            for (const band of bands) { if (stats[band]) { this.#bandStatsCache.set(band, stats[band]); } }
            this.#idleWorkers.push(worker);
            if (isInitial) {
                this.#globalStats = {};
                [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b].forEach(b => {
                    if (this.#bandStatsCache.has(b)) { this.#globalStats[b] = this.#bandStatsCache.get(b); }
                });
                this.emit('log', `Initial statistics calculation completed: ${JSON.stringify(this.#globalStats)}`);
                const setupAndDraw = () => {
                    this.#setInitialViewAndDraw();
                    this.emit('loadend');
                    this.emit('statechange', { loading: false });
                };
                if (!this.#pipeline) { this.#createPipeline().then(setupAndDraw); }
                else { setupAndDraw(); }
                this.#startBackgroundStatCalculation();
            } else {
                if (!this.#isTransitioning && this.#isWaitingForStats) {
                    const neededBands = [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b];
                    const isNowReady = neededBands.every(b => this.#bandStatsCache.has(b));
                    if (isNowReady) {
                        this.emit('log', "Requested band statistics computed; starting smooth transition...");
                        this.#isWaitingForStats = false; 
                        this.#globalStats = {};
                        neededBands.forEach(b => this.#globalStats[b] = this.#bandStatsCache.get(b));
                        this.#startTransition();
                    }
                }
            }
            this.#processBackgroundStatsQueue();
        } 
        else if (type === 'tile_complete') {
            if (!payload || !payload.bands) {
                this.emit('log', `[ERROR] Received malformed tile payload; discarded. Payload: ${JSON.stringify(payload)}`);
                this.#idleWorkers.push(worker); this.#processTileRequestQueue(); this.#processPreloadQueue(); return; 
            }
            const tileBands = payload.bands;
            if (parseInt(tileBands[0], 10) !== this.#currentBands.r || parseInt(tileBands[1], 10) !== this.#currentBands.g || parseInt(tileBands[2], 10) !== this.#currentBands.b) {
                this.emit('log', `Discarded stale tile (requested bands: ${tileBands.join(',')}, current bands: ${this.#currentBands.r},${this.#currentBands.g},${this.#currentBands.b})`);
                this.#idleWorkers.push(worker); this.#processTileRequestQueue(); this.#processPreloadQueue(); return;
            }
            const tileKey = `${payload.tile.x},${payload.tile.y}`;
            const resource = this.#createTileResources(payload); 
            if (this.#isTransitioning) {
                this.#newTileCache.set(tileKey, resource);
                this.#transitionTileCounter--;
                if (this.#transitionTileCounter === 0) {
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
                    this.#canvas.style.opacity = '0';
                    setTimeout(() => {
                        this.#tileCache = this.#newTileCache;
                        this.#newTileCache = null;
                        this.#isTransitioning = false;
                        requestAnimationFrame(() => this.#updateAndDraw());
                        this.emit('statechange', { loading: false });
                        setTimeout(() => this.#canvas.style.opacity = '1', 20);
                    }, 200);
                }
            } else {
                this.#tileCache.set(tileKey, resource);
                if (this.#performance.isInitialLoading) {
                    if (this.#performance.initialVisibleTiles.has(tileKey)) {
                        this.#performance.completedInitialTiles.add(tileKey);
                        this.#checkInitialViewCompletion();
                    }
                }
                requestAnimationFrame(() => this.#updateAndDraw());
            }
            this.#idleWorkers.push(worker);
            this.#processTileRequestQueue();
            this.#processPreloadQueue();
        } 
        else if (type === 'spectrum_complete') {
            const { requestId, spectrum } = payload;
            const resolver = this.#pendingSpectrumResolvers.get(requestId);
            if (resolver) {
                resolver.resolve(new Float32Array(spectrum));
                this.#pendingSpectrumResolvers.delete(requestId);
            }
            this.#idleWorkers.push(worker);
        }
        else if (type === 'spectrum_error') {
            const { requestId, message } = payload;
            const resolver = this.#pendingSpectrumResolvers.get(requestId);
            if (resolver) {
                resolver.reject(new Error(message || 'Spectrum error'));
                this.#pendingSpectrumResolvers.delete(requestId);
            }
            this.#idleWorkers.push(worker);
        }
        else if (type === 'tile_error') {
            if (this.#isTransitioning) {
                 this.#transitionTileCounter--;
                 if (this.#transitionTileCounter === 0) {
                    this.#canvas.style.opacity = '0';
                    setTimeout(() => {
                        this.#tileCache = this.#newTileCache;
                        this.#newTileCache = null;
                        this.#isTransitioning = false;
                        requestAnimationFrame(() => this.#updateAndDraw());
                        this.emit('statechange', { loading: false });
                        setTimeout(() => this.#canvas.style.opacity = '1', 20);
                    }, 200);
                 }
            }
            const { tile, message } = payload;
            const tileKey = `${tile.x},${tile.y}`;
            this.emit('log', `Worker failed to load tile (${tileKey}) : ${message || 'Unknown error'}`);
            this.#tileCache.delete(tileKey);
            this.#idleWorkers.push(worker);
            this.#processTileRequestQueue();
            this.#processPreloadQueue();
        }
    }

    #dispatchStatsCalculation(bands, isInitial = false) {
        if (this.#idleWorkers.length > 0) {
            const worker = this.#idleWorkers.pop();
            worker.postMessage({ type: 'calculate_stats', payload: { hdrBytes: this.#hdrBytes, imgFile: this.#imgFile, bands, header: this.#header, isInitial } });
        } else {
            if (!isInitial) {
                this.emit('log', "No idle worker; task queued for background.");
                bands.forEach(b => { if (!this.#backgroundStatsQueue.includes(b)) this.#backgroundStatsQueue.unshift(b); });
            } else {
                this.emit('error', "No available worker for initial stats task!");
            }
        }
    }
    
    #startTransition() {
        if (this.#isTransitioning) return;
        this.emit('statechange', { loading: true, message: 'Switching bands...' });
        this.#isTransitioning = true;
        this.#newTileCache = new Map();
        const visibleTiles = this.#calculateVisibleTiles();
        this.#transitionTileCounter = visibleTiles.length;
        if (this.#transitionTileCounter === 0) {
            this.#isTransitioning = false;
            this.#tileCache.clear();
            requestAnimationFrame(() => this.#updateAndDraw());
            this.emit('statechange', { loading: false });
            return;
        }
        for (const tile of visibleTiles) {
            const worker = this.#idleWorkers.pop();
            if (worker) {
                 const bandsPayload = [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b];
                console.log(`[主线程-1-发送任务] (过渡) tile: (${tile.x}, ${tile.y}), bands:`, bandsPayload);
                worker.postMessage({ type: 'load_tile', payload: { hdrBytes: this.#hdrBytes, imgFile: this.#imgFile, tile, bands: bandsPayload, globalStats: this.#globalStats, header: this.#header } });
            } else {
                this.#transitionTileCounter--; 
                this.#tileRequestQueue.set(`${tile.x},${tile.y}`, { tile });
            }
        }
        this.#isPreloading = false;
        this.#preloadQueue = [];
    }

    #startBackgroundStatCalculation() {
        if (!this.#config?.backgroundStats) { 
            this.emit('log', '后台统计功能已关闭。');
            return; 
        }
        this.#backgroundStatsQueue = [];
        for (let i = 1; i <= this.#header.bands; i++) {
            if (!this.#bandStatsCache.has(i)) {
                this.#backgroundStatsQueue.push(i);
            }
        }
        this.#totalBandsForStats = this.#backgroundStatsQueue.length;
        if (this.#totalBandsForStats === 0) {
            this.emit('log', `所有波段统计值已在缓存中，无需后台计算。`);
            return;
        }
        this.emit('log', `开始后台统计... 队列中有 ${this.#backgroundStatsQueue.length} 个波段待处理。`);
        this.#processBackgroundStatsQueue();
    }

    #processBackgroundStatsQueue() {
        if (this.#isTransitioning) return;
        if (this.#idleWorkers.length > 0 && this.#backgroundStatsQueue.length > 0) {
            const total = this.#totalBandsForStats;
            const remaining = this.#backgroundStatsQueue.length - 1;
            const processed = total - remaining;
            const progressPercent = total > 0 ? (processed / total) * 100 : 0;
            this.emit('progress', { type: 'stats_calculation', processed, total, progress: progressPercent });
            const worker = this.#idleWorkers.pop();
            const bandToProcess = this.#backgroundStatsQueue.shift();
            worker.postMessage({ type: 'calculate_stats', payload: { hdrBytes: this.#hdrBytes, imgFile: this.#imgFile, bands: [bandToProcess], header: this.#header, isInitial: false } });
        }
    }

    async #createPipeline() {
        this.#sampler = this.#device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        const shaderModule = this.#device.createShaderModule({ code: `
            struct TileUniforms { scale: vec2<f32>, offset: vec2<f32> };
            @group(0) @binding(0) var mySampler: sampler; @group(0) @binding(1) var myTexture: texture_2d<f32>;
            @group(0) @binding(2) var<uniform> uniforms: TileUniforms;
            struct VSOutput { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
            @vertex fn vs(@builtin(vertex_index) idx: u32) -> VSOutput {
                var pos = array<vec2<f32>,6>(vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));
                var out: VSOutput;
                out.pos = vec4(pos[idx] * uniforms.scale + uniforms.offset, 0.0, 1.0);
                out.uv = pos[idx] * vec2(0.5, -0.5) + 0.5;
                return out;
            }
            @fragment fn fs(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
                return textureSample(myTexture, mySampler, uv);
            }`
        });
        this.#pipeline = this.#device.createRenderPipeline({ layout: 'auto', vertex: { module: shaderModule, entryPoint: 'vs' }, fragment: { module: shaderModule, entryPoint: 'fs', targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }] } });
        this.emit('log', "WebGPU 渲染管线创建成功。");
    }

    #createTileResources({ pixels, effectiveWidth, effectiveHeight, tile }) {
        const tileTexture = this.#device.createTexture({ size: [effectiveWidth, effectiveHeight], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        this.#device.queue.writeTexture({ texture: tileTexture }, pixels, { bytesPerRow: effectiveWidth * 4 }, [effectiveWidth, effectiveHeight]);
        const { x: aspectX, y: aspectY } = this.#getAspectRatioCorrection();
        const tileScaleX = (effectiveWidth / this.#header.samples) * aspectX;
        const tileScaleY = (effectiveHeight / this.#header.lines) * aspectY;
        const tileOffsetX = ((tile.x * this.#TILE_SIZE + effectiveWidth / 2) / this.#header.samples * 2 - 1) * aspectX;
        const tileOffsetY = ((tile.y * this.#TILE_SIZE + effectiveHeight / 2) / this.#header.lines * -2 + 1) * aspectY;
        const uniformData = new Float32Array([tileScaleX, tileScaleY, tileOffsetX, tileOffsetY]);
        const uniformBuffer = this.#device.createBuffer({ size: uniformData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.#device.queue.writeBuffer(uniformBuffer, 0, uniformData);
        const bindGroup = this.#device.createBindGroup({ layout: this.#pipeline.getBindGroupLayout(0), entries: [ { binding: 0, resource: this.#sampler }, { binding: 1, resource: tileTexture.createView() }, { binding: 2, resource: { buffer: uniformBuffer } } ] });
        return { bindGroup, uniformBuffer, uniformData };
    }
    
    #processTileRequestQueue() {
        if (this.#isTransitioning) return;
        while (this.#idleWorkers.length > 0 && this.#tileRequestQueue.size > 0) {
            const tileKey = this.#tileRequestQueue.keys().next().value;
            const { tile } = this.#tileRequestQueue.get(tileKey);
            this.#tileRequestQueue.delete(tileKey);
            const worker = this.#idleWorkers.pop();
            const bandsPayload = [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b];
            console.log(`[主线程-1-发送任务] tile: (${tile.x}, ${tile.y}), bands:`, bandsPayload);
            worker.postMessage({ type: 'load_tile', payload: { hdrBytes: this.#hdrBytes, imgFile: this.#imgFile, tile, bands: bandsPayload, globalStats: this.#globalStats, header: this.#header } });
        }
    }

    #updateAndDraw() {
        if (!this.#header || !this.#device || !this.#pipeline || !this.#globalStats) return;
        const visibleTiles = this.#calculateVisibleTiles();
        if (this.#performance.isInitialLoading && this.#performance.initialVisibleTiles.size === 0 && visibleTiles.length > 0) {
            this.#performance.initialVisibleTiles = new Set(visibleTiles.map(t => `${t.x},${t.y}`));
        }
        const commandEncoder = this.#device.createCommandEncoder();
        const textureView = this.#context.getCurrentTexture().createView();
        const renderPass = commandEncoder.beginRenderPass({ colorAttachments: [{ view: textureView, loadOp: this.#isTransitioning ? 'load' : 'clear', storeOp: 'store', clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 } }] });
        renderPass.setPipeline(this.#pipeline);
        let needsLoad = false;
        for (const tile of visibleTiles) {
            const tileKey = `${tile.x},${tile.y}`;
            const cachedData = this.#tileCache.get(tileKey);
            if (cachedData && cachedData !== this.#TILE_RENDERING_KEY) {
                const {bindGroup, uniformBuffer, uniformData} = cachedData;
                const finalOffsetX = uniformData[2] * this.#scale + this.#offsetX;
                const finalOffsetY = uniformData[3] * this.#scale + this.#offsetY;
                const finalScaleX = uniformData[0] * this.#scale;
                const finalScaleY = uniformData[1] * this.#scale;
                this.#device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([finalScaleX, finalScaleY, finalOffsetX, finalOffsetY]));
                renderPass.setBindGroup(0, bindGroup);
                renderPass.draw(6);
            } else if (!cachedData && !this.#isTransitioning) {
                this.#tileCache.set(tileKey, this.#TILE_RENDERING_KEY);
                this.#tileRequestQueue.set(tileKey, { tile });
                needsLoad = true;
            }
        }
        renderPass.end();
        this.#device.queue.submit([commandEncoder.finish()]);
        if (needsLoad) { this.#processTileRequestQueue(); }
        if (!this.#isPreloading && this.#tileRequestQueue.size === 0 && this.#preloadQueue.length > 0) { this.#processPreloadQueue(); }
    }
    
    #calculateVisibleTiles() {
        if (!this.#header || !this.#canvas.clientWidth || !this.#canvas.clientHeight) return [];
        const iW = this.#header.samples; const iH = this.#header.lines;
        const { x: aX, y: aY } = this.#getAspectRatioCorrection();
        const vL = (-1 - this.#offsetX) / this.#scale; const vR = (1 - this.#offsetX) / this.#scale; 
        const vT = (1 - this.#offsetY) / this.#scale; const vB = (-1 - this.#offsetY) / this.#scale;
        const u_s = (vL / aX + 1) / 2; const u_e = (vR / aX + 1) / 2; 
        const v_s = (vT / -aY + 1) / 2; const v_e = (vB / -aY + 1) / 2;
        const mTX = Math.ceil(iW / this.#TILE_SIZE); const mTY = Math.ceil(iH / this.#TILE_SIZE);
        const sTX = Math.max(0, Math.floor(u_s * iW / this.#TILE_SIZE)); 
        const eTX = Math.min(mTX, Math.ceil(u_e * iW / this.#TILE_SIZE));
        const sTY = Math.max(0, Math.floor(v_s * iH / this.#TILE_SIZE));
        const eTY = Math.min(mTY, Math.ceil(v_e * iH / this.#TILE_SIZE));
        const tiles = [];
        for (let y = sTY; y < eTY; y++) { for (let x = sTX; x < eTX; x++) { tiles.push({ x, y }); } }
        return tiles;
    }
    
    #setInitialViewAndDraw() {
        const MAX_INITIAL_DIM = 2048;
        const initialViewWidth = Math.min(this.#header.samples, MAX_INITIAL_DIM);
        const initialViewHeight = Math.min(this.#header.lines, MAX_INITIAL_DIM);
        const scaleX = this.#header.samples / initialViewWidth;
        const scaleY = this.#header.lines / initialViewHeight;
        this.#scale = Math.max(scaleX, scaleY);
        this.#offsetX = 0;
        this.#offsetY = 0;
        this.emit('log', `Setting initial focused view: scale ${this.#scale.toFixed(2)}x`);
        requestAnimationFrame(() => this.#updateAndDraw());
        setTimeout(() => this.#startPreloading(), 500);
    }

    #startPreloading() {
        if (!this.#config?.tilePreloading) {
            this.emit('log', 'Tile preloading is disabled.');
            return;
        }
        if (this.#isPreloading || !this.#header || !this.#globalStats) return;
        this.#isPreloading = true;
        this.#preloadQueue = [];
        const maxTileX = Math.ceil(this.#header.samples / this.#TILE_SIZE);
        const maxTileY = Math.ceil(this.#header.lines / this.#TILE_SIZE);
        const visibleTiles = this.#calculateVisibleTiles();
        const visibleSet = new Set(visibleTiles.map(t => `${t.x},${t.y}`));
        const centerX = Math.floor((visibleTiles.reduce((sum, t) => sum + t.x, 0) / visibleTiles.length) || 0);
        const centerY = Math.floor((visibleTiles.reduce((sum, t) => sum + t.y, 0) / visibleTiles.length) || 0);
        for (let y = 0; y < maxTileY; y++) {
            for (let x = 0; x < maxTileX; x++) {
                const tileKey = `${x},${y}`;
                if (!visibleSet.has(tileKey) && !this.#tileCache.has(tileKey)) {
                    const dist = Math.abs(x - centerX) + Math.abs(y - centerY);
                    this.#preloadQueue.push({ tile: { x, y }, dist });
                }
            }
        }
        this.#preloadQueue.sort((a, b) => a.dist - b.dist);
        this.emit('log', `Starting smart preloading: ${this.#preloadQueue.length} tiles queued for background loading.`);
        this.#processPreloadQueue();
    }

    #processPreloadQueue() {
        if (!this.#isPreloading || this.#isTransitioning) return;
        while (this.#idleWorkers.length > 0 && this.#preloadQueue.length > 0 && this.#tileRequestQueue.size === 0) {
            const { tile } = this.#preloadQueue.shift();
            const tileKey = `${tile.x},${tile.y}`;
            if (!this.#tileCache.has(tileKey)) {
                this.#tileCache.set(tileKey, this.#TILE_RENDERING_KEY);
                const worker = this.#idleWorkers.pop();
                const bandsPayload = [this.#currentBands.r, this.#currentBands.g, this.#currentBands.b];
                 console.log(`[主线程-1-发送任务] (预加载) tile: (${tile.x}, ${tile.y}), bands:`, bandsPayload);
                worker.postMessage({ type: 'load_tile', payload: { hdrBytes: this.#hdrBytes, imgFile: this.#imgFile, tile, bands: bandsPayload, globalStats: this.#globalStats, header: this.#header } });
            }
        }
        if (this.#preloadQueue.length === 0 && this.#isPreloading) {
            this.#isPreloading = false;
            this.emit('log', "All tile preloads completed.");
        }
    }

    #getAspectRatioCorrection() {
        if (!this.#header || !this.#canvas.clientWidth || !this.#canvas.clientHeight) return { x: 1.0, y: 1.0 };
        const imageAspect = this.#header.samples / this.#header.lines;
        const canvasAspect = this.#canvas.clientWidth / this.#canvas.clientHeight;
        let aspectX = 1.0, aspectY = 1.0;
        if (imageAspect > canvasAspect) {
            aspectY = canvasAspect / imageAspect;
        } else {
            aspectX = imageAspect / canvasAspect;
        }
        return { x: aspectX, y: aspectY };
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
}