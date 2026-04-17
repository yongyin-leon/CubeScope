import { describe, expect, it } from 'vitest';

import { isCubeHeader, normalizeCubeHeader } from '../../src/formats/cube-header.js';
import { createEnviFormatAdapter } from '../../src/formats/envi-format-adapter.js';
import { createRendererInput, isRendererInput } from '../../src/rendering/renderer-contract.js';
import { createBlobDataSource, isDataSource } from '../../src/sources/data-source.js';
import { createLocalEnviLoadSource, LoadSourceKind } from '../../src/sources/load-source.js';
import { CubeStore } from '../../src/store/cube-store.js';

function createFile(name, content) {
    return new File([content], name, { type: 'application/octet-stream' });
}

describe('minimal runtime boundary contracts', () => {
    it('creates blob-backed data sources with stable byte reads', async () => {
        const source = createBlobDataSource(createFile('cube.img', new Uint8Array([10, 20, 30, 40])));

        expect(isDataSource(source)).toBe(true);
        expect(await source.size()).toBe(4);
        expect(Array.from(new Uint8Array(await source.read({ start: 1, end: 3 })))).toEqual([20, 30]);
        expect(Array.from(new Uint8Array(await source.readAll()))).toEqual([10, 20, 30, 40]);
    });

    it('attaches internal data sources to the canonical envi-local load source', () => {
        const headerFile = createFile('cube.hdr', 'ENVI');
        const dataFile = createFile('cube.img', new Uint8Array([1, 2, 3]));
        const loadSource = createLocalEnviLoadSource({
            kind: LoadSourceKind.ENVI_LOCAL,
            headerFile,
            dataFile,
        });

        expect(loadSource.kind).toBe(LoadSourceKind.ENVI_LOCAL);
        expect(loadSource.headerFile).toBe(headerFile);
        expect(loadSource.dataFile).toBe(dataFile);
        expect(loadSource.headerSource.name).toBe('cube.hdr');
        expect(loadSource.dataSource.name).toBe('cube.img');
        expect(isDataSource(loadSource.headerSource)).toBe(true);
        expect(isDataSource(loadSource.dataSource)).toBe(true);
    });

    it('normalizes ENVI headers through the internal format adapter', async () => {
        const adapter = createEnviFormatAdapter({
            getWasmModule: async () => ({
                EnviReader: class {
                    constructor(bytes) {
                        this.bytes = bytes;
                    }

                    getHeaderAsJsObject() {
                        return {
                            samples: 64,
                            lines: 32,
                            bands: 16,
                            interleave: 'BIL',
                            dataType: 'F32',
                            byteOrder: 'Lsb',
                            headerOffset: 0,
                            bytesPerPixel: 4,
                            wavelength: [450.5, 550.25],
                        };
                    }
                },
            }),
        });

        const header = await adapter.parseHeader({
            headerBytes: new Uint8Array([1, 2, 3]),
        });

        expect(header.interleave).toBe('bil');
        expect(header.samples).toBe(64);
        expect(header.lines).toBe(32);
        expect(header.bands).toBe(16);
        expect(header.dataType).toBe('f32');
        expect(header.byteOrder).toBe('lsb');
        expect(header.wavelength).toEqual([450.5, 550.25]);
        expect(Object.isFrozen(header)).toBe(true);
    });

    it('freezes the stable CubeHeader contract in code', () => {
        const header = normalizeCubeHeader({
            samples: '128',
            lines: 64,
            bands: 8,
            interleave: 'BIP',
            dataType: 12,
            byteOrder: 1,
            headerOffset: 0,
            bytesPerPixel: '2',
            bandMetadata: [{ index: 1, name: 'Red', displayRole: 'RED' }],
            spatialReference: {
                epsg: '4326',
                affineTransform: [0, 1, 0, 0, 0, -1],
            },
        });

        expect(isCubeHeader(header)).toBe(true);
        expect(header).toEqual({
            samples: 128,
            lines: 64,
            bands: 8,
            interleave: 'bip',
            dataType: 'u16',
            byteOrder: 'msb',
            headerOffset: 0,
            bytesPerPixel: 2,
            description: undefined,
            fileType: undefined,
            sensorType: undefined,
            wavelength: undefined,
            customFields: undefined,
            bandMetadata: [{ index: 1, name: 'Red', wavelength: undefined, displayRole: 'red' }],
            spatialReference: {
                affineTransform: [0, 1, 0, 0, 0, -1],
                epsg: 4326,
                coordinateSystemString: undefined,
                mapInfo: undefined,
            },
        });
        expect(Object.isFrozen(header)).toBe(true);
        expect(Object.isFrozen(header.bandMetadata)).toBe(true);
        expect(Object.isFrozen(header.spatialReference)).toBe(true);
    });

    it('stores source-scoped cube metadata behind CubeStore', () => {
        const headerFile = createFile('cube.hdr', 'ENVI');
        const dataFile = createFile('cube.img', new Uint8Array([1, 2, 3]));
        const headerSource = createBlobDataSource(headerFile, { id: 'header:1' });
        const dataSource = createBlobDataSource(dataFile, { id: 'data:1' });
        const header = { samples: 2, lines: 2, bands: 3, interleave: 'bil' };
        const headerBytes = new Uint8Array([69, 78, 86, 73]);
        const store = new CubeStore({
            sourceId: 7,
            header,
            headerBytes,
            headerSource,
            dataSource,
        });

        expect(store.getSourceId()).toBe(7);
        expect(store.getHeader()).toEqual(header);
        expect(store.getHeaderBytes()).toBe(headerBytes);
        expect(store.getHeaderSource()).toBe(headerSource);
        expect(store.getDataSource()).toBe(dataSource);
        expect(store.getImageFile()).toBe(dataFile);

        store.unload();

        expect(store.getHeader()).toBeNull();
        expect(store.getHeaderBytes()).toBeNull();
        expect(store.getHeaderSource()).toBeNull();
        expect(store.getDataSource()).toBeNull();
        expect(store.getImageFile()).toBeNull();
    });

    it('freezes a minimal renderer input contract', () => {
        const rendererInput = createRendererInput({
            sourceId: 11,
            slot: 'transition',
            header: { samples: 64, lines: 32 },
            viewState: { scale: 1.5 },
            layers: [{ id: 'rgb' }],
            tiles: [{ x: 0, y: 1 }],
            clearMode: 'load',
        });

        expect(isRendererInput(rendererInput)).toBe(true);
        expect(rendererInput.sourceId).toBe('11');
        expect(rendererInput.slot).toBe('transition');
        expect(rendererInput.header).toEqual({ samples: 64, lines: 32 });
        expect(rendererInput.viewState).toEqual({ scale: 1.5 });
        expect(rendererInput.layers).toEqual([{ id: 'rgb' }]);
        expect(rendererInput.tiles).toEqual([{ x: 0, y: 1 }]);
        expect(rendererInput.clearMode).toBe('load');
        expect(Object.isFrozen(rendererInput)).toBe(true);
        expect(Object.isFrozen(rendererInput.layers)).toBe(true);
        expect(Object.isFrozen(rendererInput.tiles)).toBe(true);
    });
});
