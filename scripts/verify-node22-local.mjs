import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { findNode22Runtime } from './lib/node22-runtime.mjs';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const outputDir = resolve(projectRoot, 'output/toolchain');
const outputPath = resolve(outputDir, 'node22-local-verification.json');

function writeReport(report) {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
}

const runtime = findNode22Runtime();

if (!runtime) {
    writeReport({
        generatedAt: new Date().toISOString(),
        status: 'unavailable',
        message: 'No local Node 22 runtime was detected. Install or activate Node 22, then rerun npm run verify:node22-local.',
    });
    process.exit(1);
}

const result = spawnSync(runtime.npmPath, ['run', 'verify:alpha'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
        ...process.env,
        PATH: `${runtime.binDir}:${process.env.PATH ?? ''}`,
    },
});

const report = {
    generatedAt: new Date().toISOString(),
    status: result.status === 0 ? 'passed' : 'failed',
    runtime,
    command: `${runtime.npmPath} run verify:alpha`,
    exitCode: result.status,
};

writeReport(report);

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}
