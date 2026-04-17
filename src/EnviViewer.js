/**
 * @fileoverview
 * EN: Core file for the EnviViewer library. It defines the main EnviViewer class,
 *     which encapsulates all functionality for loading, rendering, and interacting
 *     with ENVI-format hyperspectral images.
 * ZH: EnviViewer 库的核心文件。它定义了主要的 EnviViewer 类，该类封装了
 *     加载、渲染和交互 ENVI 格式高光谱图像的所有功能。
 */

import { EnviViewer as InternalEnviViewer } from './lib/hsi-wasm.js';

/**
 * EN: A simple event emitter class.
 * ZH: 一个简单的事件发射器类。
 */
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(eventName, listener) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(listener);
    }

    emit(eventName, ...args) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(listener => listener(...args));
        }
    }

    off(eventName, listener) {
        if (this.events[eventName]) {
            this
                .events[eventName] = this
                .events[eventName]
                .filter(l => l !== listener);
        }
    }
}

/**
 * EN: The main class for the ENVI Viewer library.
 * ZH: ENVI 查看器库的主类。
 */
export default class EnviViewer extends EventEmitter {
    #internalViewer;
    #canvas;
    #container;
    #options;
    #header;

    /**
     * EN: Creates an instance of EnviViewer.
     * ZH: 创建 EnviViewer 的实例。
     * @param {HTMLElement} container The HTML element to render the viewer into.
     * @param {object} options Configuration options.
     * @param {string} options.workerUrl Path to the worker.js file.
     * @param {string} options.wasmJsUrl Path to the wasm-bindgen generated JS file.
     * @param {string} options.wasmWasmUrl Path to the .wasm file.
     */
    constructor(container, options = {}) {
        super();
        if (!container) {
            throw new Error('A container element must be provided.');
        }
        this.#container = container;
        this.#options = options;

        this.#canvas = document.createElement('canvas');
        this.#canvas.style.width = '100%';
        this.#canvas.style.height = '100%';
        this.#container.appendChild(this.#canvas);

        this.#internalViewer = new InternalEnviViewer(this.#canvas, {
            wasmJsPath: this.#options.wasmJsUrl,
            wasmWasmPath: this.#options.wasmWasmUrl,
            workerPath: this.#options.workerUrl,
            enableBackgroundStats: this.#options.enableBackgroundStats ?? true,
            enableTilePreloading: this.#options.enableTilePreloading ?? true
        });

        this.#attachInternalListeners();
    }

    /**
     * EN: Attaches listeners to the internal viewer instance to propagate events.
     * ZH: 将监听器附加到内部查看器实例以传播事件。
     */
    #attachInternalListeners() {
        this.#internalViewer.on('log', (msg) => this.emit('log', msg));
        this.#internalViewer.on('error', (errMsg) => this.emit('error', errMsg));
        this.#internalViewer.on('ready', () => this.emit('ready'));
        this.#internalViewer.on('loadstart', () => this.emit('loadstart'));
        this.#internalViewer.on('loadend', () => this.emit('loadend'));
        this.#internalViewer.on('statechange', (state) => this.emit('statechange', state));
        this.#internalViewer.on('headerloaded', (header) => {
            this.#header = header;
            this.emit('headerloaded', header);
        });
        this.#internalViewer.on('progress', (data) => this.emit('progress', data));
        this.#internalViewer.on('image-clicked', (data) => this.emit('image-clicked', data));
    }

    /**
     * EN: Initializes the viewer and its WebAssembly module. Must be called before other methods.
     * ZH: 初始化查看器及其 WebAssembly 模块。必须在其他方法之前调用。
     * @returns {Promise<void>}
     */
    async init() {
        await this.#internalViewer.init();
    }

    /**
     * EN: Loads an ENVI file from a .hdr and a data file.
     * ZH: 从 .hdr 和数据文件加载 ENVI 文件。
     * @param {File} hdrFile The .hdr file.
     * @param {File} dataFile The corresponding data file (e.g., .dat, .img, .bil).
     * @returns {Promise<void>}
     */
    async loadFile(hdrFile, dataFile) {
        if (!hdrFile || !dataFile) {
            throw new Error('Both a .hdr file and a data file must be provided.');
        }
        await this.#internalViewer.load(hdrFile, dataFile);
    }

    /**
     * EN: Sets the RGB bands to be displayed.
     * ZH: 设置要显示的 RGB 波段。
     * @param {{r: number, g: number, b: number}} bands An object with r, g, and b band numbers.
     */
    setBands(bands) {
        this.#internalViewer.setBands(bands);
    }

    /**
     * EN: Gets the header information of the loaded file.
     * ZH: 获取加载文件的头信息。
     * @returns {object|null} The header object, or null if no file is loaded.
     */
    getHeader() {
        return this.#header;
    }

    /**
     * EN: Gets the spectral profile for a given pixel coordinate.
     * ZH: 获取给定像素坐标的光谱剖面。
     * @param {number} x The x-coordinate.
     * @param {number} y The y-coordinate.
     * @returns {Promise<Float32Array|null>} A promise that resolves to the spectral data.
     */
    getSpectralProfile(x, y) {
        return this.#internalViewer.getSpectralProfile(x, y);
    }

    /**
     * EN: Destroys the viewer instance, cleans up resources, and removes the canvas.
     * ZH: 销毁查看器实例，清理资源并移除画布。
     */
    destroy() {
        this.#internalViewer.destroy();
        if (this.#container && this.#canvas) {
            this.#container.removeChild(this.#canvas);
        }
        this.events = {}; // Clear all event listeners
    }
}