import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

export const projectRoot = resolve(currentDir, '../..');
export const fixtureBaseName = 'cubescope-mini-cube';
export const fixtureHdrPath = resolve(projectRoot, 'test-data/fixtures', `${fixtureBaseName}.hdr`);
export const fixtureImgPath = resolve(projectRoot, 'test-data/fixtures', `${fixtureBaseName}.img`);
