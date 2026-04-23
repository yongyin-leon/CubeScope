import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function extractMajor(version) {
    const match = String(version ?? '').match(/(\d+)/);
    return match ? Number(match[1]) : null;
}

function normalizeCandidate(label, nodePath) {
    if (!nodePath || !existsSync(nodePath)) {
        return null;
    }

    const versionResult = spawnSync(nodePath, ['-p', 'process.version'], {
        encoding: 'utf8',
        stdio: 'pipe',
    });

    if (versionResult.status !== 0) {
        return null;
    }

    const nodeVersion = versionResult.stdout.trim();
    if (extractMajor(nodeVersion) !== 22) {
        return null;
    }

    const binDir = dirname(nodePath);
    const npmPath = resolve(binDir, process.platform === 'win32' ? 'npm.cmd' : 'npm');
    if (!existsSync(npmPath)) {
        return null;
    }

    const npmVersionResult = spawnSync(npmPath, ['-v'], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: {
            ...process.env,
            PATH: `${binDir}:${process.env.PATH ?? ''}`,
        },
    });

    return {
        label,
        nodePath,
        npmPath,
        binDir,
        nodeVersion,
        npmVersion: npmVersionResult.status === 0 ? npmVersionResult.stdout.trim() : null,
    };
}

function collectVersionManagerCandidates(rootDir, labelPrefix, versionPrefix) {
    if (!existsSync(rootDir)) {
        return [];
    }

    return readdirSync(rootDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith(versionPrefix))
        .map((entry) => ({
            label: `${labelPrefix}:${entry.name}`,
            nodePath: resolve(rootDir, entry.name, 'bin', 'node'),
        }))
        .filter((entry) => existsSync(entry.nodePath))
        .sort((a, b) => b.label.localeCompare(a.label));
}

export function discoverNode22Runtimes() {
    const explicitCandidates = [
        { label: 'current', nodePath: process.execPath },
        { label: 'homebrew-opt', nodePath: '/opt/homebrew/opt/node@22/bin/node' },
        { label: 'homebrew-local', nodePath: '/usr/local/opt/node@22/bin/node' },
    ];

    const versionManagerCandidates = [
        ...collectVersionManagerCandidates(
            resolve(homedir(), '.nvm/versions/node'),
            'nvm',
            'v22'
        ),
        ...collectVersionManagerCandidates(
            resolve(homedir(), '.asdf/installs/nodejs'),
            'asdf',
            '22'
        ),
        ...collectVersionManagerCandidates(
            resolve(homedir(), '.local/share/mise/installs/node'),
            'mise',
            '22'
        ),
        ...collectVersionManagerCandidates(
            resolve(homedir(), '.local/share/fnm/node-versions'),
            'fnm',
            'v22'
        ),
    ];

    const seenPaths = new Set();
    const discovered = [];
    for (const candidate of [...explicitCandidates, ...versionManagerCandidates]) {
        if (seenPaths.has(candidate.nodePath)) {
            continue;
        }
        seenPaths.add(candidate.nodePath);
        const normalized = normalizeCandidate(candidate.label, candidate.nodePath);
        if (normalized) {
            discovered.push(normalized);
        }
    }

    return discovered;
}

export function findNode22Runtime() {
    const runtimes = discoverNode22Runtimes();
    return runtimes[0] ?? null;
}
