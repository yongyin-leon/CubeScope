import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEnviFormatAdapter } from '../../src/formats/envi-format-adapter.js';
import {
    createBlobDataSource,
    createHttpRangeDataSource,
} from '../../src/sources/data-source.js';

const samples = 3;
const lines = 2;
const bands = 4;
const bytesPerPixel = 2;

function valueFor({ bandIndex, x, y }) {
    return (bandIndex + 1) * 100 + y * 10 + x;
}

function writeU16(buffer, index, value) {
    const view = new DataView(buffer.buffer);
    view.setUint16(index * bytesPerPixel, value, true);
}

function createCubeBytes(interleave) {
    const bytes = new Uint8Array(samples * lines * bands * bytesPerPixel);
    let index = 0;

    if (interleave === 'bsq') {
        for (let bandIndex = 0; bandIndex < bands; bandIndex += 1) {
            for (let y = 0; y < lines; y += 1) {
                for (let x = 0; x < samples; x += 1) {
                    writeU16(bytes, index, valueFor({ bandIndex, x, y }));
                    index += 1;
                }
            }
        }
        return bytes;
    }

    if (interleave === 'bil') {
        for (let y = 0; y < lines; y += 1) {
            for (let bandIndex = 0; bandIndex < bands; bandIndex += 1) {
                for (let x = 0; x < samples; x += 1) {
                    writeU16(bytes, index, valueFor({ bandIndex, x, y }));
                    index += 1;
                }
            }
        }
        return bytes;
    }

    for (let y = 0; y < lines; y += 1) {
        for (let x = 0; x < samples; x += 1) {
            for (let bandIndex = 0; bandIndex < bands; bandIndex += 1) {
                writeU16(bytes, index, valueFor({ bandIndex, x, y }));
                index += 1;
            }
        }
    }

    return bytes;
}

function readU16(bytes, byteOffset) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        .getUint16(byteOffset, true);
}

function createFakeWasmModule(header) {
    class EnviReader {
        getHeaderAsJsObject() {
            return header;
        }

        extractBsqTileRaw(chunkData) {
            const values = [];
            for (let byteOffset = 0; byteOffset < chunkData.byteLength; byteOffset += bytesPerPixel) {
                values.push(readU16(chunkData, byteOffset));
            }
            return new Float32Array(values);
        }

        extractBilTileRaw(chunkData, _chunkStartOffset, bandIndex) {
            const values = [];
            for (let y = 0; y < header.lines; y += 1) {
                for (let x = 0; x < header.samples; x += 1) {
                    const valueIndex = y * header.bands * header.samples
                        + bandIndex * header.samples
                        + x;
                    values.push(readU16(chunkData, valueIndex * bytesPerPixel));
                }
            }
            return new Float32Array(values);
        }

        extractBipTileRaw(chunkData, _chunkStartOffset, bandIndex) {
            const values = [];
            for (let y = 0; y < header.lines; y += 1) {
                for (let x = 0; x < header.samples; x += 1) {
                    const valueIndex = (y * header.samples + x) * header.bands + bandIndex;
                    values.push(readU16(chunkData, valueIndex * bytesPerPixel));
                }
            }
            return new Float32Array(values);
        }

        extractBipTileForBandsRaw(chunkData, chunkStartOffset, requestedBands) {
            return requestedBands.map((band) => ({
                band,
                data: this.extractBipTileRaw(chunkData, chunkStartOffset, band - 1),
                free() {},
            }));
        }
    }

    return {
        EnviReader,
        async normalizeBandInPlaceWithStats(data, min, max) {
            const range = Math.max(max - min, 1e-9);
            for (let index = 0; index < data.length; index += 1) {
                data[index] = Math.max(0, Math.min(1, (data[index] - min) / range));
            }
        },
        calculateStatistics(data) {
            const values = Array.from(data);
            return {
                min: Math.min(...values),
                max: Math.max(...values),
                free() {},
            };
        },
    };
}

function createHeader(interleave) {
    return {
        samples,
        lines,
        bands,
        interleave,
        dataType: 'u16',
        byteOrder: 'lsb',
        headerOffset: 0,
        bytesPerPixel,
    };
}

function createHttpFetch(bytes) {
    return vi.fn(async (_url, options = {}) => {
        if (options.method === 'HEAD') {
            return new Response(null, {
                status: 200,
                headers: {
                    'content-length': String(bytes.byteLength),
                },
            });
        }

        const range = options.headers?.Range;
        if (range) {
            const [, startRaw, endRaw] = /^bytes=(\d+)-(\d+)$/.exec(range);
            const start = Number(startRaw);
            const end = Number(endRaw) + 1;
            return new Response(bytes.slice(start, end), {
                status: 206,
                headers: {
                    'content-range': `bytes ${start}-${end - 1}/${bytes.byteLength}`,
                },
            });
        }

        return new Response(bytes, {
            status: 200,
            headers: {
                'content-length': String(bytes.byteLength),
            },
        });
    });
}

describe('ENVI FormatAdapter cube read model', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    for (const interleave of ['bsq', 'bil', 'bip']) {
        it(`reads rendered tiles and spectra for ${interleave.toUpperCase()} local and HTTP sources`, async () => {
            const header = createHeader(interleave);
            const bytes = createCubeBytes(interleave);
            const adapter = createEnviFormatAdapter({
                getWasmModule: async () => createFakeWasmModule(header),
            });
            const globalStats = {
                1: { min: 0, max: 400 },
                2: { min: 0, max: 400 },
                3: { min: 0, max: 400 },
            };
            const blobSource = createBlobDataSource(new File([bytes], `${interleave}.img`));
            const httpFetch = createHttpFetch(bytes);
            vi.stubGlobal('fetch', httpFetch);
            const httpSource = createHttpRangeDataSource(`https://example.com/${interleave}.img`);

            const localTile = await adapter.readTile({
                headerBytes: new Uint8Array([1]),
                dataSource: blobSource,
                header,
                tile: { x: 0, y: 0 },
                bands: [3, 2, 1],
                globalStats,
            });
            const httpTile = await adapter.readTile({
                headerBytes: new Uint8Array([1]),
                dataSource: httpSource,
                header,
                tile: { x: 0, y: 0 },
                bands: [3, 2, 1],
                globalStats,
            });
            const spectrum = await adapter.readSpectrum({
                headerBytes: new Uint8Array([1]),
                dataSource: blobSource,
                header,
                x: 1,
                y: 1,
            });

            expect(localTile.effectiveWidth).toBe(samples);
            expect(localTile.effectiveHeight).toBe(lines);
            expect(Array.from(localTile.pixels.slice(0, 4))).toEqual([191, 128, 64, 255]);
            expect(Array.from(httpTile.pixels)).toEqual(Array.from(localTile.pixels));
            expect(Array.from(spectrum)).toEqual([111, 211, 311, 411]);
        });
    }
});
