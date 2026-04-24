import { cpSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const demoRuntimeDir = resolve(projectRoot, 'demo-dist/runtime');

mkdirSync(demoRuntimeDir, { recursive: true });
copyFileSync(
    resolve(projectRoot, 'dist/worker.js'),
    resolve(demoRuntimeDir, 'worker.js')
);
cpSync(
    resolve(projectRoot, 'dist/pkg'),
    resolve(demoRuntimeDir, 'pkg'),
    { recursive: true }
);

console.log(`Copied CubeScope runtime assets to ${demoRuntimeDir}`);
