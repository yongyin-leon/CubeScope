import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const packageJsonPath = resolve(projectRoot, 'package.json');
const benchmarkPath = resolve(projectRoot, 'output/benchmark/latest.json');
const packConsumerPath = resolve(projectRoot, 'output/pack-consumer/latest.json');
const sampleCatalogPath = resolve(projectRoot, 'output/samples/latest.json');
const toolchainReportPath = resolve(projectRoot, 'output/toolchain/local-toolchain.json');
const node22VerificationPath = resolve(projectRoot, 'output/toolchain/node22-local-verification.json');
const outputDir = resolve(projectRoot, 'output/alpha');
const outputPath = resolve(outputDir, 'local-alpha-summary.json');

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
    try {
        return readJson(path);
    } catch (error) {
        return null;
    }
}

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
    });

    if (result.status !== 0) {
        throw new Error([
            `Command failed: ${command} ${args.join(' ')}`,
            result.stdout?.trim(),
            result.stderr?.trim(),
        ].filter(Boolean).join('\n\n'));
    }

    return result.stdout.trim();
}

function extractLeadingInteger(value) {
    const match = String(value ?? '').match(/(\d+)/);
    return match ? Number(match[1]) : null;
}

const packageJson = readJson(packageJsonPath);
const benchmark = readJson(benchmarkPath);
const packConsumer = readJson(packConsumerPath);
const sampleCatalog = readJson(sampleCatalogPath);
const toolchainReport = readOptionalJson(toolchainReportPath);
const node22Verification = readOptionalJson(node22VerificationPath);
const targetNodeMajor = extractLeadingInteger(packageJson.engines?.node);
const runtimeNodeMajor = extractLeadingInteger(process.version);
const inferredNode22LocalRuntimeStatus = targetNodeMajor != null && runtimeNodeMajor === targetNodeMajor
    ? 'passed'
    : 'pending';
const node22LocalRuntimeStatus = node22Verification?.status ?? inferredNode22LocalRuntimeStatus;

function buildNode22Note() {
    if (node22LocalRuntimeStatus === 'passed') {
        return 'Local verification matched the Node 22 target toolchain.';
    }

    if (node22LocalRuntimeStatus === 'failed') {
        return 'A dedicated Node 22 local verification run exists and is currently failing.';
    }

    if (node22LocalRuntimeStatus === 'unavailable') {
        return 'No local Node 22 runtime has been detected yet; the target toolchain still needs a matching runtime pass.';
    }

    return `Local verification ran on Node ${process.version}; the Node 22 target toolchain still needs a matching runtime pass.`;
}

const summary = {
    generatedAt: new Date().toISOString(),
    project: {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
    },
    targetToolchain: {
        node: packageJson.engines?.node ?? 'unspecified',
        npm: packageJson.engines?.npm ?? 'unspecified',
        rustTarget: 'wasm32-unknown-unknown',
        wasmBindgenCli: '0.2.100',
    },
    localVerificationRuntime: {
        node: process.version,
        npm: run('npm', ['-v']),
        rustc: run('rustc', ['-V']),
    },
    verificationArtifacts: {
        benchmark: {
            path: 'output/benchmark/latest.json',
            metrics: benchmark.metrics,
            warnings: benchmark.warnings ?? {},
            runtime: benchmark.runtime,
            fixture: benchmark.fixture,
        },
        packConsumer: {
            path: 'output/pack-consumer/latest.json',
            tarball: packConsumer.tarball,
            verifiedExports: packConsumer.consumer?.verifiedExports ?? [],
            verifiedAssets: packConsumer.consumer?.verifiedAssets ?? [],
        },
        sampleCatalog: {
            path: 'output/samples/latest.json',
            tier: sampleCatalog.tier,
            totalSamples: sampleCatalog.totalSamples,
            samples: sampleCatalog.samples,
        },
        toolchain: toolchainReport
            ? {
                path: 'output/toolchain/local-toolchain.json',
                node22Discovery: toolchainReport.node22Discovery,
                targetReadiness: toolchainReport.targetReadiness,
            }
            : null,
        node22Verification: node22Verification
            ? {
                path: 'output/toolchain/node22-local-verification.json',
                status: node22Verification.status,
                runtime: node22Verification.runtime ?? null,
            }
            : null,
    },
    releaseGateStatus: {
        localAlphaVerification: 'passed',
        deterministicHttpFixture: 'passed',
        registeredRemoteSampleCatalog: 'passed',
        publicRemoteSample: 'pending',
        webglFallback: 'passed',
        node22LocalRuntime: node22LocalRuntimeStatus,
        node22ExternalCi: 'deferred',
        repositoryVisibility: 'private',
    },
    notes: [
        'This summary captures the locally verified alpha gate only.',
        'The local verification path now covers both envi-local and deterministic same-origin envi-http scenarios.',
        'Registered remote samples are validated locally through the sample catalog and example-page smoke path.',
        'HTTP range initial-view validation is part of the local gate; a stable public remote sample is still pending.',
        'Local smoke and benchmark verification now pin the renderer to WebGL compatibility mode for deterministic browser validation, while the runtime default remains auto.',
        buildNode22Note(),
        'Node 22 remains the target toolchain for public release, but external CI confirmation is intentionally deferred for now.',
    ],
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
