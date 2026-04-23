/**
 * @fileoverview
 * EN: Public wrapper for the CubeScope viewer. It defines the main CubeViewer class,
 *     which encapsulates loading, rendering, and interaction for spectral cubes.
 * ZH: CubeScope 查看器的公共包装层。它定义了主要的 CubeViewer 类，
 *     封装了光谱立方体的加载、渲染与交互能力。
 */

import { ViewerRuntime } from './runtime/viewer-runtime.js';
import { LoadSourceKind, normalizeLoadSource } from './sources/load-source.js';
import {
    pixelToWorld as mapPixelToWorld,
    worldToPixel as mapWorldToPixel,
} from './spatial/coordinate-mapper.js';

function isPackagedModuleUrl(moduleUrl) {
    return /\/dist\/[^/]+$/.test(moduleUrl) || moduleUrl.endsWith('/cubescope.es.js');
}

function resolveRuntimeAssetUrl({ sourcePath, distPath }) {
    return new URL(
        isPackagedModuleUrl(import.meta.url) ? distPath : sourcePath,
        import.meta.url
    ).href;
}

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
 * EN: The main public CubeScope viewer class.
 * ZH: CubeScope 的公共查看器主类。
 */
class CubeViewer extends EventEmitter {
    #internalViewer;
    #canvas;
    #container;
    #options;
    #header;

    /**
     * EN: Creates an instance of CubeViewer.
     * ZH: 创建 CubeViewer 的实例。
     * @param {HTMLElement} container The HTML element to render the viewer into.
     * @param {object} options Configuration options.
     * @param {string} options.workerUrl Path to the viewer worker file.
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

        this.#internalViewer = new ViewerRuntime(this.#canvas, {
            wasmJsPath: this.#options.wasmJsUrl ?? resolveRuntimeAssetUrl({
                sourcePath: './runtime/pkg/envi_parser.js',
                distPath: './pkg/envi_parser.js',
            }),
            wasmWasmPath: this.#options.wasmWasmUrl ?? resolveRuntimeAssetUrl({
                sourcePath: './runtime/pkg/envi_parser_bg.wasm',
                distPath: './pkg/envi_parser_bg.wasm',
            }),
            workerPath: this.#options.workerUrl ?? resolveRuntimeAssetUrl({
                sourcePath: './runtime/viewer-worker.js',
                distPath: './worker.js',
            }),
            enableBackgroundStats: this.#options.enableBackgroundStats ?? true,
            enableTilePreloading: this.#options.enableTilePreloading ?? true,
            rendererPreference: this.#options.rendererPreference ?? 'auto',
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
            this.emit('header', header);
        });
        this.#internalViewer.on('metadata', (data) => this.emit('metadata', data));
        this.#internalViewer.on('bandschanged', (bands) => {
            this.emit('bandschanged', bands);
            this.emit('bandschange', bands);
        });
        this.#internalViewer.on('progress', (data) => this.emit('progress', data));
        this.#internalViewer.on('image-clicked', (data) => this.emit('image-clicked', data));
        this.#internalViewer.on('performance', (data) => this.emit('performance', data));
        this.#internalViewer.on('destroyed', () => this.emit('destroyed'));
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
     * EN: Loads an ENVI source through the stable source-based API.
     * ZH: 通过稳定的 source API 加载 ENVI 数据源。
     * @param {{
     *   kind: 'envi-local',
     *   headerFile: File,
     *   dataFile: File
     * } | {
     *   kind: 'envi-http',
     *   headerUrl: string,
     *   dataUrl: string,
     *   headers?: Record<string, string>
     * }} source The load source definition.
     * @returns {Promise<void>}
     */
    async load(source) {
        const normalizedSource = normalizeLoadSource(source);
        await this.#internalViewer.load(normalizedSource);
    }

    /**
     * EN: Legacy convenience alias for loading a local ENVI file pair.
     * ZH: 为本地 ENVI 文件对保留的兼容性便捷别名。
     * @param {File} hdrFile The .hdr file.
     * @param {File} dataFile The corresponding data file (e.g., .dat, .img, .bil).
     * @returns {Promise<void>}
     */
    async loadFile(hdrFile, dataFile) {
        await this.load({
            kind: LoadSourceKind.ENVI_LOCAL,
            headerFile: hdrFile,
            dataFile
        });
    }

    /**
     * EN: Unloads the active source and releases source-scoped resources.
     * ZH: 卸载当前数据源并释放与数据源绑定的资源。
     * @returns {Promise<void>}
     */
    async unload() {
        this.#header = null;
        await this.#internalViewer.unload();
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
     * EN: Updates runtime viewer configuration using the stable wrapper surface.
     * ZH: 通过稳定的包装层接口更新运行时配置。
     * @param {object} config Partial runtime configuration.
     */
    updateConfig(config = {}) {
        this.#internalViewer.updateConfig(config);
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
     * EN: Maps a zero-based image pixel coordinate into source world coordinates when affine metadata exists.
     * ZH: 当存在仿射空间元数据时，将零基影像像素坐标映射为源数据世界坐标。
     * @param {number} x The zero-based image x coordinate.
     * @param {number} y The zero-based image y coordinate.
     * @returns {{x: number, y: number} | null} The mapped world coordinate, or null when unavailable.
     */
    pixelToWorld(x, y) {
        if (!this.#header) {
            return null;
        }

        return this.#internalViewer.pixelToWorld?.(x, y)
            ?? mapPixelToWorld(this.#header, x, y);
    }

    /**
     * EN: Maps a world coordinate back into zero-based image pixel space when affine metadata exists.
     * ZH: 当存在仿射空间元数据时，将世界坐标反向映射回零基影像像素空间。
     * @param {number} x The world x coordinate.
     * @param {number} y The world y coordinate.
     * @returns {{x: number, y: number} | null} The mapped pixel coordinate, or null when unavailable.
     */
    worldToPixel(x, y) {
        if (!this.#header) {
            return null;
        }

        return this.#internalViewer.worldToPixel?.(x, y)
            ?? mapWorldToPixel(this.#header, x, y);
    }

    /**
     * EN: Destroys the viewer instance, cleans up resources, and removes the canvas.
     * ZH: 销毁查看器实例，清理资源并移除画布。
     */
    destroy() {
        this.#header = null;
        this.#internalViewer.destroy();
        if (this.#container && this.#canvas) {
            this.#container.removeChild(this.#canvas);
        }
        this.events = {}; // Clear all event listeners
    }
}

export { CubeViewer, CubeViewer as EnviViewer };
export default CubeViewer;
