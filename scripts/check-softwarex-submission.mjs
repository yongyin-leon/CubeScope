import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const paths = {
  manuscript: 'docs/SOFTWAREX_MANUSCRIPT_v4.md',
  latexDraft: 'docs/softwarex-template/cubescope-softwarex-submission-draft.tex',
  latexTemplate: 'docs/softwarex-template/softwarex-osp-template.tex',
  wordTemplate: 'docs/softwarex-template/softwarex-osp-template.docx',
  architectureFigure: 'docs/figures/softwarex-architecture.png',
  realEnviFigure: 'docs/figures/softwarex-real-envi-initial-views.png',
  highlights: 'docs/SOFTWAREX_HIGHLIGHTS_v1.txt',
  coverLetter: 'docs/SOFTWAREX_COVER_LETTER_DRAFT_v2.md',
  citation: 'CITATION.cff',
  report: 'docs/SOFTWAREX_SUBMISSION_READINESS_REPORT_v1.md',
  releaseGateReport: 'docs/SOFTWAREX_RELEASE_GATE_REPORT_v1.md',
  releaseNotes: 'docs/SOFTWAREX_RELEASE_NOTES_0.1.0-alpha.1.md',
  alphaSummary: 'output/alpha/local-alpha-summary.json',
};

function repoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function fileSize(relativePath) {
  if (!existsSync(repoPath(relativePath))) return 0;
  return statSync(repoPath(relativePath)).size;
}

function statusLine(status, item, detail) {
  return `| ${status} | ${item} | ${detail.replaceAll('\n', '<br>')} |`;
}

async function read(relativePath) {
  return readFile(repoPath(relativePath), 'utf8');
}

function countWordsBeforeReferences(markdown) {
  const body = markdown.split(/^## References$/m)[0] ?? markdown;
  const words = body.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function listTrackedRealData() {
  const output = execFileSync('git', ['ls-files', '--', 'test-data/高光谱数据集'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return output.trim().split('\n').filter(Boolean);
}

function placeholderMatches(text) {
  const matches = text.match(/\[[^\]\n]*(To be completed|Affiliation|Email|Postal address|Phone number|DOI|NAME OF TOOL|REASON)[^\]\n]*\]/g);
  return matches ? [...new Set(matches)] : [];
}

const manuscript = await read(paths.manuscript);
const latexDraft = await read(paths.latexDraft);
const coverLetter = await read(paths.coverLetter);
const highlights = await read(paths.highlights);
const citation = await read(paths.citation);

const checks = [];
const manual = [];

const wordCount = countWordsBeforeReferences(manuscript);
checks.push({
  status: wordCount <= 3000 ? 'PASS' : 'FAIL',
  item: 'SoftwareX word-count guard',
  detail: `${wordCount} words before References; current web-guide limit used here is 3000.`,
});

for (const [item, relativePath] of [
  ['LaTeX submission draft', paths.latexDraft],
  ['Official LaTeX template', paths.latexTemplate],
  ['Official Word template', paths.wordTemplate],
  ['Architecture figure PNG', paths.architectureFigure],
  ['Real ENVI montage PNG', paths.realEnviFigure],
  ['Highlights file', paths.highlights],
  ['Cover letter draft', paths.coverLetter],
  ['Citation metadata', paths.citation],
  ['Release gate report', paths.releaseGateReport],
  ['Release notes draft', paths.releaseNotes],
]) {
  const size = fileSize(relativePath);
  checks.push({
    status: size > 0 ? 'PASS' : 'FAIL',
    item,
    detail: size > 0 ? `${relativePath} exists (${size} bytes).` : `${relativePath} is missing or empty.`,
  });
}

const trackedRealData = listTrackedRealData();
checks.push({
  status: trackedRealData.length === 0 ? 'PASS' : 'FAIL',
  item: 'Local real dataset Git guard',
  detail:
    trackedRealData.length === 0
      ? 'No files under test-data/高光谱数据集 are tracked by Git.'
      : `Tracked files found: ${trackedRealData.join(', ')}`,
});

const highlightLines = highlights.split('\n').map((line) => line.trim()).filter(Boolean);
const longHighlights = highlightLines.filter((line) => line.length > 85);
checks.push({
  status: highlightLines.length >= 3 && highlightLines.length <= 5 && longHighlights.length === 0 ? 'PASS' : 'FAIL',
  item: 'Highlights count and length',
  detail: `${highlightLines.length} highlights; longest is ${Math.max(...highlightLines.map((line) => line.length))} characters.`,
});

checks.push({
  status: citation.includes('Yongyin Leon') && citation.includes('0.1.0-alpha.1') ? 'PASS' : 'WARN',
  item: 'CITATION metadata baseline',
  detail: 'CITATION.cff includes author and version metadata; verify release date at final tag.',
});

if (existsSync(repoPath(paths.alphaSummary))) {
  const alphaSummary = JSON.parse(await read(paths.alphaSummary));
  const gateStatus = alphaSummary.releaseGateStatus ?? {};
  const failingGates = Object.entries(gateStatus)
    .filter(([key, value]) => key !== 'repositoryVisibility' && key !== 'node22ExternalCi' && value !== 'passed')
    .map(([key, value]) => `${key}=${value}`);
  checks.push({
    status: failingGates.length === 0 ? 'PASS' : 'FAIL',
    item: 'Latest local alpha gate output',
    detail:
      failingGates.length === 0
        ? `Local alpha gate output exists and required local gates passed; repositoryVisibility=${gateStatus.repositoryVisibility ?? 'unknown'}, node22ExternalCi=${gateStatus.node22ExternalCi ?? 'unknown'}.`
        : `Non-passing local gates: ${failingGates.join(', ')}`,
  });
} else {
  checks.push({
    status: 'WARN',
    item: 'Latest local alpha gate output',
    detail: `${paths.alphaSummary} is missing; run npm run verify:alpha before final release freeze.`,
  });
}

for (const [item, text] of [
  ['Manuscript author-controlled placeholders', manuscript],
  ['LaTeX draft author-controlled placeholders', latexDraft],
  ['Cover letter signature/contact placeholders', coverLetter],
]) {
  const placeholders = placeholderMatches(text);
  manual.push({
    status: placeholders.length === 0 ? 'PASS' : 'MANUAL',
    item,
    detail: placeholders.length === 0 ? 'No targeted placeholders found.' : placeholders.join(', '),
  });
}

manual.push({
  status: 'MANUAL',
  item: 'Dataset permission/provenance finalization',
  detail: 'Confirm screenshot reuse terms for Pika IR-L Hyalite Creek, WHU-Hi LongKou, EHU/GIC scenes, and any retained public remote sample.',
});

manual.push({
  status: 'MANUAL',
  item: 'Release/archive finalization',
  detail: 'Confirm repository is public, create/freeze the public release tag, and add DOI/archive URL if available.',
});

const now = new Date().toISOString();
const lines = [
  '# SoftwareX Submission Readiness Report v1',
  '',
  `Generated: \`${now}\``,
  '',
  'This report separates automated checks from author-controlled fields that can be hand-filled before final submission.',
  '',
  '## Automated Checks',
  '',
  '| Status | Item | Detail |',
  '| --- | --- | --- |',
  ...checks.map((entry) => statusLine(entry.status, entry.item, entry.detail)),
  '',
  '## Manual Fields Left Open',
  '',
  '| Status | Item | Detail |',
  '| --- | --- | --- |',
  ...manual.map((entry) => statusLine(entry.status, entry.item, entry.detail)),
  '',
  '## Current Recommendation',
  '',
  checks.some((entry) => entry.status === 'FAIL')
    ? 'Resolve the automated `FAIL` items before template finalization.'
    : 'Automated checks are clear. The remaining work is author metadata, declarations, release/archive decisions, and final dataset-permission wording.',
  '',
];

await writeFile(repoPath(paths.report), `${lines.join('\n')}\n`);

for (const line of lines) {
  console.log(line);
}

if (checks.some((entry) => entry.status === 'FAIL')) {
  process.exitCode = 1;
}
