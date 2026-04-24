import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(repoRoot, 'output', 'softwarex-real-data-cases');
const figureDir = path.join(repoRoot, 'docs', 'figures');
const outputPath = path.join(figureDir, 'softwarex-real-envi-initial-views.png');

const cases = [
  {
    name: 'Indian Pines',
    file: 'indian-pines.png',
    detail: '145 x 145 x 220, RGB 30/20/10',
  },
  {
    name: 'Pavia University',
    file: 'pavia-university.png',
    detail: '340 x 610 x 103, RGB 30/20/10',
  },
  {
    name: 'Pavia Centre',
    file: 'pavia-centre.png',
    detail: '715 x 1096 x 102, RGB 30/20/10',
  },
  {
    name: 'Kennedy Space Center',
    file: 'kennedy-space-center.png',
    detail: '614 x 512 x 176, RGB 30/20/10',
  },
  {
    name: 'Pika IR-L Hyalite Creek',
    file: 'pika-hyalite-creek.png',
    detail: '555 x 1500 x 240, RGB 180/121/61',
  },
  {
    name: 'WHU-Hi LongKou',
    file: 'whu-hi-longkou.png',
    detail: '400 x 550 x 270, RGB 113/68/32',
  },
];

async function loadCaseImages() {
  return Promise.all(
    cases.map(async (item) => {
      const bytes = await readFile(path.join(sourceDir, item.file));
      return {
        ...item,
        src: `data:image/png;base64,${bytes.toString('base64')}`,
      };
    }),
  );
}

const html = (items) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        background: #ffffff;
      }

      canvas {
        display: block;
      }
    </style>
  </head>
  <body>
    <canvas id="figure" width="1800" height="1600"></canvas>
    <script>
      const cases = ${JSON.stringify(items)};
      const canvas = document.getElementById('figure');
      const ctx = canvas.getContext('2d');

      function loadImage(src) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      }

      function findNonWhiteBounds(img) {
        const scratch = document.createElement('canvas');
        scratch.width = img.naturalWidth;
        scratch.height = img.naturalHeight;
        const sctx = scratch.getContext('2d', { willReadFrequently: true });
        sctx.drawImage(img, 0, 0);
        const { data, width, height } = sctx.getImageData(0, 0, scratch.width, scratch.height);
        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (a > 0 && !(r > 235 && g > 235 && b > 235)) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }

        if (minX > maxX || minY > maxY) {
          return { x: 0, y: 0, width, height };
        }

        const pad = 8;
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(width - 1, maxX + pad);
        maxY = Math.min(height - 1, maxY + pad);
        return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
      }

      function drawFittedImage(img, bounds, x, y, width, height) {
        const scale = Math.min(width / bounds.width, height / bounds.height);
        const drawWidth = bounds.width * scale;
        const drawHeight = bounds.height * scale;
        const drawX = x + (width - drawWidth) / 2;
        const drawY = y + (height - drawHeight) / 2;
        ctx.drawImage(
          img,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
          drawX,
          drawY,
          drawWidth,
          drawHeight,
        );
      }

      function roundRect(x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      }

      async function render() {
        const images = await Promise.all(cases.map((item) => loadImage(item.src)));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#101418';
        ctx.font = '700 40px Arial, sans-serif';
        ctx.fillText('CubeScope real ENVI initial views', 56, 68);
        ctx.fillStyle = '#4f5b66';
        ctx.font = '24px Arial, sans-serif';
        ctx.fillText('Six local validation cases rendered through the same browser workflow', 56, 106);

        const outer = 56;
        const gap = 32;
        const top = 142;
        const cols = 2;
        const rows = 3;
        const cellW = (canvas.width - outer * 2 - gap) / cols;
        const cellH = (canvas.height - top - outer - gap * 2) / rows;

        cases.forEach((item, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const x = outer + col * (cellW + gap);
          const y = top + row * (cellH + gap);
          const img = images[index];
          const bounds = findNonWhiteBounds(img);

          ctx.fillStyle = '#f6f7f8';
          roundRect(x, y, cellW, cellH, 8);
          ctx.fill();
          ctx.strokeStyle = '#cbd1d8';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#111820';
          ctx.font = '700 25px Arial, sans-serif';
          ctx.fillText(item.name, x + 24, y + 38);
          ctx.fillStyle = '#59636f';
          ctx.font = '20px Arial, sans-serif';
          ctx.fillText(item.detail, x + 24, y + 66);

          drawFittedImage(img, bounds, x + 22, y + 86, cellW - 44, cellH - 108);
        });
      }

      window.__renderDone = render();
    </script>
  </body>
</html>`;

await mkdir(figureDir, { recursive: true });
const items = await loadCaseImages();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1600 }, deviceScaleFactor: 1 });
  await page.setContent(html(items), { waitUntil: 'load' });
  await page.evaluate(() => window.__renderDone);
  await page.locator('#figure').screenshot({ path: outputPath });
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
} finally {
  await browser.close();
}
