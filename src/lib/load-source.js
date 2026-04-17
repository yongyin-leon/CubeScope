/**
 * @fileoverview Load source normalization helpers for the public viewer API.
 */

export const LoadSourceKind = Object.freeze({
    ENVI_LOCAL: 'envi-local'
});

function isFileLike(value) {
    return Boolean(value)
        && typeof value.arrayBuffer === 'function'
        && typeof value.name === 'string';
}

export function normalizeLoadSource(source, legacyDataFile) {
    if (source && typeof source === 'object' && 'kind' in source) {
        if (source.kind !== LoadSourceKind.ENVI_LOCAL) {
            throw new Error(`Unsupported load source kind: ${source.kind}`);
        }

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

    if (isFileLike(source) && isFileLike(legacyDataFile)) {
        return {
            kind: LoadSourceKind.ENVI_LOCAL,
            headerFile: source,
            dataFile: legacyDataFile
        };
    }

    throw new Error('Unsupported load source. Use { kind: "envi-local", headerFile, dataFile }.');
}
