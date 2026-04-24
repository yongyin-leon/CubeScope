import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const figureDir = path.join(repoRoot, 'docs', 'figures');
const svgPath = path.join(figureDir, 'softwarex-architecture.svg');
const outputPath = path.join(figureDir, 'softwarex-architecture.png');

const svg = await readFile(svgPath, 'utf8');
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

await mkdir(figureDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 960 }, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { margin: 0; background: #fff; }
          img { display: block; width: 1800px; height: 960px; }
        </style>
      </head>
      <body>
        <img id="figure" src="${dataUrl}" alt="CubeScope architecture" />
      </body>
    </html>`,
    { waitUntil: 'load' },
  );
  await page.locator('#figure').screenshot({ path: outputPath });
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
} finally {
  await browser.close();
}
