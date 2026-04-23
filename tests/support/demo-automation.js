import {
    defaultRemoteCatalogUrl,
    fixtureHdrPath,
    fixtureImgPath,
    remoteSampleCatalogUrl,
    registeredHttpSampleId,
} from './paths.js';

export async function waitForDemoReady(page) {
    await page.waitForFunction(() => window.__cubescopeDemoState?.ready === true);
}

export function buildExampleUrl({
    benchmark = false,
    sampleId = null,
    catalogUrl = remoteSampleCatalogUrl,
    renderer = null,
} = {}) {
    const search = new URLSearchParams();

    if (benchmark) {
        search.set('benchmark', '1');
    }

    if (sampleId) {
        search.set('sample', sampleId);
    }

    if (catalogUrl && catalogUrl !== defaultRemoteCatalogUrl) {
        search.set('catalog', catalogUrl);
    }

    if (renderer) {
        search.set('renderer', renderer);
    }

    const query = search.toString();
    return `/examples/${query ? `?${query}` : ''}`;
}

export async function waitForRegisteredSamplesReady(page) {
    await page.waitForFunction(() => {
        const state = window.__cubescopeDemoState;
        return Boolean(state?.sampleCatalog?.samples?.length > 0);
    }, undefined, { timeout: 60_000 });
}

export async function loadFixtureIntoExample(page) {
    await page.setInputFiles('#fileInput', [fixtureHdrPath, fixtureImgPath]);
}

export async function loadHttpFixtureIntoExample(page) {
    await loadRegisteredSampleIntoExample(page, registeredHttpSampleId);
}

export async function loadRegisteredSampleIntoExample(page, sampleId = registeredHttpSampleId) {
    await waitForRegisteredSamplesReady(page);
    await page.evaluate((nextSampleId) => {
        return window.__cubescopeDemoState?.loadRegisteredSample?.(nextSampleId);
    }, sampleId);
}

export async function waitForInitialRender(page, options = {}) {
    const {
        requirePerformanceMetric = true,
    } = options;

    await page.waitForFunction(({ requirePerformanceMetric: shouldRequirePerformanceMetric }) => {
        const state = window.__cubescopeDemoState;
        return Boolean(
            state?.header
            && state?.loaded
            && (!shouldRequirePerformanceMetric
                || state.metrics?.some((metric) => metric.name === 'timeToInitialView'))
            && (!state.errors || state.errors.every(
                (message) => String(message).includes('Renderer recovery failed: Failed to acquire WebGPU adapter')
            ))
        );
    }, { requirePerformanceMetric }, {
        timeout: 60_000,
        polling: 100,
    });

    return page.evaluate(() => window.__cubescopeDemoState);
}

export async function probeFixtureAt(page, options = {}) {
    const {
        requireWorld = true,
    } = options;

    await page.locator('#viewer-container canvas').click();
    await page.waitForFunction(({ requireWorld: shouldRequireWorld }) => {
        const state = window.__cubescopeDemoState;
        return Boolean(
            state?.lastProbe?.pixel
            && (!shouldRequireWorld || state?.lastProbe?.world)
        );
    }, { requireWorld }, { timeout: 60_000 });

    return page.evaluate(() => window.__cubescopeDemoState?.lastProbe);
}

export async function triggerBandSwitch(page) {
    await page.selectOption('#rBandSelect', '31');
    await page.selectOption('#gBandSelect', '21');
    await page.selectOption('#bBandSelect', '11');
    await page.waitForFunction(() => {
        const state = window.__cubescopeDemoState;
        return state?.metrics?.some((metric) => metric.name === 'bandSwitchTime');
    }, undefined, { timeout: 60_000 });

    return page.evaluate(() => window.__cubescopeDemoState);
}

export async function triggerBandSwitchDirect(page, bands = { r: 31, g: 21, b: 11 }) {
    await page.evaluate((nextBands) => {
        window.__cubescopeDemoState?.viewer?.setBands(nextBands);
    }, bands);
    await page.waitForFunction(() => {
        const state = window.__cubescopeDemoState;
        return state?.metrics?.some((metric) => metric.name === 'bandSwitchTime');
    }, undefined, { timeout: 60_000 });

    return page.evaluate(() => window.__cubescopeDemoState);
}
