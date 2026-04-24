import CubeViewer from '../src/cube-viewer.js';
import { selectDefaultBandsForHeader } from '../src/runtime/band-selection.js';
import {
    buildRemoteSampleLoadSource,
    fetchRemoteSampleCatalog,
    getRemoteSampleById,
} from '../src/samples/remote-sample-catalog.js';
import {
    applyRendererLogMessage,
    createRendererStatus,
} from './demo/renderer-status.js';

const $ = (id) => document.getElementById(id);

const el = {
    sampleCatalogSelect: $('sampleCatalogSelect'),
    loadSampleBtn: $('loadSampleBtn'),
    selectFileBtn: $('selectFileBtn'),
    fileInput: $('fileInput'),
    viewerContainer: $('viewer-container'),
    viewportPanel: $('viewportPanel'),
    eventConsole: document.querySelector('.event-console'),
    log: $('log'),
    eventLogCount: $('eventLogCount'),
    networkCount: $('networkCount'),
    tileCount: $('tileCount'),
    statsCount: $('statsCount'),
    pauseLogBtn: $('pauseLogBtn'),
    clearLogBtn: $('clearLogBtn'),
    toggleConsoleBtn: $('toggleConsoleBtn'),
    miniMapCanvas: $('miniMapCanvas'),
    miniMapWindow: document.querySelector('.mini-map-window'),
    fileNameSpan: $('fileNameSpan'),
    datasetSourceKind: $('datasetSourceKind'),
    datasetDimensions: $('datasetDimensions'),
    datasetFormat: $('datasetFormat'),
    datasetDataType: $('datasetDataType'),
    datasetWavelengths: $('datasetWavelengths'),
    datasetFileSize: $('datasetFileSize'),
    datasetCrs: $('datasetCrs'),
    metadataToggleBtn: $('metadataToggleBtn'),
    rBandSelect: $('rBandSelect'),
    gBandSelect: $('gBandSelect'),
    bBandSelect: $('bBandSelect'),
    rBandSlider: $('rBandSlider'),
    gBandSlider: $('gBandSlider'),
    bBandSlider: $('bBandSlider'),
    randomBandsBtn: $('randomBandsBtn'),
    resetBandsBtn: $('resetBandsBtn'),
    statusSpan: $('statusSpan'),
    spectralTitle: $('spectralTitle'),
    spectralChart: $('spectralChart'),
    clearSpectralBtn: $('clearSpectralBtn'),
    rendererStatusBadge: $('rendererStatusBadge'),
    rendererModeSelect: $('rendererModeSelect'),
    metricInitialView: $('metricInitialView'),
    metricBandSwitch: $('metricBandSwitch'),
    metricFps: $('metricFps'),
    perfRenderer: $('perfRenderer'),
    perfGpu: $('perfGpu'),
    perfInitialView: $('perfInitialView'),
    perfBandSwitch: $('perfBandSwitch'),
    perfTileLoad: $('perfTileLoad'),
    perfTextureSize: $('perfTextureSize'),
    overlayPixelX: $('overlayPixelX'),
    overlayPixelY: $('overlayPixelY'),
    overlaySize: $('overlaySize'),
    bandSwitchCountSpan: $('bandSwitchCountSpan'),
    cacheSummary: $('cacheSummary'),
    requestSummary: $('requestSummary'),
    workerSummary: $('workerSummary'),
    metadataContainer: $('metadataContainer'),
    enableBgStats: $('enableBgStats'),
    enableTilePreload: $('enableTilePreload'),
    downloadReportBtn: $('downloadReportBtn'),
    toggleDebugPanelBtn: $('toggleDebugPanelBtn'),
    debugPanel: $('debugPanel'),
    screenshotBtn: $('screenshotBtn'),
    toolScreenshotBtn: $('toolScreenshotBtn'),
    infoBtn: $('infoBtn'),
    helpBtn: $('helpBtn'),
    moreBtn: $('moreBtn'),
    resetViewBtn: $('resetViewBtn'),
};

const demoQuery = new URLSearchParams(window.location.search);
const benchmarkMode = demoQuery.get('benchmark') === '1';
const requestedSampleId = demoQuery.get('sample');
const requestedRendererRaw = demoQuery.get('renderer')?.trim().toLowerCase() || 'auto';
const requestedRenderer = ['auto', 'webgl', 'webgpu'].includes(requestedRendererRaw)
    ? requestedRendererRaw
    : 'auto';
const requestedCatalogParam = demoQuery.get('catalog')?.trim();
const requestedCatalogUrl = requestedCatalogParam
    ? resolveDemoAssetUrl(requestedCatalogParam)
    : resolveDemoAssetUrl('samples/remote-samples.json');

let bandSwitchCount = 0;
let logPaused = false;
let eventCount = 0;
let networkCount = 0;
let tileCount = 0;
let statsCount = 0;
let defaultBands = null;
let activeTool = 'pan';
let activeConsoleTab = 'all';
let miniMapFrame = 0;
const MINI_MAP_INSET = 8;
const MINI_MAP_BACKING_LONG_SIDE = 180;
const miniMapTileCanvas = document.createElement('canvas');
const eventEntries = [];

const demoState = window.__cubescopeDemoState = {
    ready: false,
    benchmarkMode,
    rendererPreference: requestedRenderer,
    rendererStatus: createRendererStatus(requestedRenderer),
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
    logs: [],
    loadStartAt: null,
    headerAt: null,
    headerParseTime: null,
    loadEndAt: null,
    lastProbe: null,
    bands: null,
    activeTool,
    viewportState: null,
};

function resolveDemoAssetUrl(path) {
    if (/^(https?:)?\/\//i.test(path)) {
        return path;
    }

    const cleanPath = String(path).replace(/^\/+/, '');
    const base = import.meta.env.BASE_URL || '/';
    if (base === '/' || base.startsWith('/')) {
        return `${base.replace(/\/$/, '')}/${cleanPath}`;
    }

    return new URL(cleanPath, window.location.href).href;
}

function getProductionRuntimeAssetOptions() {
    if (import.meta.env.DEV) {
        return {};
    }

    return {
        workerUrl: resolveDemoAssetUrl('runtime/worker.js'),
        wasmJsUrl: resolveDemoAssetUrl('runtime/pkg/envi_parser.js'),
        wasmWasmUrl: resolveDemoAssetUrl('runtime/pkg/envi_parser_bg.wasm'),
    };
}

function resolveSampleForDemo(sample) {
    return {
        ...sample,
        headerUrl: resolveDemoAssetUrl(sample.headerUrl),
        dataUrl: resolveDemoAssetUrl(sample.dataUrl),
    };
}

function setText(node, value) {
    if (node) {
        node.textContent = value;
    }
}

function formatMs(value) {
    return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} ms` : '--';
}

function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) {
        return '--';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let current = value;
    let index = 0;
    while (current >= 1024 && index < units.length - 1) {
        current /= 1024;
        index += 1;
    }
    return `${current.toFixed(current >= 100 ? 0 : 1)} ${units[index]}`;
}

function formatNumber(value, digits = 4) {
    return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '--';
}

function clampUnit(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback;
}

function getCustomField(header, fieldName) {
    const fields = header?.customFields;
    if (!fields || typeof fields !== 'object') {
        return undefined;
    }

    const normalized = fieldName.toLowerCase().replace(/\s+/g, ' ');
    return Object.entries(fields).find(([key]) => (
        String(key).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ') === normalized
    ))?.[1];
}

function normalizeWavelengthUnit(unit) {
    const value = String(unit ?? '').trim().toLowerCase();
    if (/^(um|\u00b5m|micrometer|micrometers|micron|microns)$/i.test(value)) {
        return 'um';
    }
    if (/^(nm|nanometer|nanometers)$/i.test(value)) {
        return 'nm';
    }
    return value || null;
}

function resolveSpectralAxis(header, valueCount) {
    const rawWavelengths = Array.isArray(header?.wavelength)
        ? header.wavelength.map(Number)
        : [];
    const wavelengths = rawWavelengths.slice(0, valueCount);
    const hasWavelengths = wavelengths.length === valueCount
        && wavelengths.every(Number.isFinite);

    if (!hasWavelengths) {
        return {
            values: Array.from({ length: valueCount }, (_, index) => index + 1),
            unit: null,
            label: 'Band',
            isBandIndex: true,
        };
    }

    const max = Math.max(...wavelengths);
    const unit = normalizeWavelengthUnit(getCustomField(header, 'wavelength units'))
        ?? (max > 100 ? 'nm' : 'um');

    return {
        values: wavelengths,
        unit,
        label: unit ? `Wavelength (${unit})` : 'Wavelength',
        isBandIndex: false,
    };
}

function summarizeWavelengths(header) {
    const wavelengths = Array.isArray(header?.wavelength)
        ? header.wavelength.map(Number).filter(Number.isFinite)
        : [];
    if (wavelengths.length === 0) {
        return '--';
    }

    const min = Math.min(...wavelengths);
    const max = Math.max(...wavelengths);
    const units = normalizeWavelengthUnit(getCustomField(header, 'wavelength units'))
        ?? (max > 100 ? 'nm' : 'um');
    return `${formatNumber(min, max > 100 ? 0 : 2)} - ${formatNumber(max, max > 100 ? 0 : 2)} ${units} (${wavelengths.length} bands)`;
}

function summarizeCrs(spatialReference) {
    if (!spatialReference) {
        return '--';
    }

    const mapInfo = spatialReference.mapInfo;
    if (mapInfo?.projectionName) {
        const zone = mapInfo.zone ? `, Zone ${mapInfo.zone}` : '';
        const hemi = mapInfo.hemisphere ? ` ${mapInfo.hemisphere[0]}` : '';
        const datum = mapInfo.datum ? `, ${mapInfo.datum}` : '';
        const units = mapInfo.units ? `, ${mapInfo.units}` : '';
        return `${mapInfo.projectionName}${zone}${hemi}${datum}${units}`;
    }

    return spatialReference.coordinateSystemString ? 'coordinate system string present' : '--';
}

function setCount(node, value) {
    if (node) {
        node.textContent = String(value);
    }
}

function updateCounts() {
    setCount(el.eventLogCount, eventCount);
    setCount(el.networkCount, networkCount);
    setCount(el.tileCount, tileCount);
    setCount(el.statsCount, statsCount);
}

function isNetworkEntry(entry) {
    return entry.source === 'Network'
        || /http|range|remote|catalog|request/i.test(entry.message);
}

function isTileEntry(entry) {
    return entry.source === 'Tiles'
        || /tile|preload/i.test(entry.message);
}

function isStatsEntry(entry) {
    return entry.source === 'Stats'
        || entry.level === 'PERF'
        || /stat|metric|time|fps|cache|band switch/i.test(entry.message);
}

function filterEventEntries(entries) {
    if (activeConsoleTab === 'network') {
        return entries.filter(isNetworkEntry);
    }
    if (activeConsoleTab === 'tiles') {
        return entries.filter(isTileEntry);
    }
    if (activeConsoleTab === 'stats') {
        return entries.filter(isStatsEntry);
    }
    return entries;
}

function renderEventLog() {
    if (!el.log) return;
    el.log.innerHTML = '';
    for (const entry of filterEventEntries(eventEntries).slice(0, 80)) {
        const row = document.createElement('tr');
        for (const [value, className] of [
            [entry.time, ''],
            [entry.level, `level-${entry.level.toLowerCase()}`],
            [entry.source, ''],
            [entry.message, ''],
        ]) {
            const cell = document.createElement('td');
            if (className) {
                cell.className = className;
            }
            cell.textContent = value;
            row.append(cell);
        }
        el.log.append(row);
    }
}

function inferLogEntry(message) {
    const text = String(message);
    if (/error|failed|fatal/i.test(text)) {
        return { level: 'ERROR', source: 'Runtime' };
    }
    if (/warn/i.test(text)) {
        return { level: 'WARN', source: 'Runtime' };
    }
    if (/metric|time|performance|initial view|band switch/i.test(text)) {
        return { level: 'PERF', source: 'Renderer' };
    }
    if (/tile|preload/i.test(text)) {
        return { level: 'INFO', source: 'Tiles' };
    }
    if (/stats|statistics/i.test(text)) {
        return { level: 'INFO', source: 'Stats' };
    }
    if (/hdr|header|load|sample|file/i.test(text)) {
        return { level: 'INFO', source: 'Loader' };
    }
    if (/renderer|webgl|webgpu/i.test(text)) {
        return { level: 'INFO', source: 'Renderer' };
    }
    return { level: 'INFO', source: 'UI' };
}

function translateLogMessage(message) {
    const text = String(message);
    if (/\p{Script=Han}/u.test(text) && text.includes(' / ')) {
        return text.split(' / ')[0].trim();
    }
    return text;
}

function appendEvent(message, overrides = {}) {
    const normalizedMessage = translateLogMessage(message);
    const entry = {
        time: new Date().toLocaleTimeString(undefined, { hour12: false }),
        message: normalizedMessage,
        ...inferLogEntry(normalizedMessage),
        ...overrides,
    };

    demoState.logs.push(entry.message);
    eventEntries.unshift(entry);
    eventCount += 1;
    if (isTileEntry(entry)) tileCount += 1;
    if (isNetworkEntry(entry)) networkCount += 1;
    if (isStatsEntry(entry)) statsCount += 1;
    updateCounts();

    if (logPaused || !el.log) {
        return;
    }

    renderEventLog();
}

function log(message) {
    const normalizedMessage = translateLogMessage(message);
    console.log(normalizedMessage);
    demoState.rendererStatus = applyRendererLogMessage(demoState.rendererStatus, normalizedMessage)
        ?? demoState.rendererStatus;
    renderRendererStatus();
    appendEvent(normalizedMessage);
}

function clearEventLog() {
    if (el.log) {
        el.log.innerHTML = '';
    }
    eventCount = 0;
    networkCount = 0;
    tileCount = 0;
    statsCount = 0;
    eventEntries.length = 0;
    demoState.logs = [];
    updateCounts();
}

function renderRendererStatus() {
    const status = demoState.rendererStatus;
    const hasActiveRenderer = Boolean(status?.activeKind);
    const active = status?.activeKind ?? status?.preference ?? requestedRenderer;
    const stage = hasActiveRenderer
        ? (status?.lastStage === 'recovered' ? 'Recovered' : 'Active')
        : 'Initializing';
    setText(el.rendererStatusBadge, `${String(active).toUpperCase()}: ${stage}`);
    setText(el.perfRenderer, active ? String(active).toUpperCase() : '--');
    if (el.rendererModeSelect && el.rendererModeSelect.value !== requestedRenderer) {
        el.rendererModeSelect.value = requestedRenderer;
    }
}

function renderMetric(metric) {
    if (metric.name === 'timeToInitialView') {
        const value = formatMs(metric.value);
        setText(el.metricInitialView, value);
        setText(el.perfInitialView, value);
        appendEvent(`Initial view time: ${value}`, { level: 'PERF', source: 'Renderer' });
    }
    if (metric.name === 'bandSwitchTime') {
        const value = formatMs(metric.value);
        setText(el.metricBandSwitch, value);
        setText(el.perfBandSwitch, value);
        appendEvent(`Band switch time: ${value}`, { level: 'PERF', source: 'Renderer' });
    }
}

function setActiveTool(tool) {
    activeTool = tool;
    demoState.activeTool = tool;
    document.querySelectorAll('.tool-button[data-tool]').forEach((button) => {
        button.classList.toggle('active', button.dataset.tool === tool);
    });
    appendEvent(`Tool selected: ${tool.replace(/-/g, ' ')}`, { source: 'UI' });
}

function renderDatasetSummary() {
    const header = demoState.header;
    const metadata = demoState.metadata;

    if (!header) {
        setText(el.datasetSourceKind, 'None');
        setText(el.datasetDimensions, '--');
        setText(el.datasetFormat, '--');
        setText(el.datasetDataType, '--');
        setText(el.datasetWavelengths, '--');
        setText(el.datasetFileSize, '--');
        setText(el.datasetCrs, '--');
        setText(el.overlaySize, '--');
        return;
    }

    setText(el.datasetSourceKind, metadata?.sourceKind ?? 'local file');
    setText(el.datasetDimensions, `${header.samples} x ${header.lines} x ${header.bands}`);
    setText(el.datasetFormat, String(header.interleave ?? '--').toUpperCase());
    setText(el.datasetDataType, header.dataType ?? header.dataTypeCode ?? '--');
    setText(el.datasetWavelengths, summarizeWavelengths(header));
    setText(el.datasetFileSize, formatBytes(metadata?.fileSize));
    setText(el.datasetCrs, summarizeCrs(header.spatialReference));
    setText(el.overlaySize, `${header.samples} x ${header.lines}`);
    setText(el.perfTextureSize, `${Math.max(64, header.samples)} x ${Math.max(64, header.lines)}`);
    setText(el.cacheSummary, `Memory: ${formatBytes((header.samples ?? 0) * (header.lines ?? 0) * 4 * 3)}`);
}

function resetProbeReadout() {
    if (!el.statusSpan) return;
    el.statusSpan.innerHTML = `
        <dt>Pixel (X, Y)</dt><dd>--</dd>
        <dt>World (X, Y)</dt><dd>--</dd>
        <dt>Value @ R</dt><dd>--</dd>
        <dt>Value @ G</dt><dd>--</dd>
        <dt>Value @ B</dt><dd>--</dd>
    `;
    setText(el.overlayPixelX, '--');
    setText(el.overlayPixelY, '--');
}

function renderProbe({ pixel, world, spectrum }) {
    const bands = demoState.bands ?? {};
    const units = demoState.header?.spatialReference?.mapInfo?.units ?? '';
    const worldText = world
        ? `(${formatNumber(world.x, 0)}, ${formatNumber(world.y, 0)}) ${units}`.trim()
        : '--';
    const valueAt = (band) => spectrum?.[Number(band) - 1];

    if (el.statusSpan) {
        el.statusSpan.innerHTML = `
            <dt>Pixel (X, Y)</dt><dd>(${pixel.x}, ${pixel.y})</dd>
            <dt>World (X, Y)</dt><dd>${worldText}</dd>
            <dt>Value @ R (${bands.r ?? '--'})</dt><dd>${formatNumber(valueAt(bands.r))}</dd>
            <dt>Value @ G (${bands.g ?? '--'})</dt><dd>${formatNumber(valueAt(bands.g))}</dd>
            <dt>Value @ B (${bands.b ?? '--'})</dt><dd>${formatNumber(valueAt(bands.b))}</dd>
        `;
    }
    setText(el.overlayPixelX, pixel.x);
    setText(el.overlayPixelY, pixel.y);
}

function renderSpectralProfile(spectrum, pixel) {
    if (!el.spectralChart || !spectrum || spectrum.length === 0) {
        return;
    }

    const values = Array.from(spectrum, Number).filter(Number.isFinite);
    if (values.length === 0) {
        return;
    }

    const spectralAxis = resolveSpectralAxis(demoState.header, values.length);
    const xValues = spectralAxis.values;
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...values);
    const maxY = Math.max(...values);
    const width = 380;
    const height = 118;
    const pad = { left: 34, right: 14, top: 8, bottom: 24 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const ySpan = maxY - minY || 1;
    const xSpan = maxX - minX || 1;

    const points = values.map((value, index) => {
        const xValue = xValues[index];
        const x = pad.left + ((xValue - minX) / xSpan) * plotWidth;
        const y = pad.top + (1 - ((value - minY) / ySpan)) * plotHeight;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');

    const xDigits = spectralAxis.isBandIndex || maxX > 100 ? 0 : 2;
    setText(el.spectralTitle, `Spectral Profile @ (${pixel.x}, ${pixel.y})`);
    el.spectralChart.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Spectral profile">
            <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" stroke="#cfd6df" />
            <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" stroke="#cfd6df" />
            <polyline points="${points}" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
            <text x="${pad.left}" y="${height - 6}" font-size="10" fill="#4b5565">${formatNumber(minX, xDigits)}</text>
            <text x="${width - pad.right - 48}" y="${height - 6}" font-size="10" fill="#4b5565">${formatNumber(maxX, xDigits)}</text>
            <text x="${width / 2 - 34}" y="${height - 6}" font-size="10" fill="#4b5565">${spectralAxis.label}</text>
            <text x="4" y="${pad.top + 6}" font-size="10" fill="#4b5565">${formatNumber(maxY, 2)}</text>
            <text x="4" y="${height - pad.bottom}" font-size="10" fill="#4b5565">${formatNumber(minY, 2)}</text>
        </svg>
    `;
}

function resetSpectralProfile() {
    setText(el.spectralTitle, 'Spectral Profile');
    if (el.spectralChart) {
        el.spectralChart.innerHTML = '<div class="empty-chart">Click the image to sample a spectrum.</div>';
    }
}

function clearViewerReadouts() {
    resetProbeReadout();
    resetSpectralProfile();
    demoState.lastProbe = null;
}

function populateSampleCatalogSelect(samples) {
    if (!el.sampleCatalogSelect) return;
    el.sampleCatalogSelect.innerHTML = '';
    if (!Array.isArray(samples) || samples.length === 0) {
        el.sampleCatalogSelect.add(new Option('No registered samples', ''));
        el.sampleCatalogSelect.disabled = true;
        return;
    }

    for (const sample of samples) {
        el.sampleCatalogSelect.add(new Option(sample.title, sample.id));
    }
}

function setBandInputsEnabled(enabled) {
    [
        el.rBandSelect,
        el.gBandSelect,
        el.bBandSelect,
        el.rBandSlider,
        el.gBandSlider,
        el.bBandSlider,
        el.randomBandsBtn,
        el.resetBandsBtn,
    ].forEach((node) => {
        if (node) node.disabled = !enabled;
    });
}

function populateBandControls(bandCount, bands) {
    const selects = [el.rBandSelect, el.gBandSelect, el.bBandSelect];
    const sliders = [el.rBandSlider, el.gBandSlider, el.bBandSlider];
    const values = [bands.r, bands.g, bands.b];

    selects.forEach((select, index) => {
        if (!select) return;
        select.innerHTML = '';
        for (let band = 1; band <= bandCount; band += 1) {
            select.add(new Option(String(band), String(band)));
        }
        select.value = String(values[index]);
    });

    sliders.forEach((slider, index) => {
        if (!slider) return;
        slider.min = '1';
        slider.max = String(bandCount);
        slider.value = String(values[index]);
    });

    setBandInputsEnabled(true);
}

function syncBandControls(bands) {
    if (!bands) return;
    for (const [select, value] of [
        [el.rBandSelect, bands.r],
        [el.gBandSelect, bands.g],
        [el.bBandSelect, bands.b],
        [el.rBandSlider, bands.r],
        [el.gBandSlider, bands.g],
        [el.bBandSlider, bands.b],
    ]) {
        if (select) select.value = String(value);
    }
}

function currentBandsFromControls() {
    return {
        r: Number(el.rBandSelect?.value),
        g: Number(el.gBandSelect?.value),
        b: Number(el.bBandSelect?.value),
    };
}

function setBandControls(nextBands) {
    syncBandControls(nextBands);
    demoState.viewer?.setBands(nextBands);
}

function disableControls(text = 'Processing...') {
    if (el.selectFileBtn) {
        el.selectFileBtn.disabled = true;
        el.selectFileBtn.textContent = text;
    }
    if (el.loadSampleBtn) el.loadSampleBtn.disabled = true;
    if (el.sampleCatalogSelect) el.sampleCatalogSelect.disabled = true;
    setBandInputsEnabled(false);
}

function enableControls() {
    if (el.selectFileBtn) {
        el.selectFileBtn.disabled = false;
        el.selectFileBtn.textContent = 'Load Local ENVI...';
    }
    if (el.sampleCatalogSelect && demoState.sampleCatalog?.samples?.length > 0) {
        el.sampleCatalogSelect.disabled = false;
    }
    if (el.loadSampleBtn && demoState.sampleCatalog?.samples?.length > 0) {
        el.loadSampleBtn.disabled = false;
    }
    if (demoState.header) {
        setBandInputsEnabled(true);
    }
}

function getRandomBands(maxBand) {
    if (maxBand < 3) return null;
    const picked = new Set();
    while (picked.size < 3) {
        picked.add(Math.floor(Math.random() * maxBand) + 1);
    }
    const [r, g, b] = [...picked];
    return { r, g, b };
}

function buildReport() {
    return {
        generatedAt: new Date().toISOString(),
        sampleId: demoState.activeSampleId,
        rendererStatus: demoState.rendererStatus,
        header: demoState.header,
        metadata: demoState.metadata,
        metrics: demoState.metrics,
        bands: demoState.bands,
        probe: demoState.lastProbe,
        logs: demoState.logs,
    };
}

function renderMetadataDetails() {
    if (!el.metadataContainer) return;
    const details = {
        sampleId: demoState.activeSampleId,
        source: demoState.metadata,
        header: demoState.header,
        renderer: demoState.rendererStatus,
        bands: demoState.bands,
    };
    el.metadataContainer.textContent = JSON.stringify(details, null, 2);
}

function toggleMetadataDetails(force) {
    if (!el.metadataContainer || !el.metadataToggleBtn) return;
    const nextHidden = typeof force === 'boolean'
        ? !force
        : !el.metadataContainer.hidden;
    if (!nextHidden) {
        renderMetadataDetails();
    }
    el.metadataContainer.hidden = nextHidden;
    setText(el.metadataToggleBtn, nextHidden ? 'View Full Metadata' : 'Hide Full Metadata');
}

function downloadReport() {
    const blob = new Blob([`${JSON.stringify(buildReport(), null, 2)}\n`], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cubescope-demo-report.json';
    link.click();
    URL.revokeObjectURL(url);
}

function downloadScreenshot() {
    const canvas = el.viewerContainer?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'cubescope-viewer.png';
    link.click();
}

function resolveMiniMapLayout(header = demoState.header) {
    const miniCanvas = el.miniMapCanvas;
    const frame = miniCanvas?.parentElement;
    const frameWidth = frame?.clientWidth || 130;
    const frameHeight = frame?.clientHeight || 130;
    const boxWidth = Math.max(1, frameWidth - MINI_MAP_INSET * 2);
    const boxHeight = Math.max(1, frameHeight - MINI_MAP_INSET * 2);
    const samples = Number(header?.samples);
    const lines = Number(header?.lines);
    const aspect = samples > 0 && lines > 0 ? samples / lines : 1;
    let displayWidth = boxWidth;
    let displayHeight = boxHeight;

    if (aspect >= 1) {
        displayHeight = boxWidth / aspect;
    } else {
        displayWidth = boxHeight * aspect;
    }

    displayWidth = Math.max(1, Math.min(boxWidth, displayWidth));
    displayHeight = Math.max(1, Math.min(boxHeight, displayHeight));

    const pixelWidth = aspect >= 1
        ? MINI_MAP_BACKING_LONG_SIDE
        : Math.max(1, Math.round(MINI_MAP_BACKING_LONG_SIDE * aspect));
    const pixelHeight = aspect >= 1
        ? Math.max(1, Math.round(MINI_MAP_BACKING_LONG_SIDE / aspect))
        : MINI_MAP_BACKING_LONG_SIDE;

    return {
        left: MINI_MAP_INSET + (boxWidth - displayWidth) / 2,
        top: MINI_MAP_INSET + (boxHeight - displayHeight) / 2,
        displayWidth,
        displayHeight,
        pixelWidth,
        pixelHeight,
    };
}

function applyMiniMapLayout(header = demoState.header) {
    const miniCanvas = el.miniMapCanvas;
    if (!miniCanvas) return null;

    const layout = resolveMiniMapLayout(header);
    miniCanvas.style.left = `${layout.left}px`;
    miniCanvas.style.top = `${layout.top}px`;
    miniCanvas.style.width = `${layout.displayWidth}px`;
    miniCanvas.style.height = `${layout.displayHeight}px`;

    if (miniCanvas.width !== layout.pixelWidth || miniCanvas.height !== layout.pixelHeight) {
        miniCanvas.width = layout.pixelWidth;
        miniCanvas.height = layout.pixelHeight;
    }

    return layout;
}

function getMiniMapDisplayRect() {
    const miniCanvas = el.miniMapCanvas;
    if (!miniCanvas) {
        return {
            left: MINI_MAP_INSET,
            top: MINI_MAP_INSET,
            width: 1,
            height: 1,
        };
    }

    return {
        left: miniCanvas.offsetLeft || Number.parseFloat(miniCanvas.style.left) || MINI_MAP_INSET,
        top: miniCanvas.offsetTop || Number.parseFloat(miniCanvas.style.top) || MINI_MAP_INSET,
        width: miniCanvas.clientWidth || Number.parseFloat(miniCanvas.style.width) || miniCanvas.width || 1,
        height: miniCanvas.clientHeight || Number.parseFloat(miniCanvas.style.height) || miniCanvas.height || 1,
    };
}

function resetMiniMap() {
    const miniCanvas = el.miniMapCanvas;
    if (!miniCanvas) return;
    applyMiniMapLayout(demoState.header);
    const context = miniCanvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    context.fillStyle = '#05080d';
    context.fillRect(0, 0, miniCanvas.width, miniCanvas.height);
    updateMiniMapWindow(demoState.viewportState);
}

function drawMiniMapTile(tileEvent) {
    const miniCanvas = el.miniMapCanvas;
    const header = tileEvent?.header ?? demoState.header;
    const pixels = tileEvent?.pixels;
    const tile = tileEvent?.tile;
    const effectiveWidth = Number(tileEvent?.effectiveWidth);
    const effectiveHeight = Number(tileEvent?.effectiveHeight);
    if (!miniCanvas || !header || !pixels || !tile || !(effectiveWidth > 0) || !(effectiveHeight > 0)) {
        return;
    }

    try {
        applyMiniMapLayout(header);
        miniMapTileCanvas.width = effectiveWidth;
        miniMapTileCanvas.height = effectiveHeight;
        const tileContext = miniMapTileCanvas.getContext('2d');
        if (!tileContext) return;
        const data = pixels instanceof Uint8ClampedArray
            ? pixels
            : new Uint8ClampedArray(
                pixels.buffer.slice(pixels.byteOffset, pixels.byteOffset + pixels.byteLength)
            );
        tileContext.putImageData(new ImageData(data, effectiveWidth, effectiveHeight), 0, 0);

        const context = miniCanvas.getContext('2d');
        const tileSize = Number(tileEvent.tileSize) || 512;
        const dx = (tile.x * tileSize / header.samples) * miniCanvas.width;
        const dy = (tile.y * tileSize / header.lines) * miniCanvas.height;
        const dw = (effectiveWidth / header.samples) * miniCanvas.width;
        const dh = (effectiveHeight / header.lines) * miniCanvas.height;
        context.drawImage(miniMapTileCanvas, 0, 0, effectiveWidth, effectiveHeight, dx, dy, dw, dh);
    } catch {
        resetMiniMap();
    }
}

function updateMiniMapWindow(viewportState = demoState.viewportState) {
    const windowEl = el.miniMapWindow;
    const miniCanvas = el.miniMapCanvas;
    if (!windowEl || !miniCanvas) return;

    const bounds = viewportState?.visibleBounds ?? { x: 0, y: 0, width: 1, height: 1 };
    const rect = getMiniMapDisplayRect();
    const left = rect.left + clampUnit(bounds.x) * rect.width;
    const top = rect.top + clampUnit(bounds.y) * rect.height;
    const width = Math.max(8, clampUnit(bounds.width, 1) * rect.width);
    const height = Math.max(8, clampUnit(bounds.height, 1) * rect.height);
    windowEl.style.left = `${left}px`;
    windowEl.style.top = `${top}px`;
    windowEl.style.width = `${width}px`;
    windowEl.style.height = `${height}px`;
}

function scheduleMiniMapWindowSync(delay = 0) {
    if (!el.miniMapWindow) return;
    if (miniMapFrame) {
        cancelAnimationFrame(miniMapFrame);
        miniMapFrame = 0;
    }

    const run = () => {
        miniMapFrame = requestAnimationFrame(() => {
            miniMapFrame = 0;
            updateMiniMapWindow(demoState.viewer?.getViewportState?.() ?? demoState.viewportState);
        });
    };

    if (delay > 0) {
        window.setTimeout(run, delay);
    } else {
        run();
    }
}

function switchRendererMode(nextRenderer) {
    if (!nextRenderer || nextRenderer === requestedRenderer) {
        return;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('renderer', nextRenderer);
    const selectedSampleId = el.sampleCatalogSelect?.value;
    const selectedExists = demoState.sampleCatalog?.samples?.some((sample) => sample.id === selectedSampleId);
    const activeSampleId = demoState.activeSampleId || requestedSampleId || (selectedExists ? selectedSampleId : null);
    if (activeSampleId) {
        nextUrl.searchParams.set('sample', activeSampleId);
    } else {
        nextUrl.searchParams.delete('sample');
    }
    appendEvent(`Renderer switch requested: ${nextRenderer.toUpperCase()}`, {
        source: 'Renderer',
    });
    disableControls('Switching...');
    window.location.assign(nextUrl.href);
}

async function main() {
    if (!el.viewerContainer) {
        appendEvent('Viewer container not found.', { level: 'ERROR', source: 'UI' });
        return;
    }

    resetProbeReadout();
    resetSpectralProfile();
    renderRendererStatus();
    renderDatasetSummary();
    resetMiniMap();
    disableControls('Initializing...');

    const viewer = new CubeViewer(el.viewerContainer, {
        ...getProductionRuntimeAssetOptions(),
        enableBackgroundStats: !benchmarkMode,
        enableTilePreloading: !benchmarkMode,
        rendererPreference: requestedRenderer,
    });
    demoState.viewer = viewer;
    appendEvent(`Renderer preference: ${requestedRenderer}`, { source: 'Renderer' });

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
        if (el.sampleCatalogSelect) el.sampleCatalogSelect.value = sample.id;
        setText(el.fileNameSpan, sample.title);
        appendEvent(`Parsing ENVI header (remote): ${sample.title}`, { source: 'Loader' });
        await viewer.load(buildRemoteSampleLoadSource(resolveSampleForDemo(sample)));
        return sample;
    }

    demoState.loadRegisteredSample = loadRegisteredSample;

    async function initializeSampleCatalog() {
        try {
            const catalog = await fetchRemoteSampleCatalog(demoState.sampleCatalogUrl);
            demoState.sampleCatalog = catalog;
            populateSampleCatalogSelect(catalog.samples);
            appendEvent(`Sample catalog ready: ${demoState.sampleCatalogUrl}`, { source: 'Network' });
            enableControls();
            return catalog;
        } catch (error) {
            if (el.sampleCatalogSelect) {
                el.sampleCatalogSelect.innerHTML = '';
                el.sampleCatalogSelect.add(new Option('Registered samples unavailable', ''));
                el.sampleCatalogSelect.disabled = true;
            }
            if (el.loadSampleBtn) el.loadSampleBtn.disabled = true;
            appendEvent(`Registered sample catalog unavailable: ${error.message}`, {
                level: 'WARN',
                source: 'Network',
            });
            return null;
        }
    }

    viewer.on('log', log);
    viewer.on('error', (message) => {
        demoState.errors.push(String(message));
        appendEvent(message, { level: 'ERROR', source: 'Runtime' });
    });
    viewer.on('ready', () => {
        demoState.ready = true;
        appendEvent('Viewer runtime ready', { source: 'Runtime' });
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
        bandSwitchCount = 0;
        setText(el.metricInitialView, '--');
        setText(el.metricBandSwitch, '--');
        setText(el.perfInitialView, '--');
        setText(el.perfBandSwitch, '--');
        setText(el.perfTileLoad, '--');
        setText(el.bandSwitchCountSpan, 'Band Switch Count: 0');
        clearViewerReadouts();
        renderDatasetSummary();
        demoState.viewportState = null;
        resetMiniMap();
        disableControls('Loading...');
    });
    viewer.on('header', (header) => {
        demoState.header = header;
        demoState.headerAt = performance.now();
        demoState.headerParseTime = demoState.loadStartAt === null
            ? null
            : demoState.headerAt - demoState.loadStartAt;
        defaultBands = selectDefaultBandsForHeader(header);
        demoState.bands = defaultBands;
        populateBandControls(header.bands, defaultBands);
        renderDatasetSummary();
        appendEvent(`Parsed: ${header.samples} x ${header.lines} x ${header.bands}, ${String(header.interleave).toUpperCase()}`, {
            source: 'Loader',
        });
        resetMiniMap();
        scheduleMiniMapWindowSync(200);
        enableControls();
    });
    viewer.on('metadata', (metadata) => {
        demoState.metadata = metadata;
        networkCount = metadata?.sourceKind === 'http-range' ? Math.max(networkCount, 1) : networkCount;
        updateCounts();
        renderDatasetSummary();
        setText(el.requestSummary, metadata?.sourceKind === 'http-range' ? 'HTTP range requests' : 'Local File API');
    });
    viewer.on('loadend', () => {
        demoState.loaded = true;
        demoState.loadEndAt = performance.now();
        appendEvent('Initial view ready', { level: 'PERF', source: 'Renderer' });
        scheduleMiniMapWindowSync(350);
        enableControls();
    });
    viewer.on('bandschange', (bands) => {
        demoState.bands = bands;
        syncBandControls(bands);
        if (demoState.loaded) {
            bandSwitchCount += 1;
            appendEvent(`Band switch: R=${bands.r}, G=${bands.g}, B=${bands.b}`, { source: 'UI' });
        }
        setText(el.bandSwitchCountSpan, `Band Switch Count: ${bandSwitchCount}`);
        if (demoState.loaded) {
            resetMiniMap();
        }
        scheduleMiniMapWindowSync(350);
    });
    viewer.on('performance', (metric) => {
        demoState.metrics.push({ ...metric, capturedAt: performance.now() });
        renderMetric(metric);
        scheduleMiniMapWindowSync(250);
    });
    viewer.on('progress', (data) => {
        if (data.type === 'stats_calculation') {
            appendEvent(`Global statistics computed: ${data.processed}/${data.total}`, { source: 'Stats' });
        }
    });
    viewer.on('tileloaded', (tileEvent) => {
        drawMiniMapTile(tileEvent);
        updateMiniMapWindow(demoState.viewer?.getViewportState?.() ?? demoState.viewportState);
    });
    viewer.on('viewchange', (viewportState) => {
        demoState.viewportState = viewportState;
        updateMiniMapWindow(viewportState);
    });
    viewer.on('image-clicked', async ({ x, y }) => {
        if (!['probe', 'pixel-inspector', 'spectral-profile'].includes(activeTool)) {
            setText(el.overlayPixelX, x);
            setText(el.overlayPixelY, y);
            appendEvent(`Canvas click ignored in ${activeTool.replace(/-/g, ' ')} mode at (${x}, ${y})`, {
                source: 'UI',
            });
            return;
        }

        const world = viewer.pixelToWorld(x, y);
        let spectrum = null;
        try {
            spectrum = await viewer.getSpectralProfile(x, y);
        } catch (error) {
            appendEvent(`Spectral profile failed: ${error.message}`, { level: 'ERROR', source: 'Probe' });
        }

        const probe = {
            pixel: { x, y },
            world,
            spatialReference: viewer.getHeader()?.spatialReference,
        };
        demoState.lastProbe = probe;
        renderProbe({ pixel: probe.pixel, world, spectrum });
        renderSpectralProfile(spectrum, probe.pixel);
        appendEvent(`Probe pixel (${x}, ${y})`, { source: 'Probe' });
        scheduleMiniMapWindowSync();
    });

    el.rendererModeSelect?.addEventListener('change', () => {
        switchRendererMode(el.rendererModeSelect.value);
    });
    document.querySelectorAll('.console-tab[data-console-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            activeConsoleTab = button.dataset.consoleTab || 'all';
            document.querySelectorAll('.console-tab[data-console-tab]').forEach((tab) => {
                tab.classList.toggle('active', tab === button);
            });
            renderEventLog();
        });
    });
    el.toggleConsoleBtn?.addEventListener('click', () => {
        const collapsed = !el.eventConsole?.classList.contains('is-collapsed');
        el.eventConsole?.classList.toggle('is-collapsed', collapsed);
        el.viewportPanel?.classList.toggle('is-console-collapsed', collapsed);
        el.toggleConsoleBtn?.setAttribute('aria-expanded', String(!collapsed));
        scheduleMiniMapWindowSync(120);
    });
    document.querySelectorAll('[data-panel-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
            const panel = button.closest('.side-panel');
            const collapsed = !panel?.classList.contains('is-collapsed');
            panel?.classList.toggle('is-collapsed', collapsed);
            button.setAttribute('aria-expanded', String(!collapsed));
        });
    });
    document.querySelectorAll('.tool-button[data-tool]').forEach((button) => {
        button.addEventListener('click', () => setActiveTool(button.dataset.tool));
    });
    el.selectFileBtn?.addEventListener('click', () => el.fileInput?.click());
    el.fileInput?.addEventListener('change', async () => {
        const files = Array.from(el.fileInput.files ?? []);
        const headerFile = files.find((file) => file.name.toLowerCase().endsWith('.hdr'));
        const dataFile = files.find((file) => !file.name.toLowerCase().endsWith('.hdr'));
        if (!headerFile || !dataFile) {
            appendEvent('Select one .hdr file and one ENVI data file.', { level: 'ERROR', source: 'Loader' });
            el.fileInput.value = '';
            return;
        }

        setText(el.fileNameSpan, `${headerFile.name}, ${dataFile.name}`);
        await viewer.load({
            kind: 'envi-local',
            headerFile,
            dataFile,
        });
        el.fileInput.value = '';
    });
    el.loadSampleBtn?.addEventListener('click', async () => {
        try {
            if (!el.sampleCatalogSelect?.value) {
                appendEvent('No registered sample selected.', { level: 'WARN', source: 'UI' });
                return;
            }
            await loadRegisteredSample(el.sampleCatalogSelect.value);
        } catch (error) {
            appendEvent(`Registered sample load failed: ${error.message}`, {
                level: 'ERROR',
                source: 'Loader',
            });
        }
    });

    const applyBandChange = () => setBandControls(currentBandsFromControls());
    for (const [select, slider] of [
        [el.rBandSelect, el.rBandSlider],
        [el.gBandSelect, el.gBandSlider],
        [el.bBandSelect, el.bBandSlider],
    ]) {
        select?.addEventListener('change', () => {
            if (slider) slider.value = select.value;
            applyBandChange();
        });
        slider?.addEventListener('input', () => {
            if (select) select.value = slider.value;
            applyBandChange();
        });
    }
    el.randomBandsBtn?.addEventListener('click', () => {
        const header = viewer.getHeader();
        const nextBands = header ? getRandomBands(header.bands) : null;
        if (nextBands) setBandControls(nextBands);
    });
    el.resetBandsBtn?.addEventListener('click', () => {
        if (defaultBands) setBandControls(defaultBands);
    });
    document.querySelectorAll('[data-zoom-action]').forEach((button) => {
        button.addEventListener('click', () => {
            const action = button.dataset.zoomAction;
            if (action === 'in') {
                viewer.zoomBy?.(1.2);
                appendEvent('Zoom in', { source: 'UI' });
            } else if (action === 'out') {
                viewer.zoomBy?.(1 / 1.2);
                appendEvent('Zoom out', { source: 'UI' });
            } else {
                viewer.resetView?.();
                clearViewerReadouts();
                appendEvent(action === 'fit' ? 'Fit view to window' : 'View reset to full extent', {
                    source: 'UI',
                });
            }
        });
    });
    el.metadataToggleBtn?.addEventListener('click', () => toggleMetadataDetails());
    el.clearSpectralBtn?.addEventListener('click', resetSpectralProfile);
    el.clearLogBtn?.addEventListener('click', clearEventLog);
    el.pauseLogBtn?.addEventListener('click', () => {
        logPaused = !logPaused;
        setText(el.pauseLogBtn, logPaused ? 'Resume' : 'Pause');
        if (!logPaused) {
            renderEventLog();
        }
    });
    el.enableBgStats?.addEventListener('change', (event) => {
        viewer.updateConfig({ backgroundStats: event.target.checked });
    });
    el.enableTilePreload?.addEventListener('change', (event) => {
        viewer.updateConfig({ tilePreloading: event.target.checked });
    });
    el.downloadReportBtn?.addEventListener('click', downloadReport);
    el.screenshotBtn?.addEventListener('click', downloadScreenshot);
    el.toolScreenshotBtn?.addEventListener('click', downloadScreenshot);
    el.infoBtn?.addEventListener('click', () => {
        toggleMetadataDetails(true);
        appendEvent('Metadata details requested', { source: 'UI' });
    });
    el.helpBtn?.addEventListener('click', () => {
        appendEvent('Help: drag to pan, scroll to zoom, choose Probe or Spectral Profile before sampling.', {
            source: 'UI',
        });
    });
    el.moreBtn?.addEventListener('click', () => {
        el.debugPanel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        appendEvent('Advanced diagnostics focused', { source: 'UI' });
    });
    el.resetViewBtn?.addEventListener('click', () => {
        viewer.resetView?.();
        clearViewerReadouts();
        appendEvent('View reset to full extent', { source: 'UI' });
    });
    await viewer.init();
    await initializeSampleCatalog();

    if (requestedSampleId) {
        try {
            await loadRegisteredSample(requestedSampleId);
        } catch (error) {
            appendEvent(`Auto-load sample failed: ${error.message}`, {
                level: 'ERROR',
                source: 'Loader',
            });
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    main().catch((error) => {
        console.error('Example startup failed:', error);
        appendEvent(`Example startup failed: ${error.message}`, { level: 'ERROR', source: 'Runtime' });
        disableControls('Initialization Failed');
    });
});
