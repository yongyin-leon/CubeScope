/**
 * @fileoverview
 * EN: Manages the debug panel, including UI controls for configuration, 
 *     displaying metadata and performance metrics, and generating performance reports.
 * ZH: 管理调试面板，包括用于配置的 UI 控件、显示元数据和性能指标以及生成性能报告。
 */

export class DebugPanel {
    // --- (EN) Private Fields / (ZH) 私有字段 ---
    #viewer;                // EN: The CubeViewer instance. / ZH: CubeViewer 实例。
    #panelElement;          // EN: The main DOM element for the debug panel. / ZH: 调试面板的主 DOM 元素。
    #bgStatsCheckbox;       // EN: Checkbox to enable/disable background statistics calculation. / ZH: 用于启用/禁用后台统计信息计算的复选框。
    #tilePreloadCheckbox;   // EN: Checkbox to enable/disable tile preloading. / ZH: 用于启用/禁用切片预加载的复选框。
    #toggleButton;          // EN: Button to show/hide the debug panel. / ZH: 用于显示/隐藏调试面板的按钮。
    #closeButton;           // EN: Button to close the debug panel. / ZH: 关闭调试面板的按钮。
    #metricsContainer;      // EN: Container for displaying performance metrics. / ZH: 用于显示性能指标的容器。
    #metadataContainer;     // EN: Container for displaying file metadata. / ZH: 用于显示文件元数据的容器。
    #downloadButton;        // EN: Button to download the performance report. / ZH: 用于下载性能报告的按钮。
    #systemMonitorPanel;    // EN: Optional system monitor data source. / ZH: 可选的系统监控数据源。
    #performanceChart;      // EN: Optional chart data source. / ZH: 可选的图表数据源。

    // EN: Unified storage for all data required for the report.
    // ZH: 用于报告所需所有数据的统一存储。
    #reportData = {
        metadata: null,
        performance: {},
        bandSwitchTimes: [] // EN: Records the time taken for band switching. / ZH: 记录波段切换所花费的时间。
    };

    /**
     * EN: Constructs the DebugPanel.
     * ZH: 构建 DebugPanel。
     * @param {import('../../src/cube-viewer.js').CubeViewer} viewer - The CubeViewer instance.
     * @param {HTMLElement} panelElement - The DOM element for the debug panel.
     * @param {object} reportSources - Optional report data providers.
     */
    constructor(viewer, panelElement, reportSources = {}) {
        if (!viewer || !panelElement) {
            throw new Error("DebugPanel requires a viewer instance and a panel element.");
        }
        this.#viewer = viewer;
        this.#panelElement = panelElement;
        this.#systemMonitorPanel = reportSources.systemMonitorPanel ?? null;
        this.#performanceChart = reportSources.performanceChart ?? null;

        // EN: Find all control elements within the panel.
        // ZH: 在面板中查找所有控件元素。
        this.#bgStatsCheckbox = this.#panelElement.querySelector('#enableBgStats');
        this.#tilePreloadCheckbox = this.#panelElement.querySelector('#enableTilePreload');
        this.#metricsContainer = this.#panelElement.querySelector('#performanceMetricsContainer');
        this.#metadataContainer = this.#panelElement.querySelector('#metadataContainer');
        this.#downloadButton = this.#panelElement.querySelector('#downloadReportBtn');
        this.#toggleButton = document.getElementById('toggleDebugPanelBtn');
        this.#closeButton = document.getElementById('closeDebugPanelBtn');

        if (!this.#metricsContainer || !this.#metadataContainer || !this.#downloadButton) {
            console.error('DebugPanel Error: Could not find all required internal elements. Please check the HTML structure.');
        }

        this.#attachEventListeners();
    }

    /**
     * EN: Initializes the panel state from URL parameters.
     * ZH: 从 URL 参数初始化面板状态。
     * @param {object} params - The URL parameters.
     */
    initFromURL(params) {
        if (params.debug) {
            this.show();
        }
        if (params.bgStats !== null) {
            this.#bgStatsCheckbox.checked = params.bgStats;
        }
        if (params.preload !== null) {
            this.#tilePreloadCheckbox.checked = params.preload;
        }
    }

    /**
     * EN: Shows the debug panel.
     * ZH: 显示调试面板。
     */
    show() {
        this.#panelElement.classList.remove('hidden');
    }

    /**
     * EN: Hides the debug panel.
     * ZH: 隐藏调试面板。
     */
    hide() {
        this.#panelElement.classList.add('hidden');
    }

    /**
     * EN: Attaches all necessary event listeners.
     * ZH: 附加所有必要的事件监听器。
     */
    #attachEventListeners() {
        this.#toggleButton?.addEventListener('click', () => {
            this.#panelElement.classList.toggle('hidden');
        });
        this.#closeButton?.addEventListener('click', () => this.hide());

        this.#bgStatsCheckbox?.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            this.#viewer.emit('log', `Background statistics set to: ${isEnabled ? 'enabled' : 'disabled'}`);
            this.#viewer.updateConfig({ backgroundStats: isEnabled });
        });

        this.#tilePreloadCheckbox?.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            this.#viewer.emit('log', `Tile preloading set to: ${isEnabled ? 'enabled' : 'disabled'}`);
            this.#viewer.updateConfig({ tilePreloading: isEnabled });
        });

        this.#downloadButton?.addEventListener('click', () => this.#downloadReport());

        // EN: Listen for events from the viewer to update the panel.
        // ZH: 监听来自查看器的事件以更新面板。
        this.#viewer.on('metadata', (data) => this.#updateMetadata(data));
        this.#viewer.on('performance', (metric) => this.#updatePerformanceMetrics(metric));
        this.#viewer.on('loadstart', () => {
            this.#clearAllData();
            this.#systemMonitorPanel?.clearHistoryData();
            this.#performanceChart?.clearData();
        });
    }

    /**
     * EN: Updates the metadata display and stores the data for the report.
     * ZH: 更新元数据并存储数据以用于报告。
     * @param {object} data - The metadata object from the viewer.
     */
    #updateMetadata(data) {
        this.#reportData.metadata = data;

        if (this.#metadataContainer) {
            const formatBytes = (bytes, decimals = 2) => {
                if (!+bytes) return '0 Bytes';
                const k = 1024;
                const dm = decimals < 0 ? 0 : decimals;
                const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
            };

            this.#metadataContainer.innerHTML = `
                <div class="metric"><span class="metric-label">File Name:</span><span class="metric-value" style="word-break: break-all;">${data.fileName}</span></div>
                <div class="metric"><span class="metric-label">File Size:</span><span class="metric-value">${formatBytes(data.fileSize)}</span></div>
                <div class="metric"><span class="metric-label">Dimensions:</span><span class="metric-value">${data.dimensions.samples}x${data.dimensions.lines}x${data.dimensions.bands}</span></div>
                <div class="metric"><span class="metric-label">Format:</span><span class="metric-value">${data.format.interleave}</span></div>
            `;
        }
    }

    /**
     * EN: Updates the performance metrics display and stores the data.
     * ZH: 更新性能指标显示并存储数据。
     * @param {object} metric - The performance metric object from the viewer.
     */
    #updatePerformanceMetrics(metric) {
        if (metric.name === 'bandSwitchTime') {
            this.#reportData.bandSwitchTimes.push({ time: new Date().toISOString(), value: metric.value, unit: metric.unit });
        } else {
            this.#reportData.performance[metric.name] = { value: metric.value, unit: metric.unit };
        }

        if (this.#metricsContainer) {
            this.#metricsContainer.innerHTML = '';
            for (const key in this.#reportData.performance) {
                const item = this.#reportData.performance[key];
                const metricDiv = document.createElement('div');
                metricDiv.className = 'metric';
                metricDiv.innerHTML = `<span class="metric-label">${this.#formatMetricName(key)}:</span><span class="metric-value">${Number(item.value).toFixed(0)} ${item.unit}</span>`;
                this.#metricsContainer.appendChild(metricDiv);
            }

            if (this.#reportData.bandSwitchTimes.length > 0) {
                const times = this.#reportData.bandSwitchTimes.map(t => t.value);
                const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
                const count = this.#reportData.bandSwitchTimes.length;

                const countDiv = document.createElement('div');
                countDiv.className = 'metric';
                countDiv.innerHTML = `<span class="metric-label">Band Switch Count:</span><span class="metric-value">${count}</span>`;
                this.#metricsContainer.appendChild(countDiv);

                const avgDiv = document.createElement('div');
                avgDiv.className = 'metric';
                avgDiv.innerHTML = `<span class="metric-label">Avg Band Switch Time:</span><span class="metric-value">${avgTime.toFixed(0)} ms</span>`;
                this.#metricsContainer.appendChild(avgDiv);
            }
        }
    }

    /**
     * EN: Formats a camelCase metric name into a readable string.
     * ZH: 将驼峰式度量名称格式化为可读字符串。
     * @param {string} key - The metric name.
     * @returns {string} The formatted name.
     */
    #formatMetricName(key) {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    /**
     * EN: Clears all displayed data and resets the internal state.
     * ZH: 清除所有显示的数据并重置内部状态。
     */
    #clearAllData() {
        if (this.#metadataContainer) this.#metadataContainer.innerHTML = '';
        if (this.#metricsContainer) this.#metricsContainer.innerHTML = '';
        this.#reportData = { metadata: null, performance: {}, bandSwitchTimes: [] };
    }

    /**
     * EN: Compiles and downloads a comprehensive performance report as a JSON file.
     * ZH: 编译并下载一个全面的性能报告（JSON 文件）。
     */
    #downloadReport() {
        if (!this.#reportData.metadata) {
            alert("Please load a file first to generate a report.");
            return;
        }

        let bandSwitchStats = null;
        if (this.#reportData.bandSwitchTimes.length > 0) {
            const times = this.#reportData.bandSwitchTimes.map(t => t.value);
            bandSwitchStats = {
                count: times.length,
                average: times.reduce((a, b) => a + b, 0) / times.length,
                min: Math.min(...times),
                max: Math.max(...times),
                records: this.#reportData.bandSwitchTimes
            };
        }

        const systemMonitorHistory = this.#systemMonitorPanel?.getHistoryData() || [];
        const performanceChartHistory = this.#performanceChart?.getHistoryData() || [];

        const fullReport = {
            reportGeneratedAt: new Date().toISOString(),
            config: {
                backgroundStats: this.#bgStatsCheckbox.checked,
                tilePreloading: this.#tilePreloadCheckbox.checked
            },
            ...this.#reportData,
            bandSwitchStats,
            systemMonitorHistory,
            performanceChartHistory
        };

        const jsonString = JSON.stringify(fullReport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = this.#reportData.metadata.fileName.split('.').slice(0, -1).join('.') || 'report';
        a.download = `report-${fileName}-${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.#viewer.emit('log', 'Performance report downloaded.');
    }
}
