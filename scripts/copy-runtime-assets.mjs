import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = process.cwd();
const sourcePkgDir = resolve(projectRoot, 'src/runtime/pkg');
const distPkgDir = resolve(projectRoot, 'dist/pkg');

mkdirSync(distPkgDir, { recursive: true });
cpSync(sourcePkgDir, distPkgDir, {
  recursive: true,
  force: true,
  filter: (sourcePath) => !sourcePath.endsWith('package.json'),
});
