/**
 * @fileoverview
 * EN: Manages the performance chart using ECharts, visualizing CPU and memory usage.
 *     Handles chart toggling, zooming, time range selection, and provides historical data.
 * ZH: 使用 ECharts 管理性能图表，可视化 CPU 和内存使用情况。
 *     处理图表切换、缩放、时间范围选择，并提供历史数据。
 */

import * as echarts from 'https://cdn.jsdelivr.net/npm/echarts/dist/echarts.esm.min.js';

export class EChartsPerformanceChart {
    // --- (EN) Private Fields / (ZH) 私有字段 ---
    #chart = null;                      // EN: ECharts instance. / ZH: ECharts 实例。
    #data = [];                         // EN: Stores all performance data points. / ZH: 存储所有性能数据点。
    #timeRange = 'all';                 // EN: Current time range for display ('all', '60', '300', '600' seconds). / ZH: 当前显示的时间范围（'all', '60', '300', '600' 秒）。
    #maxDataPoints = 1000;              // EN: Maximum number of data points to store. / ZH: 存储的最大数据点数。
    #containerId = null;                // EN: ID of the original chart container element. / ZH: 原始图表容器元素的 ID。
    #chartContainer = null;             // EN: The container element for the chart. / ZH: 图表的容器元素。
    #toggleButton = null;               // EN: Button to toggle chart visibility. / ZH: 用于切换图表可见性的按钮。
    #isChartVisible = false;            // EN: Flag indicating if the chart is currently visible. / ZH: 指示图表当前是否可见的标志。
    #originalContainer = null;          // EN: The original DOM element where the chart is rendered. / ZH: 渲染图表的原始 DOM 元素。
    #isZoomed = false;                  // EN: Flag indicating if the chart is in a zoomed (modal) state. / ZH: 指示图表是否处于缩放（模态）状态的标志。

    /**
     * EN: Constructs the EChartsPerformanceChart.
     * ZH: 构建 EChartsPerformanceChart。
     * @param {string} containerId - The ID of the DOM element to contain the chart.
     */
    constructor(containerId = 'performanceChart') {
        this.#containerId = containerId;
        this.#initializeElements();
        this.#initChart();
        this.#attachEventListeners();
    }

    /**
     * EN: Initializes DOM element references.
     * ZH: 初始化 DOM 元素引用。
     */
    #initializeElements() {
        this.#chartContainer = document.getElementById('performanceChartContainer');
        this.#toggleButton = document.getElementById('toggleChartBtn');
        this.#originalContainer = document.getElementById(this.#containerId);
    }

    /**
     * EN: Initializes the ECharts instance and configures it.
     * ZH: 初始化 ECharts 实例并进行配置。
     */
    #initChart() {
        if (this.#originalContainer) {
            this.#chart = echarts.init(this.#originalContainer);
            this.#configureChart();
        }
    }

    /**
     * EN: Sets the initial configuration for the ECharts instance.
     * ZH: 为 ECharts 实例设置初始配置。
     */
    #configureChart() {
        const option = {
            title: {
                text: 'Performance Monitoring',
                textStyle: { fontSize: 14 }
            },
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    if (!params || params.length === 0) return '';
                    const date = new Date(params[0].value[0]);
                    let result = date.toLocaleTimeString() + '<br/>';
                    params.forEach(param => {
                        const value = parseFloat(param.value[1]).toFixed(2);
                        result += `${param.marker} ${param.seriesName}: ${value}<br/>`;
                    });
                    return result;
                }
            },
            legend: {
                data: ['CPU Usage (%)', 'Memory Usage (GB)', 'Baseline CPU (%)', 'Peak CPU (%)'],
                top: '10%'
            },
            grid: {
                left: '3%', right: '4%', bottom: '3%', containLabel: true
            },
            xAxis: { type: 'time', name: 'Time' },
            yAxis: {
                type: 'value', name: 'Value',
                axisLabel: { formatter: (value) => parseFloat(value).toFixed(2) }
            },
            series: [
                { name: 'CPU Usage (%)', type: 'line', smooth: true, showSymbol: false, data: [] },
                { name: 'Memory Usage (GB)', type: 'line', smooth: true, showSymbol: false, data: [] },
                { name: 'Baseline CPU (%)', type: 'line', smooth: true, showSymbol: false, lineStyle: { type: 'dashed' }, data: [] },
                { name: 'Peak CPU (%)', type: 'line', smooth: true, showSymbol: false, lineStyle: { type: 'dashed' }, data: [] }
            ]
        };
        this.#chart.setOption(option);
    }

    /**
     * EN: Attaches event listeners for UI controls (toggle, zoom, time range).
     * ZH: 为 UI 控件（切换、缩放、时间范围）附加事件监听器。
     */
    #attachEventListeners() {
        this.#toggleButton?.addEventListener('click', () => this.toggleChart());
        document.getElementById('zoomChartBtn')?.addEventListener('click', () => this.toggleZoom());
        document.getElementById('closeChartModal')?.addEventListener('click', () => this.toggleZoom());
        document.getElementById('timeRangeSelect')?.addEventListener('change', (e) => {
            this.#timeRange = e.target.value;
            this.#updateChart();
        });

        window.addEventListener('resize', () => {
            if (this.#chart) {
                setTimeout(() => this.#chart.resize(), 100);
            }
        });
    }

    /**
     * EN: Toggles the visibility of the chart.
     * ZH: 切换图表的可见性。
     */
    toggleChart() {
        this.#isChartVisible = !this.#isChartVisible;
        this.#chartContainer.style.display = this.#isChartVisible ? 'block' : 'none';
        this.#toggleButton.textContent = this.#isChartVisible ? 'Hide Performance Chart' : 'Show Performance Chart';
        if (this.#isChartVisible) {
            setTimeout(() => this.#chart.resize(), 100);
        }
    }

    /**
     * EN: Toggles the zoomed (modal) view of the chart.
     * ZH: 切换图表的缩放（模态）视图。
     */
    toggleZoom() {
        this.#isZoomed = !this.#isZoomed;
        const modal = document.getElementById('chartModal');
        const modalContainer = document.getElementById('largeChartContainer');

        if (this.#isZoomed) {
            modalContainer.appendChild(this.#originalContainer);
            modal.style.display = 'flex';
        } else {
            this.#chartContainer.appendChild(this.#originalContainer);
            modal.style.display = 'none';
        }
        setTimeout(() => this.#chart.resize(), 100);
    }

    /**
     * EN: Adds new performance data and updates the chart if visible.
     * ZH: 添加新的性能数据，并在图表可见时更新图表。
     * @param {object} globalData - The latest performance data.
     * @param {object} baselineData - The baseline performance data.
     * @param {object} peakData - The peak performance data.
     */
    updateData(globalData, baselineData, peakData) {
        if (!this.#isChartVisible || !globalData) return;

        const now = new Date();
        const dataPoint = {
            timestamp: now,
            cpu: parseFloat(globalData.cpu_usage.toFixed(2)),
            memory: parseFloat(globalData.memory_used_gb.toFixed(2)),
            baselineCpu: baselineData ? parseFloat(baselineData.cpu_usage.toFixed(2)) : null,
            peakCpu: peakData ? parseFloat(peakData.cpu_usage.toFixed(2)) : null
        };

        this.#data.push(dataPoint);
        if (this.#data.length > this.#maxDataPoints) {
            this.#data.shift();
        }

        this.#updateChart();
    }

    /**
     * EN: Filters data based on the selected time range and updates the ECharts series.
     * ZH: 根据选定的时间范围过滤数据并更新 ECharts 系列。
     */
    #updateChart() {
        if (!this.#chart) return;

        const filteredData = this.#filterDataByTimeRange();
        const cpuData = filteredData.map(item => [item.timestamp, item.cpu]);
        const memoryData = filteredData.map(item => [item.timestamp, item.memory]);
        const baselineCpuData = filteredData.map(item => [item.timestamp, item.baselineCpu]).filter(item => item[1] !== null);
        const peakCpuData = filteredData.map(item => [item.timestamp, item.peakCpu]).filter(item => item[1] !== null);

        this.#chart.setOption({
            series: [
                { name: 'CPU Usage (%)', data: cpuData },
                { name: 'Memory Usage (GB)', data: memoryData },
                { name: 'Baseline CPU (%)', data: baselineCpuData },
                { name: 'Peak CPU (%)', data: peakCpuData }
            ]
        });
    }

    /**
     * EN: Filters the stored data based on the current time range setting.
     * ZH: 根据当前的时间范围设置过滤存储的数据。
     * @returns {Array} The filtered data array.
     */
    #filterDataByTimeRange() {
        if (this.#timeRange === 'all') {
            return this.#data;
        }
        const now = new Date().getTime();
        const rangeMilliseconds = parseInt(this.#timeRange) * 1000;
        return this.#data.filter(item => (now - item.timestamp.getTime()) <= rangeMilliseconds);
    }

    /**
     * EN: Clears all chart data.
     * ZH: 清除所有图表数据。
     */
    clearData() {
        this.#data = [];
        this.#updateChart();
    }

    /**
     * EN: Returns all historical data, typically for report generation.
     * ZH: 返回所有历史数据，通常用于报告生成。
     * @returns {Array} The complete data history.
     */
    getHistoryData() {
        return this.#data;
    }
}