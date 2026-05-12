import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repoRoot, 'output', 'softwarex-submission');
const sourceDir = path.join(outDir, 'latex-source');
const sourceFigureDir = path.join(sourceDir, 'figures');
const templateDir = path.join(repoRoot, 'docs', 'softwarex-template');
const texSource = path.join(templateDir, 'cubescope-softwarex-submission-draft.tex');
const pdfSource = '/tmp/cubescope-softwarex-tex/cubescope-softwarex-submission-draft.pdf';

const files = {
  pdf: path.join(outDir, 'cubescope-softwarex-submission-draft.pdf'),
  sourceZip: path.join(outDir, 'cubescope-softwarex-latex-source.zip'),
  tex: path.join(sourceDir, 'cubescope-softwarex-submission-draft.tex'),
  manifest: path.join(outDir, 'MANIFEST.md'),
  highlights: path.join(outDir, 'SOFTWAREX_HIGHLIGHTS_v1.txt'),
  coverLetter: path.join(outDir, 'SOFTWAREX_COVER_LETTER_DRAFT_v2.md'),
};

function requireFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Required file is missing: ${filePath}`);
  }
}

requireFile(texSource);

execFileSync('node', ['scripts/build-softwarex-pdf.mjs'], {
  cwd: repoRoot,
  stdio: 'inherit',
});
requireFile(pdfSource);

await rm(outDir, { recursive: true, force: true });
await mkdir(sourceFigureDir, { recursive: true });

const tex = await readFile(texSource, 'utf8');
await writeFile(files.tex, tex.replaceAll('../figures/', 'figures/'));

for (const figureName of [
  'softwarex-architecture.png',
  'softwarex-real-envi-initial-views.png',
]) {
  await copyFile(
    path.join(repoRoot, 'docs', 'figures', figureName),
    path.join(sourceFigureDir, figureName),
  );
}

await copyFile(pdfSource, files.pdf);
await copyFile(path.join(repoRoot, 'docs', 'SOFTWAREX_HIGHLIGHTS_v1.txt'), files.highlights);
await copyFile(path.join(repoRoot, 'docs', 'SOFTWAREX_COVER_LETTER_DRAFT_v2.md'), files.coverLetter);

execFileSync('zip', ['-qr', files.sourceZip, '.'], {
  cwd: sourceDir,
  stdio: 'inherit',
});

await writeFile(
  files.manifest,
  [
    '# CubeScope SoftwareX Submission Assembly',
    '',
    'Generated files:',
    '',
    `- Manuscript PDF: ${path.relative(repoRoot, files.pdf)}`,
    `- LaTeX source archive: ${path.relative(repoRoot, files.sourceZip)}`,
    `- Highlights draft: ${path.relative(repoRoot, files.highlights)}`,
    `- Cover letter draft: ${path.relative(repoRoot, files.coverLetter)}`,
    '',
    'Editorial Manager LaTeX upload mapping:',
    '',
    '- Manuscript (Word or PDF file): upload the PDF.',
    '- Zip file containing LaTeX source files: upload the source archive.',
    '- Highlights: upload the highlights file if highlights are included.',
    '- Cover letter/comments: paste or upload the cover letter text if requested.',
    '',
    'Before final upload, replace any author-controlled contact placeholders in the manuscript and cover letter.',
    '',
  ].join('\n'),
);

console.log(`Wrote ${files.pdf}`);
console.log(`Wrote ${files.sourceZip}`);
console.log(`Wrote ${files.manifest}`);
