/**
 * @fileoverview Minimal internal DataSource contracts for byte-oriented access.
 */

function isBlobLike(value) {
    return Boolean(value)
        && typeof value.arrayBuffer === 'function'
        && typeof value.slice === 'function';
}

function isPlainObject(value) {
    return Boolean(value)
        && typeof value === 'object'
        && !Array.isArray(value);
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

function normalizeHeaders(headers) {
    if (headers == null) {
        return undefined;
    }

    if (!isPlainObject(headers)) {
        throw new TypeError('HTTP data source headers must be a plain object.');
    }

    const normalizedHeaders = Object.fromEntries(
        Object.entries(headers)
            .filter(([, value]) => value != null)
            .map(([key, value]) => [String(key), String(value)])
    );

    return Object.keys(normalizedHeaders).length > 0
        ? Object.freeze(normalizedHeaders)
        : undefined;
}

function deriveNameFromUrl(url, fallback = 'remote-source') {
    try {
        const parsedUrl = new URL(url, 'https://cubescope.invalid');
        const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
        return pathSegments.at(-1) ?? fallback;
    } catch {
        return fallback;
    }
}

function parseContentRangeTotal(value) {
    if (typeof value !== 'string') {
        return undefined;
    }

    const match = /^bytes\s+\d+-\d+\/(\d+|\*)$/i.exec(value.trim());
    if (!match || match[1] === '*') {
        return undefined;
    }

    const total = Number(match[1]);
    return Number.isInteger(total) && total >= 0 ? total : undefined;
}

async function fetchOrThrow(url, options = {}, failureContext = 'HTTP data source request') {
    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`${failureContext} failed: ${response.status} ${response.statusText}`);
    }

    return response;
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
        sizeHint: blobSize,
        descriptor: Object.freeze({
            id,
            kind: 'blob',
            name,
            size: blobSize,
            source: blob,
        }),
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

/**
 * Creates a byte-addressable data source backed by an HTTP endpoint that supports range reads.
 *
 * @param {string} url
 * @param {{ id?: string, name?: string, headers?: Record<string, string>, size?: number }} [options]
 * @returns {{
 *   id: string,
 *   kind: 'http-range',
 *   name: string,
 *   url: string,
 *   headers?: Record<string, string>,
 *   size: () => Promise<number>,
 *   read: (range?: { start: number, end: number }) => Promise<ArrayBuffer>,
 *   readAll: () => Promise<ArrayBuffer>,
 *   close: () => Promise<void>,
 *   descriptor: Record<string, unknown>,
 * }}
 */
export function createHttpRangeDataSource(url, options = {}) {
    if (typeof url !== 'string' || url.trim().length === 0) {
        throw new TypeError('createHttpRangeDataSource(...) requires a non-empty URL string.');
    }

    const normalizedUrl = url.trim();
    const name = options.name ?? deriveNameFromUrl(normalizedUrl);
    const id = options.id ?? `http-range:${normalizedUrl}`;
    const headers = normalizeHeaders(options.headers);
    let cachedSize = Number.isInteger(options.size) && options.size >= 0 ? options.size : undefined;
    let cachedFullBufferPromise = null;

    async function resolveSize() {
        if (cachedSize != null) {
            return cachedSize;
        }

        try {
            const headResponse = await fetch(normalizedUrl, {
                method: 'HEAD',
                headers,
            });
            const contentLength = Number(headResponse.headers.get('content-length'));

            if (headResponse.ok && Number.isInteger(contentLength) && contentLength >= 0) {
                cachedSize = contentLength;
                return cachedSize;
            }
        } catch {}

        const rangeHeaders = {
            ...(headers ?? {}),
            Range: 'bytes=0-0',
        };
        const response = await fetchOrThrow(
            normalizedUrl,
            { method: 'GET', headers: rangeHeaders },
            `HTTP size probe for ${name}`
        );
        const total = parseContentRangeTotal(response.headers.get('content-range'))
            ?? Number(response.headers.get('content-length'));

        if (!Number.isInteger(total) || total < 0) {
            throw new Error(`HTTP data source could not determine the remote size for ${name}.`);
        }

        cachedSize = total;
        return cachedSize;
    }

    return {
        id,
        kind: 'http-range',
        name,
        url: normalizedUrl,
        headers,
        get sizeHint() {
            return cachedSize;
        },
        descriptor: Object.freeze({
            id,
            kind: 'http-range',
            name,
            url: normalizedUrl,
            headers,
            size: cachedSize,
        }),
        async size() {
            return resolveSize();
        },
        async read(range) {
            const totalSize = await resolveSize();
            const { start, end } = normalizeRange(range, totalSize);

            if (start === end) {
                return new ArrayBuffer(0);
            }

            if (start === 0 && end === totalSize) {
                return this.readAll();
            }

            const response = await fetchOrThrow(
                normalizedUrl,
                {
                    method: 'GET',
                    headers: {
                        ...(headers ?? {}),
                        Range: `bytes=${start}-${end - 1}`,
                    },
                },
                `HTTP range read for ${name}`
            );

            if (response.status !== 206) {
                throw new Error(`HTTP data source expected a 206 response for ${name}, received ${response.status}.`);
            }

            const contentRangeTotal = parseContentRangeTotal(response.headers.get('content-range'));
            if (contentRangeTotal != null) {
                cachedSize = contentRangeTotal;
            }

            return response.arrayBuffer();
        },
        async readAll() {
            if (!cachedFullBufferPromise) {
                cachedFullBufferPromise = (async () => {
                    const response = await fetchOrThrow(
                        normalizedUrl,
                        {
                            method: 'GET',
                            headers,
                        },
                        `HTTP full read for ${name}`
                    );
                    const contentLength = Number(response.headers.get('content-length'));
                    if (Number.isInteger(contentLength) && contentLength >= 0) {
                        cachedSize = contentLength;
                    }
                    return response.arrayBuffer();
                })().catch((error) => {
                    cachedFullBufferPromise = null;
                    throw error;
                });
            }

            return cachedFullBufferPromise;
        },
        async close() {},
    };
}

export function isDataSourceDescriptor(value) {
    return Boolean(value)
        && typeof value.id === 'string'
        && typeof value.kind === 'string'
        && typeof value.name === 'string';
}

export function serializeDataSource(dataSource) {
    if (!isDataSource(dataSource)) {
        throw new TypeError('serializeDataSource(...) requires a DataSource.');
    }

    if (dataSource.kind === 'blob') {
        return Object.freeze({
            id: dataSource.id,
            kind: 'blob',
            name: dataSource.name,
            size: dataSource.sizeHint ?? dataSource.source?.size,
            source: dataSource.source,
        });
    }

    if (dataSource.kind === 'http-range') {
        return Object.freeze({
            id: dataSource.id,
            kind: 'http-range',
            name: dataSource.name,
            url: dataSource.url,
            headers: dataSource.headers,
            size: dataSource.sizeHint,
        });
    }

    throw new Error(`Unsupported data source kind for serialization: ${dataSource.kind}`);
}

export function createDataSourceFromDescriptor(descriptor) {
    if (!isDataSourceDescriptor(descriptor)) {
        throw new TypeError('createDataSourceFromDescriptor(...) requires a valid descriptor.');
    }

    if (descriptor.kind === 'blob') {
        return createBlobDataSource(descriptor.source, {
            id: descriptor.id,
        });
    }

    if (descriptor.kind === 'http-range') {
        return createHttpRangeDataSource(descriptor.url, {
            id: descriptor.id,
            name: descriptor.name,
            headers: descriptor.headers,
            size: descriptor.size,
        });
    }

    throw new Error(`Unsupported data source descriptor kind: ${descriptor.kind}`);
}

export function isDataSource(value) {
    return Boolean(value)
        && typeof value.id === 'string'
        && typeof value.read === 'function'
        && typeof value.readAll === 'function'
        && typeof value.size === 'function';
}
