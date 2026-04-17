import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';

import { chromium } from '@playwright/test';

import { loadFixtureIntoExample, triggerBandSwitchDirect, waitForDemoReady, waitForInitialRender } from '../../tests/support/demo-automation.js';
import { projectRoot } from '../../tests/support/paths.js';

const benchmarkDir = resolve(projectRoot, 'output/benchmark');
const benchmarkPath = resolve(benchmarkDir, 'latest.json');
const serverCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const serverArgs = ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'];

async function waitForServer(url, timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch (error) {
            // ignore and retry
        }
        await sleep(500);
    }

    throw new Error(`Timed out waiting for ${url}`);
}

const server = spawn(serverCommand, serverArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
});

async function collectInitialMetrics() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader-webgpu'],
    });

    try {
        const page = await browser.newPage({ baseURL: 'http://127.0.0.1:4173' });
        await page.goto('/examples/?benchmark=1');
        await waitForDemoReady(page);
        await loadFixtureIntoExample(page);
        const initialState = await waitForInitialRender(page);

        return {
            browserVersion: await browser.version(),
            state: initialState,
        };
    } finally {
        await browser.close();
    }
}

async function collectBandSwitchMetric() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader-webgpu'],
    });

    try {
        const page = await browser.newPage({ baseURL: 'http://127.0.0.1:4173' });
        await page.goto('/examples/?benchmark=1');
        await waitForDemoReady(page);
        await loadFixtureIntoExample(page);
        await page.waitForFunction(() => {
            const state = window.__cubescopeDemoState;
            return Boolean(
                state?.header
                && state?.loaded
                && (!state.errors || state.errors.length === 0)
                && state.logs?.some((entry) => entry.includes('Setting initial focused view'))
            );
        }, undefined, { timeout: 60_000 });

        try {
            return await triggerBandSwitchDirect(page);
        } catch (error) {
            const state = await page.evaluate(() => window.__cubescopeDemoState);
            throw new Error([
                `Benchmark band-switch phase failed: ${error.message}`,
                `Current demo state: ${JSON.stringify(state)}`,
            ].join('\n'));
        }
    } finally {
        await browser.close();
    }
}

try {
    await waitForServer('http://127.0.0.1:4173/examples/');
    const { browserVersion, state: initialState } = await collectInitialMetrics();
    const switchedState = await collectBandSwitchMetric();

    const metrics = [
        ...(initialState.metrics ?? []),
        ...(switchedState.metrics ?? []),
    ];
    const getMetricValue = (name) => metrics.find((metric) => metric.name === name)?.value ?? null;

    const report = {
        project: '@cubescope/web',
        generatedAt: new Date().toISOString(),
        runtime: {
            node: process.version,
            platform: process.platform,
            browser: browserVersion,
        },
        metrics: {
            headerParseTimeMs: initialState.headerParseTime,
            timeToInitialViewMs: getMetricValue('timeToInitialView'),
            bandSwitchTimeMs: getMetricValue('bandSwitchTime'),
        },
        fixture: {
            id: 'cubescope-mini-cube',
            interleave: initialState.header?.interleave ?? 'unknown',
            dimensions: initialState.header
                ? {
                    samples: initialState.header.samples,
                    lines: initialState.header.lines,
                    bands: initialState.header.bands,
                }
                : null,
        },
    };

    mkdirSync(benchmarkDir, { recursive: true });
    writeFileSync(benchmarkPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
} finally {
    server.kill('SIGTERM');
    await once(server, 'exit').catch(() => {});
}
