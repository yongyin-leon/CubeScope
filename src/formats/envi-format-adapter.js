/**
 * @fileoverview ENVI-specific internal format adapter.
 */

import { assertFormatAdapter } from './format-adapter.js';
import { normalizeCubeHeader } from './cube-header.js';
import {
    calculateSampledBandStats,
    readRenderedRgbTile,
    readSpectrumAtPixel,
} from './envi-cube-reader.js';

function normalizeHeaderBytes(value) {
    if (value instanceof Uint8Array) {
        return value;
    }

    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }

    return null;
}

const UNSUPPORTED_RENDERABLE_DATA_TYPES = new Set(['complex-f32', 'complex-f64']);

function assertRenderableEnviDataType(header) {
    if (UNSUPPORTED_RENDERABLE_DATA_TYPES.has(header?.dataType)) {
        throw new TypeError(`ENVI data type ${header.dataType} is parsed but not renderable. Complex-valued cubes must be converted to a real-valued representation before loading.`);
    }
}

export function normalizeEnviHeader(header) {
    return normalizeCubeHeader(header);
}

export function createEnviFormatAdapter({ getWasmModule } = {}) {
    if (typeof getWasmModule !== 'function') {
        throw new TypeError('createEnviFormatAdapter(...) requires a getWasmModule() function.');
    }

    return assertFormatAdapter({
        id: 'envi',
        async parseHeader({ headerSource, headerBytes } = {}) {
            const bytes = normalizeHeaderBytes(headerBytes)
                ?? (headerSource ? new Uint8Array(await headerSource.readAll()) : null);

            if (!bytes) {
                throw new TypeError('ENVI header parsing requires headerBytes or headerSource.');
            }

            const wasmModule = await getWasmModule();
            const { EnviReader } = wasmModule ?? {};

            if (typeof EnviReader !== 'function') {
                throw new Error('ENVI parser module is missing EnviReader.');
            }

            const reader = new EnviReader(bytes);
            const header = normalizeEnviHeader(reader.getHeaderAsJsObject());
            assertRenderableEnviDataType(header);

            return header;
        },
        async readTile({
            headerBytes,
            dataSource,
            header,
            tile,
            bands,
            globalStats,
            tileSize,
        } = {}) {
            const bytes = normalizeHeaderBytes(headerBytes);

            if (!bytes) {
                throw new TypeError('ENVI tile reading requires headerBytes.');
            }

            const wasmModule = await getWasmModule();
            const { EnviReader, normalizeBandInPlaceWithStats } = wasmModule ?? {};

            if (typeof EnviReader !== 'function') {
                throw new Error('ENVI parser module is missing EnviReader.');
            }

            const reader = new EnviReader(bytes);
            assertRenderableEnviDataType(header);

            return readRenderedRgbTile({
                enviReader: reader,
                dataSource,
                header,
                tile,
                bands,
                globalStats,
                normalizeBandInPlaceWithStats,
                tileSize,
            });
        },
        async readSpectrum({
            headerBytes,
            dataSource,
            header,
            x,
            y,
            tileSize,
        } = {}) {
            const bytes = normalizeHeaderBytes(headerBytes);

            if (!bytes) {
                throw new TypeError('ENVI spectrum reading requires headerBytes.');
            }

            const wasmModule = await getWasmModule();
            const { EnviReader } = wasmModule ?? {};

            if (typeof EnviReader !== 'function') {
                throw new Error('ENVI parser module is missing EnviReader.');
            }

            const reader = new EnviReader(bytes);
            assertRenderableEnviDataType(header);

            return readSpectrumAtPixel({
                enviReader: reader,
                dataSource,
                header,
                x,
                y,
                tileSize,
            });
        },
        async calculateStats({
            headerBytes,
            dataSource,
            header,
            bands,
            sampleTiles,
            tileSize,
        } = {}) {
            const bytes = normalizeHeaderBytes(headerBytes);

            if (!bytes) {
                throw new TypeError('ENVI statistics require headerBytes.');
            }

            const wasmModule = await getWasmModule();
            const { EnviReader, calculateStatistics } = wasmModule ?? {};

            if (typeof EnviReader !== 'function') {
                throw new Error('ENVI parser module is missing EnviReader.');
            }

            const reader = new EnviReader(bytes);
            assertRenderableEnviDataType(header);

            return calculateSampledBandStats({
                enviReader: reader,
                dataSource,
                header,
                bands,
                sampleTiles,
                calculateStatistics,
                tileSize,
            });
        },
    });
}
