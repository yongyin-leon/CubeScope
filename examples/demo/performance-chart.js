/**
 * @file performance-chart.js
 * @description Defines the PerformanceChart class for rendering performance metrics using Chart.js.
 * @description-zh 定义了 PerformanceChart 类，用于使用 Chart.js 渲染性能指标。
 */

export class PerformanceChart {
    /**
     * @private
     * @type {Chart | null}
     * @description The Chart.js instance.
     * @description-zh Chart.js 实例。
     */
    #chart = null;

    /**
     * @private
     * @type {HTMLElement | null}
     * @description The container element for the chart.
     * @description-zh 图表的容器元素。
     */
    #chartContainer = null;

    /**
     * @private
     * @type {HTMLElement | null}
     * @description The button to toggle chart visibility.
     * @description-zh 用于切换图表可见性的按钮。
     */
    #toggleButton = null;

    /**
     * @private
     * @type {Array<object>}
     * @description Stores the data points for the chart.
     * @description-zh 存储图表的数据点。
     */
    #dataPoints = [];

    /**
     * @private
     * @type {number}
     * @description The maximum number of data points to display.
     * @description-zh 要显示的最大数据点数。
     */
    #maxDataPoints = 50;

    /**
     * @private
     * @type {boolean}
     * @description Flag indicating if the chart is visible.
     * @description-zh 指示图表是否可见的标志。
     */
    #isChartVisible = false;

    /**
     * @constructor
     * @description Initializes the chart elements and attaches event listeners.
     * @description-zh 初始化图表元素并附加事件监听器。
     */
    constructor() {
        this.#initializeElements();
        this.#attachEventListeners();
    }

    /**
     * @private
     * @description Initializes the DOM elements for the chart container and toggle button.
     * @description-zh 初始化图表容器和切换按钮的 DOM 元素。
     */
    #initializeElements() {
        this.#chartContainer = document.getElementById('performanceChartContainer');
        this.#toggleButton = document.getElementById('toggleChartBtn');
    }

    /**
     * @private
     * @description Attaches a click event listener to the toggle button.
     * @description-zh 将点击事件监听器附加到切换按钮。
     */
    #attachEventListeners() {
        if (this.#toggleButton) {
            this.#toggleButton.addEventListener('click', () => {
                this.toggleChart();
            });
        }
    }

    /**
     * @description Toggles the visibility of the performance chart.
     * @description-zh 切换性能图表的可见性。
     */
    toggleChart() {
        this.#isChartVisible = !this.#isChartVisible;
        
        if (this.#isChartVisible) {
            this.#chartContainer.style.display = 'block';
            this.#toggleButton.textContent = '隐藏性能图表';
            this.#createChart();
        } else {
            this.#chartContainer.style.display = 'none';
            this.#toggleButton.textContent = '显示性能图表';
        }
    }

    /**
     * @private
     * @description Creates or recreates the performance chart using Chart.js.
     * @description-zh 使用 Chart.js 创建或重新创建性能图表。
     */
    #createChart() {
        const ctx = document.getElementById('performanceChart').getContext('2d');
        
        // If the chart already exists, destroy it first.
        // 如果图表已存在，先销毁它。
        if (this.#chart) {
            this.#chart.destroy();
        }
        
        // Create a new chart.
        // 创建新的图表。
        this.#chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'CPU 使用率 (%)',
                        data: [],
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        yAxisID: 'y'
                    },
                    {
                        label: '内存使用 (GB)',
                        data: [],
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        yAxisID: 'y1'
                    },
                    {
                        label: 'GPU 使用率 (%)',
                        data: [],
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                stacked: false,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: 0,
                        max: 100,
                        title: {
                            display: true,
                            text: '百分比 (%)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: 0,
                        title: {
                            display: true,
                            text: '内存 (GB)'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    /**
     * @description Updates the chart with new performance data.
     * @param {object} globalData - The global performance data.
     * @param {number} globalData.cpu_usage - The current CPU usage.
     * @param {number} globalData.memory_used_gb - The current memory usage in GB.
     * @param {number} [globalData.gpu_usage] - The current GPU usage (optional).
     * @description-zh 使用新的性能数据更新图表。
     * @param {object} globalData - 全局性能数据。
     * @param {number} globalData.cpu_usage - 当前 CPU 使用率。
     * @param {number} globalData.memory_used_gb - 当前内存使用量 (GB)。
     * @param {number} [globalData.gpu_usage] - 当前 GPU 使用率 (可选)。
     */
    updateData(globalData) {
        if (!this.#isChartVisible || !this.#chart) return;
        
        // Add a new data point.
        // 添加新数据点。
        const newDataPoint = {
            time: new Date().toLocaleTimeString(),
            cpu: globalData.cpu_usage,
            memory: globalData.memory_used_gb,
            gpu: globalData.gpu_usage || 0
        };
        
        this.#dataPoints.push(newDataPoint);
        
        // Limit the number of data points.
        // 限制数据点数量。
        if (this.#dataPoints.length > this.#maxDataPoints) {
            this.#dataPoints.shift();
        }
        
        // Update chart data.
        // 更新图表数据。
        const labels = this.#dataPoints.map(point => point.time);
        const cpuData = this.#dataPoints.map(point => point.cpu);
        const memoryData = this.#dataPoints.map(point => point.memory);
        const gpuData = this.#dataPoints.map(point => point.gpu);
        
        this.#chart.data.labels = labels;
        this.#chart.data.datasets[0].data = cpuData;
        this.#chart.data.datasets[1].data = memoryData;
        this.#chart.data.datasets[2].data = gpuData;
        
        this.#chart.update();
    }
    
    /**
     * @description Clears all data from the chart.
     * @description-zh 清空图表中的所有数据。
     */
    clearData() {
        this.#dataPoints = [];
        if (this.#chart) {
            this.#chart.data.labels = [];
            this.#chart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            this.#chart.update();
        }
    }
    
    /**
     * @description Destroys the chart instance.
     * @description-zh 销毁图表实例。
     */
    destroy() {
        if (this.#chart) {
            this.#chart.destroy();
            this.#chart = null;
        }
    }
}
