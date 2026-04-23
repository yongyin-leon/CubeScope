import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';

import { chromium } from '@playwright/test';

import {
    buildExampleUrl,
    loadFixtureIntoExample,
    loadHttpFixtureIntoExample,
    triggerBandSwitchDirect,
    waitForDemoReady,
    waitForInitialRender,
} from '../../tests/support/demo-automation.js';
import {
    projectRoot,
    registeredHttpSampleId,
    remoteSampleCatalogUrl,
} from '../../tests/support/paths.js';

const benchmarkDir = resolve(projectRoot, 'output/benchmark');
const benchmarkPath = resolve(benchmarkDir, 'latest.json');
const serverCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const benchmarkRenderer = process.env.CUBESCOPE_BENCHMARK_RENDERER ?? 'webgl';
const pageGotoOptions = {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
};

function isPortAvailable(port) {
    const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
    });

    return result.status !== 0;
}

function pickServerPort(start = 4173, end = 4190) {
    for (let port = start; port <= end; port += 1) {
        if (isPortAvailable(port)) {
            return port;
        }
    }

    throw new Error(`Could not find an available loopback port in the range ${start}-${end}.`);
}

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

async function collectInitialMetrics(loadFixture, baseUrl, { retries = 1 } = {}) {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        const browser = await chromium.launch({
            headless: true,
            args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader-webgpu'],
        });

        try {
            const page = await browser.newPage({ baseURL: baseUrl });
            await page.goto(buildExampleUrl({
                benchmark: true,
                renderer: benchmarkRenderer,
            }), pageGotoOptions);
            await waitForDemoReady(page);
            await loadFixture(page);
            const initialState = await waitForInitialRender(page);

            return {
                browserVersion: await browser.version(),
                state: initialState,
            };
        } catch (error) {
            lastError = error;

            if (attempt === retries) {
                try {
                    const page = browser.contexts()[0]?.pages?.()[0] ?? null;
                    const state = page
                        ? await page.evaluate(() => window.__cubescopeDemoState)
                        : null;
                    throw new Error([
                        `Benchmark initial-render phase failed: ${error.message}`,
                        `Current demo state: ${JSON.stringify(state)}`,
                    ].join('\n'));
                } catch (stateError) {
                    if (stateError instanceof Error && stateError.message.startsWith('Benchmark initial-render phase failed:')) {
                        throw stateError;
                    }
                }
            }
        } finally {
            await browser.close();
        }
    }

    throw lastError ?? new Error('Benchmark initial-render phase failed for an unknown reason.');
}

async function collectBandSwitchMetric(loadFixture, baseUrl, { optional = false } = {}) {
    const browser = await chromium.launch({
        headless: true,
        args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader-webgpu'],
    });

    try {
        const page = await browser.newPage({ baseURL: baseUrl });
        await page.goto(buildExampleUrl({
            benchmark: true,
            renderer: benchmarkRenderer,
        }), pageGotoOptions);
        await waitForDemoReady(page);
        await loadFixture(page);
        await page.waitForFunction(() => {
            const state = window.__cubescopeDemoState;
            return Boolean(
                state?.header
                && state?.loaded
                && (!state.errors || state.errors.every(
                    (message) => String(message).includes('Renderer recovery failed: Failed to acquire WebGPU adapter')
                ))
                && state.logs?.some((entry) => entry.includes('Setting initial focused view'))
            );
        }, undefined, { timeout: 60_000 });

        try {
            return await triggerBandSwitchDirect(page);
        } catch (error) {
            const state = await page.evaluate(() => window.__cubescopeDemoState);
            if (optional) {
                return {
                    __bandSwitchFailure: [
                        `Benchmark band-switch phase failed: ${error.message}`,
                        `Current demo state: ${JSON.stringify(state)}`,
                    ].join('\n'),
                    ...state,
                };
            }

            throw new Error([
                `Benchmark band-switch phase failed: ${error.message}`,
                `Current demo state: ${JSON.stringify(state)}`,
            ].join('\n'));
        }
    } finally {
        await browser.close();
    }
}

async function collectScenario(label, loadFixture, baseUrl, options = {}) {
    const { browserVersion, state: initialState } = await collectInitialMetrics(loadFixture, baseUrl);
    const switchedState = await collectBandSwitchMetric(loadFixture, baseUrl, {
        optional: options.optionalBandSwitch === true,
    });
    const metrics = [
        ...(initialState.metrics ?? []),
        ...(switchedState.metrics ?? []),
    ];
    const getMetricValue = (name) => metrics.find((metric) => metric.name === name)?.value ?? null;

    return {
        browserVersion,
        header: initialState.header
            ? {
                interleave: initialState.header.interleave,
                samples: initialState.header.samples,
                lines: initialState.header.lines,
                bands: initialState.header.bands,
            }
            : null,
        metadata: initialState.metadata ?? null,
        metrics: {
            headerParseTimeMs: initialState.headerParseTime,
            timeToInitialViewMs: getMetricValue('timeToInitialView'),
            bandSwitchTimeMs: getMetricValue('bandSwitchTime'),
        },
        warnings: switchedState.__bandSwitchFailure
            ? [switchedState.__bandSwitchFailure]
            : [],
        scenario: label,
    };
}

const serverPort = pickServerPort();
const serverBaseUrl = `http://127.0.0.1:${serverPort}`;
const serverArgs = ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(serverPort), '--strictPort'];
const server = spawn(serverCommand, serverArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
});

try {
    await waitForServer(`${serverBaseUrl}/examples/`);
    const localScenario = await collectScenario('envi-local', loadFixtureIntoExample, serverBaseUrl);
    const httpScenario = await collectScenario('envi-http', loadHttpFixtureIntoExample, serverBaseUrl, {
        optionalBandSwitch: true,
    });

    const report = {
        project: '@cubescope/web',
        generatedAt: new Date().toISOString(),
        runtime: {
            node: process.version,
            platform: process.platform,
            browser: localScenario.browserVersion,
            serverBaseUrl,
            renderer: benchmarkRenderer,
        },
        metrics: {
            local: localScenario.metrics,
            http: httpScenario.metrics,
        },
        warnings: {
            local: localScenario.warnings,
            http: httpScenario.warnings,
        },
        fixture: {
            id: 'cubescope-mini-cube',
            interleave: localScenario.header?.interleave ?? 'unknown',
            dimensions: localScenario.header
                ? {
                    samples: localScenario.header.samples,
                    lines: localScenario.header.lines,
                    bands: localScenario.header.bands,
                }
                : null,
            scenarios: {
                local: {
                    sourceKind: localScenario.metadata?.sourceKind ?? null,
                },
                http: {
                    sourceKind: httpScenario.metadata?.sourceKind ?? null,
                    sampleId: registeredHttpSampleId,
                    catalogUrl: remoteSampleCatalogUrl,
                },
            },
        },
    };

    mkdirSync(benchmarkDir, { recursive: true });
    writeFileSync(benchmarkPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
} finally {
    server.kill('SIGTERM');
    await once(server, 'exit').catch(() => {});
}
