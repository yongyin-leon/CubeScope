import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const samples = 48;
const lines = 48;
const bands = 32;
const headerOffset = 0;
const fixtureDir = resolve(process.cwd(), 'test-data/fixtures');
const publicFixtureDir = resolve(process.cwd(), 'public/fixtures');
const baseName = 'cubescope-mini-cube';
const hdrPath = resolve(fixtureDir, `${baseName}.hdr`);
const imgPath = resolve(fixtureDir, `${baseName}.img`);
const manifestPath = resolve(fixtureDir, `${baseName}.json`);
const publicHdrPath = resolve(publicFixtureDir, `${baseName}.hdr`);
const publicImgPath = resolve(publicFixtureDir, `${baseName}.img`);
const publicManifestPath = resolve(publicFixtureDir, `${baseName}.json`);

mkdirSync(fixtureDir, { recursive: true });
mkdirSync(publicFixtureDir, { recursive: true });

const wavelengths = Array.from({ length: bands }, (_, index) => 400 + index * 10);
const totalPixels = samples * lines * bands;
const pixelBytes = Buffer.alloc(totalPixels * 2);

for (let band = 0; band < bands; band += 1) {
    for (let y = 0; y < lines; y += 1) {
        for (let x = 0; x < samples; x += 1) {
            const flatIndex = band * samples * lines + y * samples + x;
            const value = (band + 1) * 100 + ((x * 13 + y * 17 + band * 7) % 97);
            pixelBytes.writeUInt16LE(value, flatIndex * 2);
        }
    }
}

const hdrText = `ENVI
description = {CubeScope synthetic ENVI fixture for alpha smoke tests}
samples = ${samples}
lines = ${lines}
bands = ${bands}
header offset = ${headerOffset}
file type = ENVI Standard
data type = 12
interleave = bsq
byte order = 0
map info = {UTM, 1, 1, 500000, 4100000, 30, 30, 50, North, WGS-84, units=Meters}
coordinate system string = {PROJCS["WGS 84 / UTM zone 50N",
GEOGCS["WGS 84"],
UNIT["Meter",1.0]]}
wavelength = {${wavelengths.join(', ')}}
`;

const manifest = {
    id: baseName,
    description: 'Synthetic ENVI cube with affine-friendly spatial metadata for local smoke tests and benchmark automation.',
    dimensions: { samples, lines, bands },
    interleave: 'bsq',
    dataType: 'u16',
    byteOrder: 'lsb',
    spatialReference: {
        projectionName: 'UTM',
        pixelSize: { x: 30, y: 30 },
        referencePixel: { x: 1, y: 1 },
        referenceCoordinate: { x: 500000, y: 4100000 },
        coordinateSystemString: 'WGS 84 / UTM zone 50N',
    },
    generationCommand: 'node scripts/generate-test-fixtures.mjs',
    license: 'MIT',
};

writeFileSync(hdrPath, hdrText);
writeFileSync(imgPath, pixelBytes);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(publicHdrPath, hdrText);
writeFileSync(publicImgPath, pixelBytes);
writeFileSync(publicManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
