/**
 * @fileoverview Minimal internal DataSource contracts for byte-oriented access.
 */

function isBlobLike(value) {
    return Boolean(value)
        && typeof value.arrayBuffer === 'function'
        && typeof value.slice === 'function';
}

function normalizeRange(range, size) {
    if (!range) {
        return { start: 0, end: size };
    }

    const { start, end } = range;

    if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new TypeError('DataSource.read(range) requires integer "start" and "end" values.');
    }

    if (start < 0 || end < start || end > size) {
        throw new RangeError(`DataSource.read(range) received an invalid range: ${start}-${end} of ${size}.`);
    }

    return { start, end };
}

/**
 * Creates a minimal byte-addressable data source backed by a Blob/File object.
 *
 * @param {Blob | File} blob
 * @param {{ id?: string }} [options]
 * @returns {{
 *   id: string,
 *   kind: 'blob',
 *   name: string,
 *   source: Blob | File,
 *   size: () => Promise<number>,
 *   read: (range?: { start: number, end: number }) => Promise<ArrayBuffer>,
 *   readAll: () => Promise<ArrayBuffer>,
 *   close: () => Promise<void>,
 * }}
 */
export function createBlobDataSource(blob, options = {}) {
    if (!isBlobLike(blob)) {
        throw new TypeError('createBlobDataSource(...) requires a Blob/File-like object.');
    }

    const name = typeof blob.name === 'string' && blob.name.length > 0
        ? blob.name
        : options.id ?? 'anonymous-blob';
    const blobSize = Number.isFinite(blob.size) ? blob.size : 0;
    const id = options.id ?? `blob:${name}:${blobSize}`;

    return {
        id,
        kind: 'blob',
        name,
        source: blob,
        async size() {
            return blobSize;
        },
        async read(range) {
            const { start, end } = normalizeRange(range, blobSize);
            return blob.slice(start, end).arrayBuffer();
        },
        async readAll() {
            return blob.arrayBuffer();
        },
        async close() {},
    };
}

export function isDataSource(value) {
    return Boolean(value)
        && typeof value.id === 'string'
        && typeof value.read === 'function'
        && typeof value.readAll === 'function'
        && typeof value.size === 'function';
}
