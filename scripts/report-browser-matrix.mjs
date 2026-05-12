import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';

import { chromium, firefox, webkit } from '@playwright/test';

import {
    buildExampleUrl,
    loadFixtureIntoExample,
    probeFixtureAt,
    triggerBandSwitchDirect,
    waitForDemoReady,
    waitForInitialRender,
} from '../tests/support/demo-automation.js';
import { projectRoot } from '../tests/support/paths.js';
import { getActionableErrors } from '../examples/demo/renderer-status.js';

const outputDir = resolve(projectRoot, 'output/browser-matrix');
const outputPath = resolve(outputDir, 'latest.json');
const serverCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const pageGotoOptions = {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
};
const browserEngines = Object.freeze({
    chromium,
    firefox,
    webkit,
});

function parseBrowserSelection(value = process.env.CUBESCOPE_BROWSER_MATRIX_BROWSERS) {
    if (!value || value.trim().length === 0) {
        return ['chromium', 'firefox', 'webkit'];
    }

    return value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => Object.hasOwn(browserEngines, entry));
}

function isBrowserAvailabilityError(error) {
    const message = String(error?.message ?? error ?? '');
    return /Executable doesn't exist|browserType\.launch|Host system is missing dependencies|Failed to launch/i.test(message);
}

function buildLaunchOptions(browserName) {
    if (browserName === 'chromium') {
        return {
            headless: true,
            args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader-webgpu'],
        };
    }

    return { headless: true };
}

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
        } catch {}
        await sleep(500);
    }

    throw new Error(`Timed out waiting for ${url}`);
}

function summarizeMetrics(metrics = []) {
    return {
        names: metrics.map((metric) => metric.name),
        timeToInitialViewMs: metrics.find((metric) => metric.name === 'timeToInitialView')?.value ?? null,
        bandSwitchTimeMs: metrics.find((metric) => metric.name === 'bandSwitchTime')?.value ?? null,
    };
}

async function collectScenario({ id, browserName, rendererPreference, baseUrl, required = false }) {
    const browserType = browserEngines[browserName];
    let browser;
    let page = null;

    try {
        browser = await browserType.launch(buildLaunchOptions(browserName));
        page = await browser.newPage({ baseURL: baseUrl });
        await page.goto(buildExampleUrl({
            benchmark: true,
            renderer: rendererPreference,
        }), pageGotoOptions);
        await waitForDemoReady(page);
        await loadFixtureIntoExample(page);

        const initialState = await waitForInitialRender(page, {
            requirePerformanceMetric: false,
        });
        const probe = await probeFixtureAt(page);

        let postBandSwitchState = initialState;
        let bandSwitchWarning = null;
        try {
            postBandSwitchState = await triggerBandSwitchDirect(page);
        } catch (error) {
            bandSwitchWarning = `Band switch metric was not captured: ${error.message}`;
            postBandSwitchState = await page.evaluate(() => window.__cubescopeDemoState);
        }

        const actionableErrors = getActionableErrors(postBandSwitchState?.errors ?? []);
        const warnings = [];
        if (bandSwitchWarning) {
            warnings.push(bandSwitchWarning);
        }
        if (!(postBandSwitchState?.metrics ?? []).some((metric) => metric.name === 'timeToInitialView')) {
            warnings.push('Initial-view performance metric was not captured.');
        }

        const status = !postBandSwitchState?.header
            || !postBandSwitchState?.loaded
            || !probe?.world
            || actionableErrors.length > 0
            ? 'failed'
            : warnings.length > 0
                ? 'warning'
                : 'passed';

        return {
            id,
            browser: browserName,
            browserVersion: await browser.version(),
            rendererPreference,
            rendererStatus: postBandSwitchState?.rendererStatus ?? null,
            status,
            required,
            warnings,
            actionableErrors,
            header: postBandSwitchState?.header
                ? {
                    samples: postBandSwitchState.header.samples,
                    lines: postBandSwitchState.header.lines,
                    bands: postBandSwitchState.header.bands,
                    interleave: postBandSwitchState.header.interleave,
                }
                : null,
            metrics: summarizeMetrics(postBandSwitchState?.metrics ?? []),
            probe: {
                pixel: probe?.pixel ?? null,
                world: probe?.world ?? null,
            },
            logsTail: (postBandSwitchState?.logs ?? []).slice(-20),
        };
    } catch (error) {
        if (!required && isBrowserAvailabilityError(error)) {
            return {
                id,
                browser: browserName,
                browserVersion: null,
                rendererPreference,
                status: 'skipped',
                required: false,
                warnings: [`${browserName} was not available in this local Playwright environment: ${error.message}`],
                actionableErrors: [],
                rendererStatus: null,
                header: null,
                metrics: summarizeMetrics([]),
                probe: { pixel: null, world: null },
                logsTail: [],
            };
        }

        const currentState = page
            ? await page.evaluate(() => window.__cubescopeDemoState ?? null).catch(() => null)
            : null;
        return {
            id,
            browser: browserName,
            browserVersion: browser ? await browser.version().catch(() => null) : null,
            rendererPreference,
            status: 'failed',
            required,
            warnings: [],
            actionableErrors: [error.message],
            rendererStatus: currentState?.rendererStatus ?? null,
            header: currentState?.header
                ? {
                    samples: currentState.header.samples,
                    lines: currentState.header.lines,
                    bands: currentState.header.bands,
                    interleave: currentState.header.interleave,
                }
                : null,
            metrics: summarizeMetrics(currentState?.metrics ?? []),
            probe: {
                pixel: currentState?.lastProbe?.pixel ?? null,
                world: currentState?.lastProbe?.world ?? null,
            },
            logsTail: (currentState?.logs ?? []).slice(-20),
        };
    } finally {
        await browser?.close();
    }
}

function buildScenarios(browserNames) {
    const scenarios = [];

    for (const browserName of browserNames) {
        if (browserName === 'chromium') {
            scenarios.push(
                {
                    id: 'chromium-local-webgl',
                    browserName,
                    rendererPreference: 'webgl',
                    required: true,
                },
                {
                    id: 'chromium-local-auto',
                    browserName,
                    rendererPreference: 'auto',
                    required: true,
                }
            );
            continue;
        }

        scenarios.push({
            id: `${browserName}-local-webgl`,
            browserName,
            rendererPreference: 'webgl',
            required: false,
        });
    }

    return scenarios;
}

const requestedBrowsers = parseBrowserSelection();
const scenarios = buildScenarios(requestedBrowsers);

const serverPort = pickServerPort();
const serverBaseUrl = `http://127.0.0.1:${serverPort}`;
const serverArgs = ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(serverPort), '--strictPort'];
const server = spawn(serverCommand, serverArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
});

try {
    await waitForServer(`${serverBaseUrl}/examples/`);
    const results = [];

    for (const scenario of scenarios) {
        results.push(await collectScenario({
            ...scenario,
            baseUrl: serverBaseUrl,
        }));
    }

    const failedCount = results.filter((result) => result.status === 'failed').length;
    const requiredFailedCount = results.filter((result) => result.required !== false && result.status === 'failed').length;
    const warningCount = results.filter((result) => result.status === 'warning').length;
    const skippedCount = results.filter((result) => result.status === 'skipped').length;
    const verifiedBrowserNames = Array.from(new Set(
        results
            .filter((result) => ['passed', 'warning'].includes(result.status))
            .map((result) => result.browser)
    ));
    const report = {
        project: '@cubescope/web',
        generatedAt: new Date().toISOString(),
        runtime: {
            node: process.version,
            platform: process.platform,
            serverBaseUrl,
            fixture: 'cubescope-mini-cube',
            requestedBrowsers,
        },
        summary: {
            totalScenarios: results.length,
            passed: results.filter((result) => result.status === 'passed').length,
            warnings: warningCount,
            skipped: skippedCount,
            failed: failedCount,
            requiredFailed: requiredFailedCount,
            verifiedBrowsers: verifiedBrowserNames,
            overallStatus: requiredFailedCount > 0
                ? 'failed'
                : warningCount > 0
                    ? 'warning'
                    : 'passed',
        },
        scenarios: results,
    };

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));

    if (requiredFailedCount > 0) {
        process.exitCode = 1;
    }
} finally {
    server.kill('SIGTERM');
    await once(server, 'exit').catch(() => {});
}
