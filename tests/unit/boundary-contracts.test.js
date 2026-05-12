import { describe, expect, it } from 'vitest';

import { assertFormatAdapter } from '../../src/formats/format-adapter.js';
import { isCubeHeader, normalizeCubeHeader } from '../../src/formats/cube-header.js';
import { createEnviFormatAdapter } from '../../src/formats/envi-format-adapter.js';
import { createRendererInput, isRendererInput } from '../../src/rendering/renderer-contract.js';
import { createBlobDataSource, isDataSource } from '../../src/sources/data-source.js';
import { createEnviLoadSource, createLocalEnviLoadSource, LoadSourceKind } from '../../src/sources/load-source.js';
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

    it('attaches HTTP range-backed data sources to the canonical envi-http load source', () => {
        const loadSource = createEnviLoadSource({
            kind: LoadSourceKind.ENVI_HTTP,
            headerUrl: 'https://example.com/cube.hdr',
            dataUrl: 'https://example.com/cube.img',
            headers: {
                Authorization: 'Bearer token',
            },
        });

        expect(loadSource.kind).toBe(LoadSourceKind.ENVI_HTTP);
        expect(loadSource.headerSource.kind).toBe('http-range');
        expect(loadSource.dataSource.kind).toBe('http-range');
        expect(loadSource.headerSource.name).toBe('cube.hdr');
        expect(loadSource.dataSource.name).toBe('cube.img');
        expect(loadSource.dataSource.headers).toEqual({
            Authorization: 'Bearer token',
        });
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
                            mapInfo: 'UTM, 1, 1, 500000, 4100000, 30, 30, 50, North, WGS-84, units=Meters',
                            coordinateSystemString: 'PROJCS["WGS 84 / UTM zone 50N"]',
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
        expect(header.spatialReference).toEqual({
            affineTransform: [500000, 30, 0, 4100000, 0, -30],
            epsg: undefined,
            coordinateSystemString: 'PROJCS["WGS 84 / UTM zone 50N"]',
            mapInfo: {
                projectionName: 'UTM',
                referencePixel: { x: 1, y: 1 },
                referenceCoordinate: { x: 500000, y: 4100000 },
                pixelSize: { x: 30, y: 30 },
                zone: 50,
                hemisphere: 'North',
                datum: 'WGS-84',
                units: 'Meters',
                rawTokens: ['UTM', '1', '1', '500000', '4100000', '30', '30', '50', 'North', 'WGS-84', 'units=Meters'],
            },
        });
        expect(Object.isFrozen(header)).toBe(true);
    });

    it('requires concrete tile and spectrum readers on format adapters', () => {
        expect(() => assertFormatAdapter({
            id: 'incomplete',
            parseHeader: async () => ({}),
        })).toThrow('readTile');

        expect(assertFormatAdapter({
            id: 'complete',
            parseHeader: async () => ({}),
            readTile: async () => null,
            readSpectrum: async () => null,
        }).id).toBe('complete');
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

    it('stores source-scoped cube metadata and delegates reads behind CubeStore', async () => {
        const headerFile = createFile('cube.hdr', 'ENVI');
        const dataFile = createFile('cube.img', new Uint8Array([1, 2, 3]));
        const headerSource = createBlobDataSource(headerFile, { id: 'header:1' });
        const dataSource = createBlobDataSource(dataFile, { id: 'data:1' });
        const header = {
            samples: 2,
            lines: 2,
            bands: 3,
            interleave: 'bil',
            spatialReference: {
                affineTransform: [500000, 30, 0, 4100000, 0, -30],
            },
        };
        const headerBytes = new Uint8Array([69, 78, 86, 73]);
        const formatAdapter = {
            id: 'fake',
            async parseHeader() {
                return header;
            },
            async readTile(request) {
                return {
                    tile: request.tile,
                    sourceId: request.sourceId,
                    header: request.header,
                    bytes: request.headerBytes,
                    source: request.dataSource,
                };
            },
            async readSpectrum(request) {
                return new Float32Array([request.x, request.y, request.header.bands]);
            },
            async calculateStats(request) {
                return {
                    bands: request.bands,
                    sourceId: request.sourceId,
                };
            },
        };
        const store = new CubeStore({
            sourceId: 7,
            header,
            headerBytes,
            headerSource,
            dataSource,
            formatAdapter,
        });

        expect(store.getSourceId()).toBe(7);
        expect(store.getHeader()).toEqual(header);
        expect(store.getHeaderBytes()).toBe(headerBytes);
        expect(store.getHeaderSource()).toBe(headerSource);
        expect(store.getDataSource()).toBe(dataSource);
        expect(store.getImageFile()).toBe(dataFile);
        expect(store.pixelToWorld(1, 1)).toEqual({ x: 500030, y: 4099970 });
        expect(store.worldToPixel(500030, 4099970)).toEqual({ x: 1, y: 1 });
        await expect(store.getTile({ tile: { x: 0, y: 0 } })).resolves.toMatchObject({
            tile: { x: 0, y: 0 },
            sourceId: 7,
            header,
            bytes: headerBytes,
            source: dataSource,
        });
        expect(Array.from(await store.getSpectrum({ x: 1, y: 2 }))).toEqual([1, 2, 3]);
        await expect(store.calculateStats({ bands: [1, 2, 3] })).resolves.toEqual({
            bands: [1, 2, 3],
            sourceId: 7,
        });

        store.unload();

        expect(store.getHeader()).toBeNull();
        expect(store.getHeaderBytes()).toBeNull();
        expect(store.getHeaderSource()).toBeNull();
        expect(store.getDataSource()).toBeNull();
        expect(store.getImageFile()).toBeNull();
        expect(store.pixelToWorld(0, 0)).toBeNull();
        await expect(store.getTile({ tile: { x: 0, y: 0 } })).resolves.toBeNull();
        await expect(store.getSpectrum({ x: 0, y: 0 })).resolves.toBeNull();
    });

    it('freezes a minimal renderer input contract', () => {
        const rendererInput = createRendererInput({
            sourceId: 11,
            slot: 'transition',
            header: { samples: 64, lines: 32 },
            viewState: { scale: 1.5 },
            layers: [{ id: 'rgb' }],
            tiles: [{ x: 0, y: 1 }],
            tileSize: 256,
            clearMode: 'load',
        });

        expect(isRendererInput(rendererInput)).toBe(true);
        expect(rendererInput.sourceId).toBe('11');
        expect(rendererInput.slot).toBe('transition');
        expect(rendererInput.header).toEqual({ samples: 64, lines: 32 });
        expect(rendererInput.viewState).toEqual({ scale: 1.5 });
        expect(rendererInput.layers).toEqual([{ id: 'rgb' }]);
        expect(rendererInput.tiles).toEqual([{ x: 0, y: 1 }]);
        expect(rendererInput.tileSize).toBe(256);
        expect(rendererInput.clearMode).toBe('load');
        expect(Object.isFrozen(rendererInput)).toBe(true);
        expect(Object.isFrozen(rendererInput.layers)).toBe(true);
        expect(Object.isFrozen(rendererInput.tiles)).toBe(true);
    });
});
