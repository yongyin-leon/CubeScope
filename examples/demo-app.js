import CubeViewer from '../src/cube-viewer.js';
import {
    buildRemoteSampleLoadSource,
    fetchRemoteSampleCatalog,
    getRemoteSampleById,
} from '../src/samples/remote-sample-catalog.js';
import { EChartsPerformanceChart } from './demo/echarts-performance-chart.js';
import { PerformanceMonitorRust } from './demo/rust-performance-monitor.js';
import { SystemMonitorPanel } from './demo/system-monitor-panel.js';
import { DebugPanel } from './demo/debug-panel.js';

// --- (EN) DOM Element References / (ZH) DOM 元素引用 ---
const selectFileBtn = document.getElementById('selectFileBtn');
const sampleCatalogSelect = document.getElementById('sampleCatalogSelect');
const loadSampleBtn = document.getElementById('loadSampleBtn');
const fileInput = document.getElementById('fileInput');
const fileNameSpan = document.getElementById('fileNameSpan');
const viewerContainer = document.getElementById('viewer-container');
const logDiv = document.getElementById('log');
const rBandSelect = document.getElementById('rBandSelect');
const gBandSelect = document.getElementById('gBandSelect');
const bBandSelect = document.getElementById('bBandSelect');
const randomBandsBtn = document.getElementById('randomBandsBtn');
const statusSpan = document.getElementById('statusSpan');
const bandSwitchCountSpan = document.getElementById('bandSwitchCountSpan');
const toggleChartBtn = document.getElementById('toggleChartBtn');
const clearSpectralBtn = document.getElementById('clearSpectralBtn');
let bandSwitchCount = 0;
let spectralChart = null;
let spectralSeries = [];
let echartsLib = null;
const demoQuery = new URLSearchParams(window.location.search);
const benchmarkMode = demoQuery.get('benchmark') === '1';
const requestedSampleId = demoQuery.get('sample');
const requestedCatalogUrl = demoQuery.get('catalog')?.trim() || '/samples/remote-samples.json';
const requestedRenderer = demoQuery.get('renderer')?.trim() || 'auto';
const demoState = window.__cubescopeDemoState = {
    ready: false,
    benchmarkMode,
    rendererPreference: requestedRenderer,
    viewer: null,
    sampleCatalog: null,
    sampleCatalogUrl: requestedCatalogUrl,
    loadRegisteredSample: null,
    activeSampleId: null,
    header: null,
    metadata: null,
    loaded: false,
    metrics: [],
    errors: [],
    loadStartAt: null,
    headerAt: null,
    headerParseTime: null,
    loadEndAt: null,
    lastProbe: null,
};

// --- (EN) Logging Functions / (ZH) 日志函数 ---
const log = (msg) => {
    console.log(msg);
    if (demoState.logs) {
        demoState.logs.push(String(msg));
    } else {
        demoState.logs = [String(msg)];
    }
    if(logDiv) logDiv.innerHTML = msg + '<br>' + logDiv.innerHTML;
};
const clearLog = () => { if(logDiv) logDiv.innerHTML = ''; };

function formatCoordinate(value) {
    return Number.isFinite(value) ? Number(value).toFixed(2) : 'n/a';
}

function formatProbeStatus({ pixel, world, spatialReference }) {
    const pixelText = `Pixel (${pixel.x}, ${pixel.y})`;

    if (!world) {
        return `${pixelText} | World unavailable`;
    }

    const worldText = `World (${formatCoordinate(world.x)}, ${formatCoordinate(world.y)})`;
    const units = spatialReference?.mapInfo?.units
        ? ` ${spatialReference.mapInfo.units}`
        : '';
    const crs = spatialReference?.coordinateSystemString
        ?? spatialReference?.mapInfo?.projectionName
        ?? 'source CRS';

    return `${pixelText} | ${worldText}${units} | ${crs}`;
}

/**
 * EN: A utility function to delay the execution of a function.
 * ZH: 用于延迟函数执行的工具函数。
 */
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * EN: The main function for the example page.
 * ZH: 示例页面的主函数。
 */
async function main() {
    log('Example starting.');
    if (benchmarkMode) {
        log('Benchmark mode enabled: background stats and tile preloading are disabled.');
    }

    if (!viewerContainer) {
        log('[Error] Viewer container not found!');
        return;
    }

    // EN: Initialize the CubeViewer with paths and configuration.
    // ZH: 使用路径和配置初始化 CubeViewer。
    const viewer = new CubeViewer(viewerContainer, {
        enableBackgroundStats: !benchmarkMode,
        enableTilePreloading: !benchmarkMode,
        rendererPreference: requestedRenderer,
    });
    demoState.viewer = viewer;
    log(`Renderer preference: ${requestedRenderer}`);

    async function loadRegisteredSample(sampleId) {
        const catalog = demoState.sampleCatalog;
        if (!catalog) {
            throw new Error('Registered sample catalog is not loaded yet.');
        }

        const sample = getRemoteSampleById(catalog, sampleId);
        if (!sample) {
            throw new Error(`Unknown registered sample: ${sampleId}`);
        }

        demoState.activeSampleId = sample.id;
        if (sampleCatalogSelect) {
            sampleCatalogSelect.value = sample.id;
        }
        if (fileNameSpan) {
            fileNameSpan.textContent = sample.title;
        }
        log(`Loading registered sample: ${sample.title}`);
        await viewer.load(buildRemoteSampleLoadSource(sample));
        return sample;
    }

    demoState.loadRegisteredSample = loadRegisteredSample;

    async function initializeSampleCatalog() {
        try {
            const catalog = await fetchRemoteSampleCatalog(demoState.sampleCatalogUrl);
            demoState.sampleCatalog = catalog;
            log(`Registered sample catalog ready: ${demoState.sampleCatalogUrl}`);
            populateSampleCatalogSelect(catalog.samples);
            enableControls();
            return catalog;
        } catch (error) {
            if (sampleCatalogSelect) {
                sampleCatalogSelect.innerHTML = '';
                sampleCatalogSelect.add(new Option('Registered samples unavailable', ''));
                sampleCatalogSelect.disabled = true;
            }
            if (loadSampleBtn) {
                loadSampleBtn.disabled = true;
            }
            log(`[WARN] Registered sample catalog unavailable (${demoState.sampleCatalogUrl}): ${error.message}`);
            return null;
        }
    }

    // Performance monitoring setup
    const perfMonitor = new PerformanceMonitorRust();
    const perfChart = new EChartsPerformanceChart('performanceChart');
    const systemPanel = new SystemMonitorPanel(perfMonitor, 'systemMonitorPanel', viewer);
    systemPanel.setChartCallback((global, baseline, peak) => perfChart.updateData(global, baseline, peak));

    const debugPanelEl = document.getElementById('debugPanel');
    const debugPanel = new DebugPanel(viewer, debugPanelEl, {
        systemMonitorPanel: systemPanel,
        performanceChart: perfChart
    });

    // --- (EN) Viewer Event Listeners / (ZH) 查看器事件监听器 ---
    viewer.on('log', log);
    viewer.on('error', (errMsg) => log(`[Error] ${errMsg}`));
    viewer.on('ready', () => {
        demoState.ready = true;
        log('Viewer is ready. You can now load files.');
        enableControls();
    });
    viewer.on('loadstart', () => {
        demoState.header = null;
        demoState.metadata = null;
        demoState.loaded = false;
        demoState.metrics = [];
        demoState.errors = [];
        demoState.loadStartAt = performance.now();
        demoState.headerAt = null;
        demoState.headerParseTime = null;
        demoState.loadEndAt = null;
        demoState.lastProbe = null;
        clearLog();
        disableControls('Loading file...');
    });
    viewer.on('ready', () => {
        if (toggleChartBtn) { toggleChartBtn.disabled = false; toggleChartBtn.textContent = 'Show Performance Chart'; }
    });
    viewer.on('bandschange', () => {
        bandSwitchCount += 1;
        if (bandSwitchCountSpan) bandSwitchCountSpan.textContent = `Band Switch Count: ${bandSwitchCount}`;
    });
    viewer.on('image-clicked', async ({ x, y }) => {
        const spatialReference = viewer.getHeader()?.spatialReference;
        const world = viewer.pixelToWorld(x, y);
        const probe = {
            pixel: { x, y },
            world,
            spatialReference,
        };
        demoState.lastProbe = probe;
        const probeStatus = formatProbeStatus(probe);
        if (statusSpan) {
            statusSpan.textContent = probeStatus;
        }
        log(`[Probe] ${probeStatus}`);
        try {
            const data = await viewer.getSpectralProfile(x, y);
            if (!data || data.length === 0) {
                log(`[WARN] No spectral data for (${x},${y}).`);
                return;
            }
            if (!echartsLib) {
                echartsLib = await import('https://cdn.jsdelivr.net/npm/echarts/dist/echarts.esm.min.js');
            }
            const container = document.getElementById('spectralChart');
            if (!container) { log('[WARN] Spectral chart container missing.'); return; }
            if (!spectralChart) { debugPanel.show();
                spectralChart = echartsLib.init(container);
                spectralChart.setOption({
                    title: { text: 'Spectral Profile' },
                    tooltip: { trigger: 'axis' },
                    legend: { data: [] },
                    grid: { left: '6%', right: '6%', bottom: '6%', top: '12%' },
                    xAxis: { type: 'value', name: 'Band' },
                    yAxis: { type: 'value', name: 'Intensity' },
                    series: []
                });
            }
            const bands = Array.from({ length: data.length }, (_, i) => (i + 1));
            const points = bands.map((b, i) => [b, Number(data[i])]);
            const seriesName = `P(${x},${y})`;
            spectralSeries.push({ name: seriesName, data: points });
            // Limit to latest 5 clicks
            if (spectralSeries.length > 5) spectralSeries.shift();
            spectralChart.setOption({
                legend: { data: spectralSeries.map(s => s.name) },
                series: spectralSeries.map(s => ({ name: s.name, type: 'line', smooth: true, showSymbol: false, data: s.data }))
            });
            spectralChart.resize();
        } catch (e) {
            log(`[Error] Spectral profile failed: ${e.message}`);
        }
    });
    if (clearSpectralBtn) {
        clearSpectralBtn.addEventListener('click', () => {
            spectralSeries = [];
            if (spectralChart) {
                spectralChart.setOption({ legend: { data: [] }, series: [] });
            }
        });
    }
    viewer.on('header', (header) => {
        demoState.header = header;
        demoState.headerAt = performance.now();
        demoState.headerParseTime = demoState.loadStartAt === null
            ? null
            : demoState.headerAt - demoState.loadStartAt;
        populateBandSelectors(header.bands, { r: 30, g: 20, b: 10 });
        viewer.setBands({ r: 30, g: 20, b: 10 });
        enableControls();
    });
    viewer.on('metadata', (metadata) => {
        demoState.metadata = metadata;
    });
    viewer.on('loadend', () => {
        demoState.loaded = true;
        demoState.loadEndAt = performance.now();
    });
    viewer.on('performance', (metric) => {
        demoState.metrics.push({
            ...metric,
            capturedAt: performance.now(),
        });
    });
    viewer.on('error', (errMsg) => {
        demoState.errors.push(String(errMsg));
    });

    // --- (EN) Page Interaction Logic / (ZH) 页面交互逻辑 ---
    if (selectFileBtn) {
        selectFileBtn.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
        fileInput.addEventListener('change', async () => {
            const files = fileInput.files;
            if (files.length !== 2) {
                log('[Error] Please select both a .hdr file and a data file.');
                fileInput.value = ''; return;
            }
            let hdrFile = null, imgFile = null;
            for (const file of files) {
                if (file.name.toLowerCase().endsWith('.hdr')) { hdrFile = file; } else { imgFile = file; }
            }
            if (hdrFile && imgFile) {
                if(fileNameSpan) fileNameSpan.textContent = `${hdrFile.name}, ${imgFile.name}`;
                await viewer.load({
                    kind: 'envi-local',
                    headerFile: hdrFile,
                    dataFile: imgFile
                });
            } else {
                log('[Error] Invalid file selection. Please ensure one file is a .hdr file.');
            }
            fileInput.value = '';
        });
    }

    if (loadSampleBtn) {
        loadSampleBtn.addEventListener('click', async () => {
            try {
                if (!sampleCatalogSelect?.value) {
                    log('[WARN] No registered sample is selected.');
                    return;
                }
                await loadRegisteredSample(sampleCatalogSelect.value);
            } catch (error) {
                log(`[Error] Registered sample load failed: ${error.message}`);
            }
        });
    }

    const debouncedBandChange = debounce(() => {
        viewer.setBands({ r: rBandSelect.value, g: gBandSelect.value, b: bBandSelect.value });
    }, 300);

    if (rBandSelect && gBandSelect && bBandSelect) {
        rBandSelect.addEventListener('change', debouncedBandChange);
        gBandSelect.addEventListener('change', debouncedBandChange);
        bBandSelect.addEventListener('change', debouncedBandChange);
    }

    viewer.on('progress', (data) => {
        if (data.type === 'stats_calculation' && statusSpan) {
            const progressMsg = `Background stats caching: ${data.processed}/${data.total} (${data.progress.toFixed(0)}%)`;
            statusSpan.textContent = progressMsg;
            if (data.processed === data.total) {
                setTimeout(() => { if (statusSpan.textContent.includes('Stats')) statusSpan.textContent = 'Stats Ready'; }, 2000);
            }
        }
    });
    if (randomBandsBtn) {
        randomBandsBtn.addEventListener('click', () => {
            const header = viewer.getHeader();
            if (!header || header.bands < 3) {
                log('Total bands less than 3, cannot randomize.');
                return;
            }
            const newBands = getRandomBands(header.bands);
            if (newBands) {
                log(`Random bands: R=${newBands.r}, G=${newBands.g}, B=${newBands.b}`);
                rBandSelect.value = newBands.r;
                gBandSelect.value = newBands.g;
                bBandSelect.value = newBands.b;
                viewer.setBands(newBands);
            }
        });
    }

    disableControls('Initializing library...');
    await viewer.init();
    await initializeSampleCatalog();

    if (requestedSampleId) {
        try {
            await loadRegisteredSample(requestedSampleId);
        } catch (error) {
            log(`[Error] Auto-load sample failed: ${error.message}`);
        }
    }
}

function disableControls(text = 'Processing...') {
    if(selectFileBtn) {
        selectFileBtn.disabled = true;
        selectFileBtn.textContent = text;
    }
    if (sampleCatalogSelect) sampleCatalogSelect.disabled = true;
    if (loadSampleBtn) loadSampleBtn.disabled = true;
    if(rBandSelect) rBandSelect.disabled = true;
    if(gBandSelect) gBandSelect.disabled = true;
    if(bBandSelect) bBandSelect.disabled = true;
    if(randomBandsBtn) randomBandsBtn.disabled = true;
}

function enableControls() {
    if(selectFileBtn) {
        selectFileBtn.disabled = false;
        selectFileBtn.textContent = 'Select HDR + Data File';
    }
    if (sampleCatalogSelect && demoState.sampleCatalog?.samples?.length > 0) {
        sampleCatalogSelect.disabled = false;
    }
    if (loadSampleBtn && demoState.sampleCatalog?.samples?.length > 0) {
        loadSampleBtn.disabled = false;
    }
    if (rBandSelect && rBandSelect.options.length > 0) {
        rBandSelect.disabled = false;
        gBandSelect.disabled = false;
        bBandSelect.disabled = false;
        if(randomBandsBtn) randomBandsBtn.disabled = false;
    }
}

function populateSampleCatalogSelect(samples) {
    if (!sampleCatalogSelect) {
        return;
    }

    sampleCatalogSelect.innerHTML = '';
    if (!Array.isArray(samples) || samples.length === 0) {
        sampleCatalogSelect.add(new Option('No registered samples', ''));
        sampleCatalogSelect.disabled = true;
        return;
    }

    for (const sample of samples) {
        sampleCatalogSelect.add(new Option(sample.title, sample.id));
    }
}

function populateBandSelectors(bandCount, defaultBands) {
    if (!rBandSelect || !gBandSelect || !bBandSelect) return;
    rBandSelect.innerHTML = '';
    gBandSelect.innerHTML = '';
    bBandSelect.innerHTML = '';
    for (let i = 1; i <= bandCount; i++) {
        rBandSelect.add(new Option(`Band ${i}`, i));
        gBandSelect.add(new Option(`Band ${i}`, i));
        bBandSelect.add(new Option(`Band ${i}`, i));
    }
    rBandSelect.value = defaultBands.r;
    gBandSelect.value = defaultBands.g;
    bBandSelect.value = defaultBands.b;
}

function getRandomBands(maxBand) {
    if (maxBand < 3) return null;
    let r, g, b;
    r = Math.floor(Math.random() * maxBand) + 1;
    do { g = Math.floor(Math.random() * maxBand) + 1; } while (g === r);
    do { b = Math.floor(Math.random() * maxBand) + 1; } while (b === r || b === g);
    return { r, g, b };
}

// --- (EN) Application Startup / (ZH) 应用程序启动 ---
window.addEventListener('DOMContentLoaded', () => {
    main().catch(error => {
        console.error("Example startup failed: / 示例启动失败:", error);
        log(`[FATAL] Example startup failed: ${error.message} / [严重错误] 示例启动失败: ${error.message}`);
        disableControls("Initialization Failed / 初始化失败");
    });
});
