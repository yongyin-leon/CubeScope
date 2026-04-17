// system-monitor-panel.js

/**
 * @fileoverview
 * EN: Displays system performance metrics from a monitor, captures baseline and peak data,
 *     and provides historical data for analysis.
 * ZH: 显示来自监视器的系统性能指标，捕获基线和峰值数据，并提供历史数据用于分析。
 */

export class SystemMonitorPanel {
    // --- (EN) Private Fields / (ZH) 私有字段 ---
    #monitor = null;                // EN: The performance monitor instance. / ZH: 性能监视器实例。
    #container = null;              // EN: The main container element for the panel. / ZH: 面板的主容器元素。
    #statusEl = null;               // EN: Element to display connection status. / ZH: 用于显示连接状态的元素。
    #globalTableEl = null;          // EN: Element to display global metrics. / ZH: 用于显示全局指标的元素。
    #processTableEl = null;         // EN: Element to display process-specific metrics. / ZH: 用于显示特定进程指标的元素。
    #baselineData = null;           // EN: Baseline metrics captured before data loading. / ZH: 数据加载前捕获的基线指标。
    #peakData = null;               // EN: Peak metrics captured after data loading starts. / ZH: 数据加载开始后捕获的峰值指标。
    #currentData = null;            // EN: The most recent metrics data received. / ZH: 接收到的最新指标数据。
    #baselineCaptured = false;      // EN: Flag indicating if baseline data has been captured. / ZH: 指示是否已捕获基线数据的标志。
    #captureAttempts = 0;           // EN: Counter for attempts to capture the baseline. / ZH: 捕获基线的尝试次数计数器。
    #viewer = null;                 // EN: Reference to the main viewer. / ZH: 对主查看器的引用。
    #viewerBusy = false;            // EN: Busy state tracked from public viewer events. / ZH: 基于公开事件跟踪的忙碌状态。
    #peakTrackingStarted = false;   // EN: Flag indicating if peak metric tracking has begun. / ZH: 指示是否已开始峰值指标跟踪的标志。
    #chartCallback = null;          // EN: Callback function to update an external chart. / ZH: 用于更新外部图表的回调函数。
    #historyData = [];              // EN: Stores a history of performance data records. / ZH: 存储性能数据记录的历史。

    /**
     * EN: Constructs the SystemMonitorPanel.
     * ZH: 构建 SystemMonitorPanel。
     * @param {object} monitor - The performance monitor instance.
     * @param {string} containerElementId - The ID of the DOM element for this panel.
     * @param {object} viewer - Reference to the main viewer application.
     */
    constructor(monitor, containerElementId = 'systemMonitorPanel', viewer = null) {
        this.#monitor = monitor;
        this.#container = document.getElementById(containerElementId);
        this.#viewer = viewer;  // Save viewer reference
        if (!this.#container) {
            console.error(`SystemMonitorPanel: Element with ID '${containerElementId}' not found.`);
            return;
        }
        this.#setupUI();
        this.#attachViewerListeners();
        this.#attachMonitorListeners();
    }

    /**
     * EN: Sets up the initial UI structure and styles for the panel.
     * ZH: 为面板设置初始 UI 结构和样式。
     */
    #setupUI() {
        // Maintain the original HTML structure, but adjust styles to fit the debug panel
        this.#container.innerHTML = `
            <div class="monitor-header" style="margin-bottom: 5px;">
                <span id="monitorStatus" style="font-size: 11px;">Connecting...</span>
            </div>
            <div id="monitorGlobalTable" class="monitor-table" style="margin-bottom: 5px;"></div>
            <div id="monitorProcessTable" class="monitor-table" style="display: none;"></div>
        `;
        this.#statusEl = this.#container.querySelector('#monitorStatus');
        this.#globalTableEl = this.#container.querySelector('#monitorGlobalTable');
        this.#processTableEl = this.#container.querySelector('#monitorProcessTable');
        
        // Add some styles to adapt to the debug panel
        const style = document.createElement('style');
        style.textContent = `
            .monitor-table table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
            }
            .monitor-table th, .monitor-table td {
                padding: 2px 4px;
                text-align: left;
                border-bottom: 1px solid #eee;
            }
            .monitor-table th {
                background-color: #f8f9fa;
                font-weight: bold;
            }
            #monitorStatus.status-connected {
                color: #28a745;
            }
            #monitorStatus.status-disconnected {
                color: #dc3545;
            }
            .metric-diff-positive {
                color: #dc3545; /* Red indicates increase */
            }
            .metric-diff-negative {
                color: #28a745; /* Green indicates decrease */
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * EN: Attaches listeners to the performance monitor for status and data updates.
     * ZH: 将监听器附加到性能监视器以获取状态和数据更新。
     */
    #attachMonitorListeners() {
        this.#monitor.on('statuschange', (status) => {
            this.#statusEl.textContent = status.message;
            this.#statusEl.className = `status-${status.connected ? 'connected' : 'disconnected'}`;
        });
        
        this.#monitor.on('statsupdate', (data) => {
            this.#currentData = data.global;
            this.#checkAndCaptureBaseline(data);
            this.#updateMetrics(data);
            
            // Record historical data
            this.#recordHistoryData(data);
            
            // Update chart data
            if (this.#chartCallback) {
                this.#chartCallback(data.global, this.#baselineData, this.#peakData);
            }
        });
    }

    /**
     * EN: Tracks viewer activity using public events only.
     * ZH: 仅通过公开事件跟踪查看器活动状态。
     */
    #attachViewerListeners() {
        if (!this.#viewer || typeof this.#viewer.on !== 'function') return;

        this.#viewer.on('loadstart', () => {
            this.#viewerBusy = true;
        });
        this.#viewer.on('loadend', () => {
            this.#viewerBusy = false;
        });
        this.#viewer.on('destroyed', () => {
            this.#viewerBusy = false;
        });
        this.#viewer.on('statechange', (state) => {
            this.#viewerBusy = Boolean(state?.loading);
        });
    }

    /**
     * EN: Records a snapshot of the current performance data.
     * ZH: 记录当前性能数据的快照。
     * @param {object} data - The performance data from the monitor.
     */
    #recordHistoryData(data) {
        const record = {
            timestamp: new Date().toISOString(),
            global: JSON.parse(JSON.stringify(data.global)),
            targetProcess: data.targetProcess ? JSON.parse(JSON.stringify(data.targetProcess)) : null,
            baseline: this.#baselineData ? JSON.parse(JSON.stringify(this.#baselineData)) : null,
            peak: this.#peakData ? JSON.parse(JSON.stringify(this.#peakData)) : null
        };
        
        this.#historyData.push(record);
        
        // Limit historical data count, keep at most 1000 records
        if (this.#historyData.length > 1000) {
            this.#historyData.shift();
        }
    }

    /**
     * EN: Returns the recorded historical data.
     * ZH: 返回记录的历史数据。
     * @returns {Array} - The array of historical data records.
     */
    getHistoryData() {
        return this.#historyData;
    }

    /**
     * EN: Checks conditions and captures baseline metrics if the system is idle.
     * ZH: 检查条件并在系统空闲时捕获基线指标。
     * @param {object} data - The performance data from the monitor.
     */
    #checkAndCaptureBaseline(data) {
        // If baseline data has already been captured, return directly
        if (this.#baselineCaptured) return;
        
        // Increase attempt count
        this.#captureAttempts++;
        
        // If attempt count exceeds 40 times (about 20 seconds), force capture
        if (this.#captureAttempts > 40) {
            console.log('[SystemMonitorPanel] Maximum attempts reached, forcing baseline data capture');
            this.captureBaseline();
            return;
        }
        
        // Determine whether to capture baseline data based on Worker status
        // Capture when current metrics data is available and CPU usage is low and no active Worker
        if (this.#currentData && this.#currentData.cpu_usage < 20) {
            // Check if there are active Workers
            const hasActiveWorkers = this.#isViewerBusy();
            
            if (!hasActiveWorkers) {
                // Delay 0.5 seconds to check again, ensuring the system is truly idle
                setTimeout(() => {
                    // Check CPU usage and Worker status again
                    if (this.#currentData && this.#currentData.cpu_usage < 20 && !this.#isViewerBusy() && !this.#baselineCaptured) {
                        console.log('[SystemMonitorPanel] System idle detected, capturing baseline data');
                        this.captureBaseline();
                    }
                }, 500);
            }
        }
    }

    /**
     * EN: Checks whether the viewer is currently busy based on public events.
     * ZH: 基于公开事件检查查看器当前是否处于忙碌状态。
     * @returns {boolean} - True if the viewer is busy, otherwise false.
     */
    #isViewerBusy() {
        return this.#viewerBusy;
    }

    /**
     * EN: Public method to manually trigger the capture of baseline data.
     * ZH: 公共方法，用于手动触发捕获基线数据。
     */
    captureBaseline() {
        if (this.#currentData && !this.#baselineCaptured) {
            this.#baselineData = JSON.parse(JSON.stringify(this.#currentData));
            this.#baselineCaptured = true;
            this.#peakTrackingStarted = true; // Start peak tracking
            console.log('[SystemMonitorPanel] Baseline data captured:', this.#baselineData);
            // Initialize peak data to baseline data
            this.#peakData = JSON.parse(JSON.stringify(this.#baselineData));
            // Update display
            this.#renderGlobalTable(this.#currentData);
        } else if (this.#baselineCaptured) {
            console.log('[SystemMonitorPanel] Baseline data already exists, no need to capture again');
        } else {
            console.warn('[SystemMonitorPanel] Unable to capture baseline data: current data is empty');
        }
    }

    /**
     * EN: Updates peak metrics and re-renders the display tables.
     * ZH: 更新峰值指标并重新渲染显示表。
     * @param {object} data - The performance data from the monitor.
     */
    #updateMetrics(data) {
        // Update peak data
        if (this.#peakTrackingStarted && this.#peakData) {
            // Update peak data in real-time (take maximum value)
            this.#peakData.cpu_usage = Math.max(this.#peakData.cpu_usage, data.global.cpu_usage);
            this.#peakData.memory_used_gb = Math.max(this.#peakData.memory_used_gb, data.global.memory_used_gb);
            if (data.global.gpu_usage != null && this.#peakData.gpu_usage != null) {
                this.#peakData.gpu_usage = Math.max(this.#peakData.gpu_usage, data.global.gpu_usage);
            }
            if (data.global.gpu_vram_used_gb != null && this.#peakData.gpu_vram_used_gb != null) {
                this.#peakData.gpu_vram_used_gb = Math.max(this.#peakData.gpu_vram_used_gb, data.global.gpu_vram_used_gb);
            }
        }
        
        this.#renderGlobalTable(data.global);
        this.#renderProcessTable(data.targetProcess);
    }

    /**
     * EN: Renders the table with global performance metrics.
     * ZH: 渲染包含全局性能指标的表。
     * @param {object} globalData - The global performance data.
     */
    #renderGlobalTable(globalData) {
        // Build pivot table format
        let html = `
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Baseline (Before Load)</th>
                    <th>Peak (After Load)</th>
                    <th>Current</th>
                    <th>Difference</th>
                </tr>`;
        
        // CPU Usage
        html += `<tr>
            <td>CPU Usage</td>`;
        
        if (this.#baselineData) {
            html += `<td>${this.#baselineData.cpu_usage.toFixed(2)} %</td>`;
        } else {
            html += `<td>Capturing... (${this.#captureAttempts})</td>`;
        }
        
        if (this.#peakData) {
            html += `<td>${this.#peakData.cpu_usage.toFixed(2)} %</td>`;
        } else {
            html += `<td>--</td>`;
        }
        
        html += `<td>${globalData.cpu_usage.toFixed(2)} %</td>`;
        
        if (this.#baselineData) {
            const diff = globalData.cpu_usage - this.#baselineData.cpu_usage;
            const diffClass = diff >= 0 ? 'metric-diff-positive' : 'metric-diff-negative';
            html += `<td class="${diffClass}">${diff >= 0 ? '+' : ''}${diff.toFixed(2)} %</td>`;
        } else {
            html += `<td>--</td>`;
        }
        
        html += `</tr>`;
        
        // Memory Usage
        html += `<tr>
            <td>Memory (GB)</td>`;
        
        if (this.#baselineData) {
            html += `<td>${this.#baselineData.memory_used_gb.toFixed(2)} / ${this.#baselineData.memory_total_gb.toFixed(2)}</td>`;
        } else {
            html += `<td>Capturing... (${this.#captureAttempts})</td>`;
        }
        
        if (this.#peakData) {
            html += `<td>${this.#peakData.memory_used_gb.toFixed(2)} / ${this.#peakData.memory_total_gb.toFixed(2)}</td>`;
        } else {
            html += `<td>--</td>`;
        }
        
        html += `<td>${globalData.memory_used_gb.toFixed(2)} / ${globalData.memory_total_gb.toFixed(2)}</td>`;
        
        if (this.#baselineData) {
            const diff = globalData.memory_used_gb - this.#baselineData.memory_used_gb;
            const diffClass = diff >= 0 ? 'metric-diff-positive' : 'metric-diff-negative';
            html += `<td class="${diffClass}">${diff >= 0 ? '+' : ''}${diff.toFixed(2)} GB</td>`;
        } else {
            html += `<td>--</td>`;
        }
        
        html += `</tr>`;
        
        // GPU Usage (if available)
        if (globalData.gpu_usage != null) {
            html += `<tr>
                <td>GPU Usage</td>`;
            
            if (this.#baselineData && this.#baselineData.gpu_usage != null) {
                html += `<td>${this.#baselineData.gpu_usage.toFixed(2)} %</td>`;
            } else {
                html += `<td>Capturing... (${this.#captureAttempts})</td>`;
            }
            
            if (this.#peakData && this.#peakData.gpu_usage != null) {
                html += `<td>${this.#peakData.gpu_usage.toFixed(2)} %</td>`;
            } else {
                html += `<td>--</td>`;
            }
            
            html += `<td>${globalData.gpu_usage.toFixed(2)} %</td>`;
            
            if (this.#baselineData && this.#baselineData.gpu_usage != null) {
                const diff = globalData.gpu_usage - this.#baselineData.gpu_usage;
                const diffClass = diff >= 0 ? 'metric-diff-positive' : 'metric-diff-negative';
                html += `<td class="${diffClass}">${diff >= 0 ? '+' : ''}${diff.toFixed(2)} %</td>`;
            } else {
                html += `<td>--</td>`;
            }
            
            html += `</tr>`;
        }
        
        // GPU VRAM Usage (if available)
        if (globalData.gpu_vram_used_gb != null) {
            html += `<tr>
                <td>VRAM (GB)</td>`;
            
            if (this.#baselineData && this.#baselineData.gpu_vram_used_gb != null) {
                html += `<td>${this.#baselineData.gpu_vram_used_gb.toFixed(2)} / ${this.#baselineData.gpu_vram_total_gb.toFixed(2)}</td>`;
            } else {
                html += `<td>Capturing... (${this.#captureAttempts})</td>`;
            }
            
            if (this.#peakData && this.#peakData.gpu_vram_used_gb != null) {
                html += `<td>${this.#peakData.gpu_vram_used_gb.toFixed(2)} / ${this.#peakData.gpu_vram_total_gb.toFixed(2)}</td>`;
            } else {
                html += `<td>--</td>`;
            }
            
            html += `<td>${globalData.gpu_vram_used_gb.toFixed(2)} / ${globalData.gpu_vram_total_gb.toFixed(2)}</td>`;
            
            if (this.#baselineData && this.#baselineData.gpu_vram_used_gb != null) {
                const diff = globalData.gpu_vram_used_gb - this.#baselineData.gpu_vram_used_gb;
                const diffClass = diff >= 0 ? 'metric-diff-positive' : 'metric-diff-negative';
                html += `<td class="${diffClass}">${diff >= 0 ? '+' : ''}${diff.toFixed(2)} GB</td>`;
            } else {
                html += `<td>--</td>`;
            }
            
            html += `</tr>`;
        }
        
        html += `</table>`;
        
        this.#globalTableEl.innerHTML = html;
    }

    #renderProcessTable(processData) {
        if (processData) {
            const html = `<table>
                <tr><th colspan="2">Target Browser Process</th></tr>
                <tr><td>Process ID (PID)</td><td>${processData.pid}</td></tr>
                <tr><td>CPU Usage</td><td>${processData.cpu_usage.toFixed(2)} %</td></tr>
                <tr><td>Memory (MB)</td><td>${processData.memory_mb.toFixed(2)}</td></tr>
            </table>`;
            this.#processTableEl.innerHTML = html;
            this.#processTableEl.style.display = 'block';
        } else {
            this.#processTableEl.style.display = 'none';
        }
    }
    
    // Set chart update callback function
    setChartCallback(callback) {
        this.#chartCallback = callback;
    }
    
    // Clear historical data
    clearHistoryData() {
        this.#historyData = [];
    }
}
