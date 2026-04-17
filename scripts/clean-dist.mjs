import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');

rmSync(distDir, { force: true, recursive: true });
