import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    isBrowserRequestAllowed,
    resolveProbeUrl,
} from '../src/samples/remote-sample-eligibility.js';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const outputDir = resolve(projectRoot, 'output/samples');

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

function requireArg(flag, value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Missing required argument: ${flag}`);
    }

    return value.trim();
}

function normalizeHeaders(rawValue) {
    if (!rawValue) {
        return {};
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('--headers-json must be a JSON object.');
    }

    return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [String(key), String(value)])
    );
}

function collectHeaders(headers) {
    const result = {};
    for (const [key, value] of headers.entries()) {
        result[key.toLowerCase()] = value;
    }
    return result;
}

async function inspectRequest(url, headers) {
    const response = await fetch(url, {
        headers,
    });

    return {
        status: response.status,
        statusText: response.statusText,
        headers: collectHeaders(response.headers),
    };
}

const sampleId = requireArg('--id', readArg('--id'));
const title = requireArg('--title', readArg('--title') ?? sampleId);
const headerUrl = requireArg('--header-url', readArg('--header-url'));
const dataUrl = requireArg('--data-url', readArg('--data-url'));
const origin = readArg('--origin')?.trim() || 'http://127.0.0.1:4173';
const outputPath = resolve(
    projectRoot,
    readArg('--output')
        ? readArg('--output')
        : `output/samples/${sampleId}-qualification.json`
);
const extraHeaders = normalizeHeaders(readArg('--headers-json'));
const resolvedHeaderUrl = resolveProbeUrl(headerUrl, origin);
const resolvedDataUrl = resolveProbeUrl(dataUrl, origin);

const headerProbe = await inspectRequest(resolvedHeaderUrl, {
    ...extraHeaders,
    Origin: origin,
});

const dataProbe = await inspectRequest(resolvedDataUrl, {
    ...extraHeaders,
    Origin: origin,
    Range: 'bytes=0-15',
});

const headerCors = headerProbe.headers['access-control-allow-origin'] ?? null;
const dataCors = dataProbe.headers['access-control-allow-origin'] ?? null;
const acceptRanges = dataProbe.headers['accept-ranges'] ?? null;
const contentRange = dataProbe.headers['content-range'] ?? null;
const rangeOkay = dataProbe.status === 206 && typeof contentRange === 'string';
const corsOkay = isBrowserRequestAllowed({
    targetUrl: resolvedHeaderUrl,
    origin,
    accessControlAllowOrigin: headerCors,
}) && isBrowserRequestAllowed({
    targetUrl: resolvedDataUrl,
    origin,
    accessControlAllowOrigin: dataCors,
});
const browserEligible = headerProbe.status >= 200
    && headerProbe.status < 300
    && rangeOkay
    && corsOkay;

const report = {
    checkedAt: new Date().toISOString(),
    sample: {
        id: sampleId,
        title,
        headerUrl: resolvedHeaderUrl,
        dataUrl: resolvedDataUrl,
    },
    probeOrigin: origin,
    requests: {
        header: {
            ...headerProbe,
            corsAllowedOrigin: headerCors,
        },
        dataRange: {
            ...dataProbe,
            corsAllowedOrigin: dataCors,
            acceptRanges,
            contentRange,
        },
    },
    evaluation: {
        headerReachable: headerProbe.status >= 200 && headerProbe.status < 300,
        rangeOkay,
        corsOkay,
        browserEligible,
    },
    nextAction: browserEligible
        ? 'Candidate can be promoted into public/samples/remote-samples.json with validationTier=public.'
        : 'Candidate is not yet browser-eligible for CubeScope envi-http public validation.',
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
