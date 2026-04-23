import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import {
    normalizeRemoteSampleCatalog,
} from '../../src/samples/remote-sample-catalog.js';
import {
    buildExampleUrl,
    probeFixtureAt,
    waitForDemoReady,
    waitForInitialRender,
} from '../support/demo-automation.js';
import {
    projectRoot,
    remoteSampleCatalogUrl,
} from '../support/paths.js';

const reportPath = resolve(
    projectRoot,
    process.env.CUBESCOPE_SAMPLE_REPORT_PATH ?? 'output/samples/latest.json'
);
const requestedTier = process.env.CUBESCOPE_SAMPLE_TIER ?? 'local';

function getActionableErrors(state) {
    return (state.errors ?? []).filter(
        (message) => !String(message).includes('Renderer recovery failed: Failed to acquire WebGPU adapter')
    );
}

test('validates the registered remote-sample catalog', async ({ page, request, baseURL }) => {
    const catalogResponse = await request.get(remoteSampleCatalogUrl);
    expect(catalogResponse.ok()).toBe(true);

    const catalog = normalizeRemoteSampleCatalog(await catalogResponse.json());
    const selectedSamples = requestedTier === 'all'
        ? catalog.samples
        : catalog.samples.filter((sample) => sample.validationTier === requestedTier);

    expect(selectedSamples.length).toBeGreaterThan(0);

    const sampleReports = [];
    for (const sample of selectedSamples) {
        const headerResponse = await request.get(sample.headerUrl, {
            headers: sample.headers,
        });
        expect(headerResponse.ok()).toBe(true);

        const rangeResponse = await request.get(sample.dataUrl, {
            headers: {
                ...(sample.headers ?? {}),
                Range: 'bytes=0-15',
            },
        });
        expect(rangeResponse.status()).toBe(206);

        await page.goto(buildExampleUrl({
            benchmark: true,
            sampleId: sample.id,
            renderer: 'webgl',
        }));
        await waitForDemoReady(page);
        const state = await waitForInitialRender(page, { requirePerformanceMetric: false });
        const probe = await probeFixtureAt(page, { requireWorld: false });
        const actionableErrors = getActionableErrors(state);

        expect(state.loaded).toBe(true);
        expect(state.metadata?.sourceKind).toBe('http-range');
        expect(actionableErrors).toEqual([]);

        sampleReports.push({
            id: sample.id,
            title: sample.title,
            availability: sample.availability,
            validationTier: sample.validationTier,
            transport: {
                headerStatus: headerResponse.status(),
                rangeStatus: rangeResponse.status(),
                contentRange: rangeResponse.headers()['content-range'] ?? null,
            },
            browser: {
                baseURL: baseURL ?? null,
                loaded: state.loaded === true,
                sourceKind: state.metadata?.sourceKind ?? null,
                dimensions: state.metadata?.dimensions ?? null,
                bands: state.header?.bands ?? null,
                hasPixelProbe: Boolean(probe?.pixel),
                hasWorldProbe: Boolean(probe?.world),
            },
        });
    }

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        catalogId: catalog.catalogId ?? null,
        tier: requestedTier,
        totalSamples: sampleReports.length,
        samples: sampleReports,
    }, null, 2)}\n`);
});
