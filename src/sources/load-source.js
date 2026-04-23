/**
 * @fileoverview Load source normalization helpers for the public viewer API.
 */

import { createBlobDataSource, createHttpRangeDataSource } from './data-source.js';

export const LoadSourceKind = Object.freeze({
    ENVI_LOCAL: 'envi-local',
    ENVI_HTTP: 'envi-http',
});

function isFileLike(value) {
    return Boolean(value)
        && typeof value.arrayBuffer === 'function'
        && typeof value.name === 'string';
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeLoadSource(source, legacyDataFile) {
    if (source && typeof source === 'object' && 'kind' in source) {
        if (source.kind === LoadSourceKind.ENVI_LOCAL) {
            const headerFile = source.headerFile ?? source.hdrFile;
            const dataFile = source.dataFile ?? source.imgFile;

            if (!isFileLike(headerFile) || !isFileLike(dataFile)) {
                throw new Error('The "envi-local" source requires both headerFile and dataFile.');
            }

            return {
                kind: LoadSourceKind.ENVI_LOCAL,
                headerFile,
                dataFile
            };
        }

        if (source.kind === LoadSourceKind.ENVI_HTTP) {
            const headerUrl = source.headerUrl ?? source.hdrUrl;
            const dataUrl = source.dataUrl ?? source.imgUrl;

            if (!isNonEmptyString(headerUrl) || !isNonEmptyString(dataUrl)) {
                throw new Error('The "envi-http" source requires both headerUrl and dataUrl.');
            }

            return {
                kind: LoadSourceKind.ENVI_HTTP,
                headerUrl: headerUrl.trim(),
                dataUrl: dataUrl.trim(),
                headers: source.headers,
            };
        }

        {
            throw new Error(`Unsupported load source kind: ${source.kind}`);
        }
    }

    if (isFileLike(source) && isFileLike(legacyDataFile)) {
        return {
            kind: LoadSourceKind.ENVI_LOCAL,
            headerFile: source,
            dataFile: legacyDataFile
        };
    }

    throw new Error('Unsupported load source. Use { kind: "envi-local", headerFile, dataFile } or { kind: "envi-http", headerUrl, dataUrl }.');
}

export function createEnviLoadSource(source, legacyDataFile) {
    const normalizedSource = normalizeLoadSource(source, legacyDataFile);

    if (normalizedSource.kind === LoadSourceKind.ENVI_LOCAL) {
        return {
            ...normalizedSource,
            headerSource: createBlobDataSource(normalizedSource.headerFile, {
                id: `envi-local:header:${normalizedSource.headerFile.name}:${normalizedSource.headerFile.size}`,
            }),
            dataSource: createBlobDataSource(normalizedSource.dataFile, {
                id: `envi-local:data:${normalizedSource.dataFile.name}:${normalizedSource.dataFile.size}`,
            }),
        };
    }

    return {
        ...normalizedSource,
        headerSource: createHttpRangeDataSource(normalizedSource.headerUrl, {
            id: `envi-http:header:${normalizedSource.headerUrl}`,
            headers: normalizedSource.headers,
        }),
        dataSource: createHttpRangeDataSource(normalizedSource.dataUrl, {
            id: `envi-http:data:${normalizedSource.dataUrl}`,
            headers: normalizedSource.headers,
        }),
    };
}

export function createLocalEnviLoadSource(source, legacyDataFile) {
    const normalizedSource = createEnviLoadSource(source, legacyDataFile);

    if (normalizedSource.kind !== LoadSourceKind.ENVI_LOCAL) {
        throw new Error('createLocalEnviLoadSource(...) only supports envi-local inputs.');
    }

    return normalizedSource;
}
