/**
 * @fileoverview Minimal cube-store state holder for source-scoped runtime state.
 */

import {
    pixelToWorld as mapPixelToWorld,
    worldToPixel as mapWorldToPixel,
} from '../spatial/coordinate-mapper.js';
import { serializeDataSource } from '../sources/data-source.js';

export class CubeStore {
    #sourceId;
    #header;
    #headerBytes;
    #headerSource;
    #dataSource;
    #dataSourceDescriptor;
    #formatAdapter;

    constructor({ sourceId, header, headerBytes, headerSource, dataSource, dataSourceDescriptor, formatAdapter }) {
        this.#sourceId = sourceId;
        this.#header = header ?? null;
        this.#headerBytes = headerBytes ?? null;
        this.#headerSource = headerSource ?? null;
        this.#dataSource = dataSource ?? null;
        this.#dataSourceDescriptor = dataSourceDescriptor
            ?? (dataSource ? serializeDataSource(dataSource) : null);
        this.#formatAdapter = formatAdapter ?? null;
    }

    getSourceId() {
        return this.#sourceId;
    }

    getHeader() {
        return this.#header;
    }

    getHeaderBytes() {
        return this.#headerBytes;
    }

    getHeaderSource() {
        return this.#headerSource;
    }

    getDataSource() {
        return this.#dataSource;
    }

    getDataSourceDescriptor() {
        return this.#dataSourceDescriptor;
    }

    getImageFile() {
        return this.#dataSource?.kind === 'blob'
            ? this.#dataSource.source ?? null
            : null;
    }

    async getTile(request = {}) {
        if (!this.#formatAdapter?.readTile || !this.#header || !this.#headerBytes || !this.#dataSource) {
            return null;
        }

        return this.#formatAdapter.readTile({
            ...request,
            header: this.#header,
            headerBytes: this.#headerBytes,
            dataSource: this.#dataSource,
            sourceId: this.#sourceId,
        });
    }

    async getSpectrum(request = {}) {
        if (!this.#formatAdapter?.readSpectrum || !this.#header || !this.#headerBytes || !this.#dataSource) {
            return null;
        }

        return this.#formatAdapter.readSpectrum({
            ...request,
            header: this.#header,
            headerBytes: this.#headerBytes,
            dataSource: this.#dataSource,
            sourceId: this.#sourceId,
        });
    }

    async calculateStats(request = {}) {
        if (!this.#formatAdapter?.calculateStats || !this.#header || !this.#headerBytes || !this.#dataSource) {
            return null;
        }

        return this.#formatAdapter.calculateStats({
            ...request,
            header: this.#header,
            headerBytes: this.#headerBytes,
            dataSource: this.#dataSource,
            sourceId: this.#sourceId,
        });
    }

    pixelToWorld(x, y) {
        return mapPixelToWorld(this.#header, x, y);
    }

    worldToPixel(x, y) {
        return mapWorldToPixel(this.#header, x, y);
    }

    unload() {
        this.#header = null;
        this.#headerBytes = null;
        this.#headerSource = null;
        this.#dataSource = null;
        this.#dataSourceDescriptor = null;
        this.#formatAdapter = null;
    }
}
