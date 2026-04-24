import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templateDir = path.join(repoRoot, 'docs', 'softwarex-template');
const outDir = '/tmp/cubescope-softwarex-tex';

execFileSync(
  'latexmk',
  [
    '-pdf',
    '-interaction=nonstopmode',
    '-halt-on-error',
    `-outdir=${outDir}`,
    'cubescope-softwarex-submission-draft.tex',
  ],
  {
    cwd: templateDir,
    stdio: 'inherit',
  },
);

console.log(`Wrote ${path.join(outDir, 'cubescope-softwarex-submission-draft.pdf')}`);
