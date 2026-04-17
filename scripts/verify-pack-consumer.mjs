import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const npmCacheDir = resolve(projectRoot, 'output/npm-cache');
const reportDir = resolve(projectRoot, 'output/pack-consumer');
const reportPath = resolve(reportDir, 'latest.json');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeCommand = process.execPath;

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        env: {
            ...process.env,
            npm_config_cache: npmCacheDir,
        },
        ...options,
    });

    if (result.status !== 0) {
        throw new Error([
            `Command failed: ${command} ${args.join(' ')}`,
            result.stdout?.trim(),
            result.stderr?.trim(),
        ].filter(Boolean).join('\n\n'));
    }

    return result;
}

function ensureFile(path) {
    if (!existsSync(path)) {
        throw new Error(`Expected installed file is missing: ${path}`);
    }
}

mkdirSync(npmCacheDir, { recursive: true });
mkdirSync(reportDir, { recursive: true });

const packResult = run(npmCommand, ['pack', '--json']);
const packOutput = JSON.parse(packResult.stdout);
const tarballFileName = packOutput[0]?.filename;

if (!tarballFileName) {
    throw new Error('npm pack did not produce a tarball filename.');
}

const tarballPath = resolve(projectRoot, tarballFileName);
const tempRoot = mkdtempSync(join(tmpdir(), 'cubescope-pack-consumer-'));
const consumerDir = resolve(tempRoot, 'consumer-app');
mkdirSync(consumerDir, { recursive: true });

try {
    writeFileSync(resolve(consumerDir, 'package.json'), `${JSON.stringify({
        name: 'cubescope-pack-consumer',
        private: true,
        type: 'module',
    }, null, 2)}\n`);

    run(
        npmCommand,
        ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarballPath],
        { cwd: consumerDir }
    );

    const installedRoot = resolve(consumerDir, 'node_modules/@cubescope/web');
    ensureFile(resolve(installedRoot, 'dist/cubescope.es.js'));
    ensureFile(resolve(installedRoot, 'dist/worker.js'));
    ensureFile(resolve(installedRoot, 'dist/pkg/envi_parser.js'));
    ensureFile(resolve(installedRoot, 'dist/pkg/envi_parser_bg.wasm'));
    ensureFile(resolve(installedRoot, 'CITATION.cff'));

    const verifyScript = `
        import CubeViewer, { CubeViewer as NamedCubeViewer, EnviViewer } from '@cubescope/web';
        if (typeof CubeViewer !== 'function') throw new Error('Default export is not a constructor.');
        if (NamedCubeViewer !== CubeViewer) throw new Error('Named CubeViewer export mismatch.');
        if (EnviViewer !== CubeViewer) throw new Error('EnviViewer alias mismatch.');
        console.log(JSON.stringify({
          packageName: '@cubescope/web',
          exports: ['default', 'CubeViewer', 'EnviViewer']
        }));
    `;

    const verifyResult = spawnSync(nodeCommand, ['--input-type=module', '--eval', verifyScript], {
        cwd: consumerDir,
        encoding: 'utf8',
        stdio: 'pipe',
    });

    if (verifyResult.status !== 0) {
        throw new Error([
            'Installed consumer import verification failed.',
            verifyResult.stdout?.trim(),
            verifyResult.stderr?.trim(),
        ].filter(Boolean).join('\n\n'));
    }

    const report = {
        generatedAt: new Date().toISOString(),
        tarball: {
            fileName: basename(tarballPath),
            size: packOutput[0].size,
            unpackedSize: packOutput[0].unpackedSize,
        },
        consumer: {
            installRoot: installedRoot,
            verifiedExports: ['default', 'CubeViewer', 'EnviViewer'],
            verifiedAssets: [
                'dist/cubescope.es.js',
                'dist/worker.js',
                'dist/pkg/envi_parser.js',
                'dist/pkg/envi_parser_bg.wasm',
                'CITATION.cff',
            ],
        },
        npmPack: packOutput[0],
    };

    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
} finally {
    rmSync(tempRoot, { recursive: true, force: true });
    if (existsSync(tarballPath)) {
        unlinkSync(tarballPath);
    }
}
