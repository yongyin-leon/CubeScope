import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = process.cwd();
const crateDir = resolve(projectRoot, 'rust/envi-parser');
const outDir = resolve(projectRoot, 'src/runtime/pkg');
const wasmArtifact = resolve(
    crateDir,
    'target/wasm32-unknown-unknown/release/envi_parser.wasm'
);

function hasCommand(command, args = ['--version']) {
    const result = spawnSync(command, args, { stdio: 'pipe' });
    return result.status === 0;
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        stdio: 'inherit',
        ...options,
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function ensureCommand(command, installHint) {
    if (hasCommand(command)) {
        return;
    }

    console.error(`[build:wasm] Missing required command: ${command}`);
    console.error(installHint);
    process.exit(1);
}

function readCommandOutput(command, args) {
    const result = spawnSync(command, args, { stdio: 'pipe', encoding: 'utf8' });
    if (result.status !== 0) {
        return null;
    }

    return result.stdout.trim();
}

function resolveCargoInvocation() {
    if (hasCommand('rustup', ['show'])) {
        const cargoPath = readCommandOutput('rustup', ['which', 'cargo']);
        const rustcPath = readCommandOutput('rustup', ['which', 'rustc']);

        if (cargoPath && rustcPath) {
            const toolchainBinDir = resolve(rustcPath, '..');
            return {
                command: cargoPath,
                argsPrefix: [],
                description: cargoPath,
                env: {
                    ...process.env,
                    PATH: `${toolchainBinDir}:${process.env.PATH ?? ''}`,
                    RUSTC: rustcPath,
                },
            };
        }

        return {
            command: 'rustup',
            argsPrefix: ['run', 'stable', 'cargo'],
            description: 'rustup run stable cargo',
            env: process.env,
        };
    }

    if (hasCommand('cargo')) {
        return {
            command: 'cargo',
            argsPrefix: [],
            description: 'cargo',
            env: process.env,
        };
    }

    console.error('[build:wasm] Missing required command: rustup or cargo');
    console.error(
        'Install Rust stable with rustup, then add the wasm32-unknown-unknown target before rebuilding the CubeScope runtime.'
    );
    process.exit(1);
}

ensureCommand(
    'wasm-bindgen',
    'Install wasm-bindgen-cli 0.2.100, for example: cargo install wasm-bindgen-cli --version 0.2.100'
);

const cargo = resolveCargoInvocation();
console.log(`[build:wasm] Using ${cargo.description}`);

mkdirSync(outDir, { recursive: true });
rmSync(resolve(outDir, 'envi_parser.js'), { force: true });
rmSync(resolve(outDir, 'envi_parser.d.ts'), { force: true });
rmSync(resolve(outDir, 'envi_parser_bg.wasm'), { force: true });
rmSync(resolve(outDir, 'envi_parser_bg.wasm.d.ts'), { force: true });

run(cargo.command, [
    ...cargo.argsPrefix,
    'build',
    '--manifest-path',
    resolve(crateDir, 'Cargo.toml'),
    '--release',
    '--target',
    'wasm32-unknown-unknown',
], { env: cargo.env });

if (!existsSync(wasmArtifact)) {
    console.error(`[build:wasm] Missing wasm artifact: ${wasmArtifact}`);
    process.exit(1);
}

run('wasm-bindgen', [
    wasmArtifact,
    '--target',
    'web',
    '--out-dir',
    outDir,
    '--out-name',
    'envi_parser',
]);
