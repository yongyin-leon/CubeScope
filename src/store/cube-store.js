/**
 * @fileoverview Minimal cube-store state holder for source-scoped runtime state.
 */

export class CubeStore {
    #sourceId;
    #header;
    #headerBytes;
    #headerSource;
    #dataSource;

    constructor({ sourceId, header, headerBytes, headerSource, dataSource }) {
        this.#sourceId = sourceId;
        this.#header = header ?? null;
        this.#headerBytes = headerBytes ?? null;
        this.#headerSource = headerSource ?? null;
        this.#dataSource = dataSource ?? null;
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

    getImageFile() {
        return this.#dataSource?.source ?? null;
    }

    unload() {
        this.#header = null;
        this.#headerBytes = null;
        this.#headerSource = null;
        this.#dataSource = null;
    }
}
