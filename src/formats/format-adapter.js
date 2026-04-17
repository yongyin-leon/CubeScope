/**
 * @fileoverview Minimal internal format-adapter contracts.
 */

/**
 * @typedef {{
 *   headerSource?: import('../sources/data-source.js').createBlobDataSource,
 *   headerBytes?: Uint8Array | ArrayBuffer,
 * }} HeaderParseInput
 */

/**
 * @typedef {{
 *   id: string,
 *   parseHeader: (input: HeaderParseInput) => Promise<Record<string, unknown>>,
 *   readTile?: (request: unknown) => Promise<unknown>,
 *   readSpectrum?: (request: unknown) => Promise<Float32Array | null>,
 *   capabilities?: Record<string, unknown>,
 * }} FormatAdapter
 */

/**
 * @param {FormatAdapter} adapter
 * @returns {FormatAdapter}
 */
export function assertFormatAdapter(adapter) {
    if (!adapter || typeof adapter.id !== 'string' || typeof adapter.parseHeader !== 'function') {
        throw new TypeError('A FormatAdapter must define "id" and "parseHeader(...)".');
    }

    return adapter;
}
