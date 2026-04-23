import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeRemoteSampleCatalog } from '../src/samples/remote-sample-catalog.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');

function readArg(flag) {
    const index = process.argv.indexOf(flag);
    if (index === -1) {
        return null;
    }

    return process.argv[index + 1] ?? null;
}

function requireArg(flag) {
    const value = readArg(flag);
    if (!value || value.trim().length === 0) {
        throw new Error(`Missing required argument: ${flag}`);
    }

    return value.trim();
}

function normalizeHeaders(rawValue) {
    if (!rawValue) {
        return undefined;
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('--headers-json must be a JSON object.');
    }

    return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [String(key), String(value)])
    );
}

const sampleId = requireArg('--id');
const sampleTitle = requireArg('--title');
const headerUrl = requireArg('--header-url');
const dataUrl = requireArg('--data-url');
const outputPath = resolve(
    projectRoot,
    readArg('--output') ?? 'output/samples/remote-samples.candidate.json'
);
const headers = normalizeHeaders(readArg('--headers-json'));

const catalog = normalizeRemoteSampleCatalog({
    version: Number(readArg('--version') ?? '1'),
    catalogId: readArg('--catalog-id') ?? 'cubescope-candidate-remote-samples',
    description: readArg('--catalog-description')
        ?? 'Candidate remote ENVI sample catalog generated for CubeScope validation.',
    samples: [
        {
            id: sampleId,
            title: sampleTitle,
            kind: readArg('--kind') ?? 'envi-http',
            availability: readArg('--availability') ?? 'public',
            validationTier: readArg('--validation-tier') ?? 'public',
            description: readArg('--description') ?? undefined,
            headerUrl,
            dataUrl,
            headers,
            license: readArg('--license') ?? undefined,
        },
    ],
});

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);

console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    outputPath,
    catalogId: catalog.catalogId ?? null,
    sampleIds: catalog.samples.map((sample) => sample.id),
}, null, 2));
