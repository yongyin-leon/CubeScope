import { chromium, expect, test } from '@playwright/test';

import {
    buildExampleUrl,
    loadFixtureIntoExample,
    probeFixtureAt,
    waitForDemoReady,
    waitForInitialRender,
} from '../support/demo-automation.js';
import { registeredHttpSampleId } from '../support/paths.js';

function getActionableErrors(state) {
    return (state.errors ?? []).filter(
        (message) => !String(message).includes('Renderer recovery failed: Failed to acquire WebGPU adapter')
    );
}

test('loads the synthetic ENVI cube through the WebGL compatibility path and emits the initial performance metric', async ({ page }) => {
    await page.goto(buildExampleUrl({ renderer: 'webgl' }));
    await waitForDemoReady(page);
    await loadFixtureIntoExample(page);

    const state = await waitForInitialRender(page);
    const probe = await probeFixtureAt(page);

    expect(state.header).toBeTruthy();
    expect(state.header.bands).toBe(32);
    expect(state.header.spatialReference?.mapInfo?.units).toBe('Meters');
    expect(state.loaded).toBe(true);
    expect(state.metrics.some((metric) => metric.name === 'timeToInitialView')).toBe(true);
    expect(probe.pixel).toBeTruthy();
    expect(probe.world).toBeTruthy();
    expect(getActionableErrors(state)).toEqual([]);
});

test('loads the synthetic ENVI cube through the forced WebGL fallback renderer', async ({ page }) => {
    await page.goto(buildExampleUrl({ renderer: 'webgl' }));
    await waitForDemoReady(page);
    await loadFixtureIntoExample(page);

    const state = await waitForInitialRender(page);
    const probe = await probeFixtureAt(page);

    expect(state.header).toBeTruthy();
    expect(state.loaded).toBe(true);
    expect(probe.world).toBeTruthy();
    expect(await page.evaluate(() => window.__cubescopeDemoState?.rendererPreference)).toBe('webgl');
    expect(getActionableErrors(state)).toEqual([]);
});

test('loads the synthetic ENVI cube through the WebGL compatibility path over HTTP range', async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader-webgpu'],
    });

    try {
        const page = await browser.newPage({ baseURL: 'http://127.0.0.1:4173' });
        await page.goto(buildExampleUrl({
            benchmark: true,
            sampleId: registeredHttpSampleId,
            renderer: 'webgl',
        }));
        await waitForDemoReady(page);

        // The dedicated benchmark owns remote timing assertions. Smoke keeps the
        // remote path focused on load/interactability because headless WebGPU
        // adapter recovery can delay or suppress the timing event.
        const state = await waitForInitialRender(page, { requirePerformanceMetric: false });
        const probe = await probeFixtureAt(page);

        expect(state.header).toBeTruthy();
        expect(state.metadata?.sourceKind).toBe('http-range');
        expect(state.header.bands).toBe(32);
        expect(state.loaded).toBe(true);
        expect(probe.world).toBeTruthy();
        expect(getActionableErrors(state)).toEqual([]);
    } finally {
        await browser.close();
    }
});
