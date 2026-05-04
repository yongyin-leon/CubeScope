import { describe, expect, it } from 'vitest';

import { createEnviFormatAdapter } from '../../src/formats/envi-format-adapter.js';
import { createBlobDataSource, serializeDataSource } from '../../src/sources/data-source.js';
import { CubeStore } from '../../src/store/cube-store.js';
import { createWorkerCubeStore } from '../../src/runtime/worker-cube-store.js';

const header = {
    samples: 2,
    lines: 2,
    bands: 3,
    interleave: 'bsq',
    dataType: 'u16',
    byteOrder: 'lsb',
    headerOffset: 0,
    bytesPerPixel: 2,
};

function createBsqBytes() {
    const bytes = new Uint8Array(header.samples * header.lines * header.bands * header.bytesPerPixel);
    const view = new DataView(bytes.buffer);
    let index = 0;

    for (let bandIndex = 0; bandIndex < header.bands; bandIndex += 1) {
        for (let y = 0; y < header.lines; y += 1) {
            for (let x = 0; x < header.samples; x += 1) {
                view.setUint16(index * 2, (bandIndex + 1) * 100 + y * 10 + x, true);
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

function createWasmModule() {
    return {
        EnviReader: class {
            getHeaderAsJsObject() {
                return header;
            }

            extractBsqTileRaw(chunkData) {
                const values = [];
                for (let offset = 0; offset < chunkData.byteLength; offset += 2) {
                    values.push(readU16(chunkData, offset));
                }
                return new Float32Array(values);
            }
        },
        async normalizeBandInPlaceWithStats(data, min, max) {
            const range = max - min;
            for (let index = 0; index < data.length; index += 1) {
                data[index] = (data[index] - min) / range;
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

describe('worker CubeStore construction', () => {
    it('matches direct CubeStore tile and spectrum reads', async () => {
        const hdrBytes = new Uint8Array([69, 78, 86, 73]);
        const dataSource = createBlobDataSource(new File([createBsqBytes()], 'cube.img'));
        const wasmModule = createWasmModule();
        const directStore = new CubeStore({
            sourceId: 1,
            header,
            headerBytes: hdrBytes,
            dataSource,
            formatAdapter: createEnviFormatAdapter({
                getWasmModule: async () => wasmModule,
            }),
        });
        const workerStore = createWorkerCubeStore({
            sourceId: 1,
            hdrBytes,
            dataSource: serializeDataSource(dataSource),
            header,
            wasmModule,
        });
        const request = {
            tile: { x: 0, y: 0 },
            bands: [3, 2, 1],
            globalStats: {
                1: { min: 0, max: 300 },
                2: { min: 0, max: 300 },
                3: { min: 0, max: 300 },
            },
        };

        const directTile = await directStore.getTile(request);
        const workerTile = await workerStore.getTile(request);

        expect(Array.from(workerTile.pixels)).toEqual(Array.from(directTile.pixels));
        await expect(workerStore.getSpectrum({ x: 1, y: 1 })).resolves.toEqual(
            await directStore.getSpectrum({ x: 1, y: 1 })
        );
    });
});
