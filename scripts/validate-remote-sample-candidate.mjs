import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { resolveProbeUrl } from '../src/samples/remote-sample-eligibility.js';

const scriptDir = dirname(fileURLToPath(new URL(import.meta.url)));
const projectRoot = resolve(scriptDir, '..');
const publicDir = resolve(projectRoot, 'public');
const outputDir = resolve(projectRoot, 'output/samples');
const serverCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function readArg(flag) {
    const direct = process.argv.find((entry) => entry.startsWith(`${flag}=`));
    if (direct) {
        return direct.slice(flag.length + 1);
    }

    const index = process.argv.indexOf(flag);
    if (index >= 0 && index + 1 < process.argv.length) {
        return process.argv[index + 1];
    }

    return undefined;
}

function requireArg(flag) {
    const value = readArg(flag);
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Missing required argument: ${flag}`);
    }

    return value.trim();
}

function isAbsoluteUrl(value) {
    try {
        return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch (error) {
        return false;
    }
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        stdio: 'inherit',
        env: {
            ...process.env,
            ...(options.env ?? {}),
        },
    });

    if (result.status !== 0) {
        throw new Error(`Command failed: ${command} ${args.join(' ')}`);
    }
}

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
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
        } catch (error) {
            // retry until timeout
        }

        await sleep(500);
    }

    throw new Error(`Timed out waiting for ${url}`);
}

function toCatalogUrl(catalogOutputPath) {
    const relativePath = relative(publicDir, catalogOutputPath);
    if (relativePath.startsWith('..')) {
        throw new Error('Candidate catalog output must stay under the public/ directory.');
    }

    return `/${relativePath.replaceAll('\\', '/')}`;
}

const sampleId = requireArg('--id');
const sampleTitle = requireArg('--title');
const rawHeaderUrl = requireArg('--header-url');
const rawDataUrl = requireArg('--data-url');
const headersJson = readArg('--headers-json');
const description = readArg('--description');
const license = readArg('--license');
const validationTier = readArg('--validation-tier') ?? 'public';
const keepPreview = readArg('--keep-preview') === '1' || process.argv.includes('--keep-preview');
const catalogOutput = resolve(
    projectRoot,
    readArg('--catalog-output') ?? 'public/samples/remote-samples.preview.json'
);
const qualificationOutput = resolve(
    projectRoot,
    readArg('--qualification-output') ?? `output/samples/${sampleId}-qualification.json`
);
const summaryOutput = resolve(
    projectRoot,
    readArg('--summary-output') ?? `output/samples/${sampleId}-candidate-validation.json`
);
const validationOutput = resolve(
    projectRoot,
    readArg('--validation-output') ?? `output/samples/${sampleId}-validation.json`
);

const needsLocalServer = !isAbsoluteUrl(rawHeaderUrl) || !isAbsoluteUrl(rawDataUrl);
const serverPort = Number(readArg('--port') ?? process.env.CUBESCOPE_WEBSERVER_PORT ?? (needsLocalServer ? pickServerPort() : 4173));
const sampleOrigin = readArg('--origin')?.trim() || `http://127.0.0.1:${serverPort}`;
const resolvedHeaderUrl = resolveProbeUrl(rawHeaderUrl, sampleOrigin);
const resolvedDataUrl = resolveProbeUrl(rawDataUrl, sampleOrigin);
const catalogUrl = toCatalogUrl(catalogOutput);

let server = null;

try {
    if (needsLocalServer) {
        server = spawn(serverCommand, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(serverPort), '--strictPort'], {
            cwd: projectRoot,
            stdio: 'inherit',
        });
        await waitForServer(`${sampleOrigin}/examples/`);
    }

    const createArgs = [
        'scripts/create-remote-sample-catalog.mjs',
        '--id', sampleId,
        '--title', sampleTitle,
        '--header-url', rawHeaderUrl,
        '--data-url', rawDataUrl,
        '--output', relative(projectRoot, catalogOutput),
        '--validation-tier', validationTier,
    ];
    if (description) {
        createArgs.push('--description', description);
    }
    if (license) {
        createArgs.push('--license', license);
    }
    if (headersJson) {
        createArgs.push('--headers-json', headersJson);
    }
    run('node', createArgs);

    const qualifyArgs = [
        'scripts/qualify-remote-sample.mjs',
        '--id', sampleId,
        '--title', sampleTitle,
        '--header-url', resolvedHeaderUrl,
        '--data-url', resolvedDataUrl,
        '--origin', sampleOrigin,
        '--output', relative(projectRoot, qualificationOutput),
    ];
    if (headersJson) {
        qualifyArgs.push('--headers-json', headersJson);
    }
    run('node', qualifyArgs);

    const qualification = readJson(qualificationOutput);
    if (qualification.evaluation?.browserEligible !== true) {
        throw new Error('Candidate qualification did not reach browserEligible=true.');
    }

    run(serverCommand, ['run', 'validate:samples'], {
        env: {
            CUBESCOPE_SAMPLE_CATALOG_URL: catalogUrl,
            CUBESCOPE_REGISTERED_SAMPLE_ID: sampleId,
            CUBESCOPE_SAMPLE_TIER: validationTier,
            CUBESCOPE_SAMPLE_REPORT_PATH: relative(projectRoot, validationOutput),
            CUBESCOPE_WEBSERVER_PORT: String(serverPort),
            CUBESCOPE_BASE_URL: sampleOrigin,
        },
    });

    const validation = readJson(validationOutput);
    const summary = {
        generatedAt: new Date().toISOString(),
        sample: {
            id: sampleId,
            title: sampleTitle,
            headerUrl: resolvedHeaderUrl,
            dataUrl: resolvedDataUrl,
            validationTier,
        },
        localPreview: {
            catalogOutput,
            catalogUrl,
            sampleOrigin,
            startedLocalServer: needsLocalServer,
            keptCatalogFile: keepPreview,
        },
        artifacts: {
            qualificationOutput,
            validationOutput,
        },
        qualification: qualification.evaluation,
        validation: {
            tier: validation.tier,
            totalSamples: validation.totalSamples,
            matchedSampleIds: (validation.samples ?? []).map((sample) => sample.id),
        },
        releaseReadiness: {
            candidatePromotionCheck: 'passed',
        },
    };

    mkdirSync(dirname(summaryOutput), { recursive: true });
    writeFileSync(summaryOutput, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
} finally {
    if (!keepPreview && existsSync(catalogOutput)) {
        rmSync(catalogOutput, { force: true });
    }
    if (server) {
        server.kill('SIGTERM');
        await once(server, 'exit').catch(() => {});
    }
}
