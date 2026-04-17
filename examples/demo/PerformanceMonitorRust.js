/**
 * @fileoverview
 * EN: Establishes a WebSocket connection to a Rust backend for performance monitoring.
 *     Emits events on status changes and statistics updates, and handles auto-reconnection.
 * ZH: 建立到 Rust 后端的 WebSocket 连接以进行性能监控。
 *     在状态更改和统计信息更新时发出事件，并处理自动重新连接。
 */

/**
 * EN: A simple event emitter class to handle custom events.
 * ZH: 一个简单的事件发射器类，用于处理自定义事件。
 */
class EventEmitter {
    constructor() { this.events = {}; }
    on(eventName, listener) { if (!this.events[eventName]) { this.events[eventName] = []; } this.events[eventName].push(listener); }
    emit(eventName, ...args) { if (this.events[eventName]) { this.events[eventName].forEach(listener => listener(...args)); } }
}

/**
 * EN: Manages the WebSocket connection to the Rust performance monitoring backend.
 * ZH: 管理到 Rust 性能监控后端的 WebSocket 连接。
 */
export class PerformanceMonitorRust extends EventEmitter {
    // --- (EN) Private Fields / (ZH) 私有字段 ---
    #ws = null;                         // EN: The WebSocket instance. / ZH: WebSocket 实例。
    #isConnected = false;               // EN: Flag indicating if the WebSocket is connected. / ZH: 指示 WebSocket 是否已连接的标志。
    #url = "ws://127.0.0.1:9001";       // EN: The URL of the WebSocket server. / ZH: WebSocket 服务器的 URL。
    #reconnectInterval = 5000;          // EN: Time in milliseconds to wait before trying to reconnect. / ZH: 尝试重新连接前等待的时间（毫秒）。

    /**
     * EN: Constructs the PerformanceMonitorRust instance.
     * ZH: 构建 PerformanceMonitorRust 实例。
     */
    constructor() {
        super();
    }

    /**
     * EN: Starts the connection process.
     * ZH: 启动连接过程。
     */
    start() {
        this.#connect();
    }

    /**
     * EN: Establishes the WebSocket connection and sets up event handlers.
     * ZH: 建立 WebSocket 连接并设置事件处理程序。
     */
    #connect() {
        this.#ws = new WebSocket(this.#url);

        // EN: Handle successful connection.
        // ZH: 处理连接成功。
        this.#ws.onopen = () => {
            this.#isConnected = true;
            console.log("[PerfMon] Successfully connected to the Rust monitoring backend!");
            this.emit('statuschange', { connected: true, message: 'Monitor: Connected' });
        };

        // EN: Handle incoming messages with performance data.
        // ZH: 处理包含性能数据的传入消息。
        this.#ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.emit('statsupdate', data);
        };

        // EN: Handle connection closure and schedule reconnection.
        // ZH: 处理连接关闭并安排重新连接。
        this.#ws.onclose = () => {
            if (this.#isConnected) {
                console.warn(`[PerfMon] Connection to the Rust backend lost. Reconnecting in ${this.#reconnectInterval / 1000} seconds...`);
            }
            this.#isConnected = false;
            this.emit('statuschange', { connected: false, message: 'Monitor: Disconnected' });
            setTimeout(() => this.#connect(), this.#reconnectInterval);
        };

        // EN: Handle connection errors.
        // ZH: 处理连接错误。
        this.#ws.onerror = (error) => {
            this.#isConnected = false;
            this.emit('statuschange', { connected: false, message: 'Monitor: Error' });
        };
    }
}