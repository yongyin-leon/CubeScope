// analysis-panel.js

/**
 * @fileoverview
 * EN: Manages the spectral analysis panel, which displays spectral curves extracted from the image.
 * ZH: 管理光谱分析面板，该面板显示从图像中提取的光谱曲线。
 */

/**
 * EN: A small helper function to create DOM elements, making the code cleaner.
 * ZH: 一个创建 DOM 元素的小型辅助函数，让代码更整洁。
 */
function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

export class AnalysisPanel {
    // --- (EN) Private Fields / (ZH) 私有字段 ---
    #viewer;            // EN: Reference to the main viewer instance. / ZH: 对主查看器实例的引用。
    #panelElement;      // EN: The DOM element for the analysis panel. / ZH: 分析面板的 DOM 元素。
    #chartInstance = null; // EN: The ECharts instance for rendering the spectral curve. / ZH: 用于渲染光谱曲线的 ECharts 实例。
    #infoElement;       // EN: Element to display instructions or status messages. / ZH: 用于显示说明或状态消息的元素。
    #chartContainer;    // EN: The container for the ECharts chart. / ZH: ECharts 图表的容器。
    #readerInstance = null; // EN: Cache the reader instance for performance. / ZH: 缓存 reader 实例以提高性能。

    /**
     * EN: Constructs the AnalysisPanel.
     * ZH: 构建 AnalysisPanel。
     * @param {object} viewer - The main viewer instance.
     * @param {HTMLElement} panelElement - The DOM element to render the panel in.
     */
    constructor(viewer, panelElement) {
        this.#viewer = viewer;
        this.#panelElement = panelElement;
        
        this.#setupUI();
        this.#attachEventListeners();
    }

    /**
     * EN: Sets up the initial UI structure of the panel.
     * ZH: 设置面板的初始 UI 结构。
     */
    #setupUI() {
        this.#panelElement.innerHTML = ''; // 清空任何现有内容
        const title = createElement('h3', null, '光谱分析');
        this.#infoElement = createElement('div', 'info-text', '请在图像上点击以提取光谱曲线。');
        
        this.#chartContainer = createElement('div', 'spectral-chart-container');
        this.#chartContainer.style.width = '100%';
        this.#chartContainer.style.height = '250px'; // 可以根据需要调整高度
        
        this.#panelElement.append(title, this.#infoElement, this.#chartContainer);
        
        // 初始化 ECharts 实例
        if (window.echarts) {
            this.#chartInstance = echarts.init(this.#chartContainer);
            this.#configureChart();
        } else {
            this.#infoElement.textContent = '错误: ECharts 库未加载。';
            console.error('ECharts library is not available.');
        }
    }
    
    /**
     * EN: Configures the basic options for the ECharts instance.
     * ZH: 配置 ECharts 实例的基本选项。
     * @param {Array} [data=[]] - The initial data for the chart series.
     */
    #configureChart(data = []) {
        const options = {
            tooltip: { trigger: 'axis', formatter: (params) => `波长: ${params[0].value[0].toFixed(2)} nm<br/>数值: ${params[0].value[1]}` },
            xAxis: {
                type: 'value',
                name: '波长',
                nameLocation: 'middle',
                nameGap: 25,
                axisLabel: { formatter: '{value}' }
            },
            yAxis: {
                type: 'value',
                name: 'DN值',
                min: 'dataMin',
                max: 'dataMax'
            },
            series: [{
                data: data,
                type: 'line',
                smooth: true,
                showSymbol: false,
            }],
            grid: { left: 50, right: 20, top: 40, bottom: 40 } // 调整边距以显示坐标轴标签
        };
        this.#chartInstance.setOption(options);
    }

    /**
     * EN: Attaches event listeners, specifically for the 'image-clicked' custom event from the viewer.
     * ZH: 附加事件监听器，特别是监听来自查看器的 'image-clicked' 自定义事件。
     */
    #attachEventListeners() {
        // 关键一步：监听由 viewer 发出的 'image-clicked' 自定义事件
        this.#viewer.on('image-clicked', this.#handleImageClick);
    }
    
    /**
     * EN: Event handler triggered when an 'image-clicked' event is received.
     * ZH: 接收到 'image-clicked' 事件时触发的事件处理函数。
     * @param {object} detail - The event detail containing x and y coordinates.
     * @param {number} detail.x - The x-coordinate of the click.
     * @param {number} detail.y - The y-coordinate of the click.
     */
    #handleImageClick = async ({ x, y }) => {
        if (!this.#viewer.getHeader()) {
            console.warn("头文件尚未加载，无法提取光谱。");
            return;
        }

        this.#infoElement.textContent = `正在提取坐标 (${x}, ${y}) 的光谱...`;
        this.#chartInstance.showLoading(); // 显示加载动画

        try {
            this.#readerInstance = this.#viewer.createReader();
            if (!this.#readerInstance) {
                throw new Error("无法从主视图获取 WASM Reader 实例。");
            }
            const profileData = await this.#getSpectralProfile(x, y);
            if (profileData && profileData.length > 0) {
                this.#updateChart(profileData, x, y);
                this.#infoElement.textContent = `当前显示像素 (${x}, ${y}) 的光谱曲线。`;
            } else {
                throw new Error("WASM未能返回有效数据。");
            }
        } catch (error) {
            console.error("提取光谱曲线失败:", error);
            this.#infoElement.textContent = `提取 (${x}, ${y}) 失败: ${error.message}`;
        } finally {
            this.#chartInstance.hideLoading(); // 隐藏加载动画
        }
    }

    /**
     * EN: Core data fetching function to get the spectral profile for a given pixel.
     * ZH: 核心数据获取函数，用于获取给定像素的光谱剖面。
     * @param {number} imageX - The x-coordinate in the image.
     * @param {number} imageY - The y-coordinate in the image.
     * @returns {Promise<Array>} - A promise that resolves with the spectral profile data.
     */
    async #getSpectralProfile(imageX, imageY) {
        const header = this.#viewer.getHeader();
        const imgFile = this.#viewer.getImageFile();
        const interleave = header.interleave.toLowerCase();

        let chunkData;
        let chunkStartOffset;

        // 根据不同的交错格式，计算需要从文件中读取的数据块
        // 你的WASM函数需要一个包含目标像素所有波段数据的块
        if (interleave === 'bip') {
            const bytesPerFullPixel = header.bands * header.bytesPerPixel;
            const bytesPerLine = header.samples * bytesPerFullPixel;
            // BIP格式，我们只需要读取目标像素所在的一整行数据
            chunkStartOffset = header.headerOffset + imageY * bytesPerLine;
            const chunkEndOffset = chunkStartOffset + bytesPerLine;
            const chunkBlob = imgFile.slice(chunkStartOffset, chunkEndOffset);
            chunkData = new Uint8Array(await chunkBlob.arrayBuffer());
        } else {
             // 对于 BIL 和 BSQ 格式，数据提取会更复杂，需要跨多个位置读取。
             // 为保持示例清晰，我们暂时只处理最适合此操作的 BIP 格式。
             throw new Error(`面板暂不支持 '${interleave.toUpperCase()}' 格式的光谱提取。`);
        }

        if (!this.#readerInstance) {
            throw new Error("Reader 实例无效。");
        }

        const xInChunk = imageX;
        const yInChunk = 0; 

        return this.#readerInstance.getSpectralProfileWithWavelengths(
            chunkData,
            chunkStartOffset,
            xInChunk,
            yInChunk 
        );
    }
    
    /**
     * EN: Updates the chart with new spectral data.
     * ZH: 使用新的光谱数据更新图表。
     * @param {Array} spectralPoints - The spectral data points from WASM.
     * @param {number} x - The x-coordinate of the pixel.
     * @param {number} y - The y-coordinate of the pixel.
     */
    #updateChart(spectralPoints, x, y) {
        // ECharts 需要的数据格式是 [[x1, y1], [x2, y2], ...]
        // 我们的WASM函数返回的是 [{wavelength: w, value: v}, ...]，需要转换
        const chartData = spectralPoints.map(point => [point.wavelength, point.value]);
        
        this.#chartInstance.setOption({
            title: {
                text: `像元 (${x}, ${y}) 的光谱曲线`,
                left: 'center',
                textStyle: { fontSize: 14 }
            },
            series: [{
                data: chartData
            }]
        });
    }
}