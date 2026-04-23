import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { discoverNode22Runtimes, findNode22Runtime } from './lib/node22-runtime.mjs';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const packageJsonPath = resolve(projectRoot, 'package.json');
const nvmrcPath = resolve(projectRoot, '.nvmrc');
const nodeVersionPath = resolve(projectRoot, '.node-version');
const outputDir = resolve(projectRoot, 'output/toolchain');
const outputPath = resolve(outputDir, 'local-toolchain.json');

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function readTrimmedFile(path) {
    return existsSync(path) ? readFileSync(path, 'utf8').trim() : null;
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        ...options,
    });

    return {
        ok: result.status === 0,
        status: result.status,
        stdout: result.stdout?.trim() ?? '',
        stderr: result.stderr?.trim() ?? '',
    };
}

function extractLeadingInteger(value) {
    const match = String(value ?? '').match(/(\d+)/);
    return match ? Number(match[1]) : null;
}

const packageJson = readJson(packageJsonPath);
const npmVersion = run('npm', ['-v']);
const rustcVersion = run('rustc', ['-V']);
const wasmBindgenVersion = run('wasm-bindgen', ['--version']);
const rustTargets = run('rustup', ['target', 'list', '--installed']);
const targetNodeMajor = extractLeadingInteger(packageJson.engines?.node);
const currentNodeMajor = extractLeadingInteger(process.version);
const detectedNode22 = findNode22Runtime();
const discoveredNode22Runtimes = discoverNode22Runtimes();

const report = {
    generatedAt: new Date().toISOString(),
    target: {
        node: packageJson.engines?.node ?? null,
        npm: packageJson.engines?.npm ?? null,
        rustTarget: 'wasm32-unknown-unknown',
        wasmBindgenCli: '0.2.100',
        nvmrc: readTrimmedFile(nvmrcPath),
        nodeVersionFile: readTrimmedFile(nodeVersionPath),
    },
    current: {
        node: process.version,
        nodeMatchesTarget: targetNodeMajor != null && currentNodeMajor === targetNodeMajor,
        npm: npmVersion.ok ? npmVersion.stdout : null,
        rustc: rustcVersion.ok ? rustcVersion.stdout : null,
        wasmBindgen: wasmBindgenVersion.ok ? wasmBindgenVersion.stdout : null,
        installedRustTargets: rustTargets.ok
            ? rustTargets.stdout.split('\n').filter(Boolean)
            : [],
    },
    targetReadiness: {
        nodeVersionFilesAligned: Boolean(
            readTrimmedFile(nvmrcPath)
            && readTrimmedFile(nodeVersionPath)
            && readTrimmedFile(nvmrcPath) === readTrimmedFile(nodeVersionPath)
        ),
        wasmTargetInstalled: rustTargets.ok
            && rustTargets.stdout.split('\n').includes('wasm32-unknown-unknown'),
        wasmBindgenPinned: wasmBindgenVersion.ok
            && wasmBindgenVersion.stdout.includes('0.2.100'),
    },
    node22Discovery: {
        available: Boolean(detectedNode22),
        selected: detectedNode22,
        discovered: discoveredNode22Runtimes,
    },
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
