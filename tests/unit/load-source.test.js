import { describe, expect, it } from 'vitest';

import { LoadSourceKind, normalizeLoadSource } from '../../src/sources/load-source.js';

function createFile(name, content) {
    return new File([content], name, { type: 'application/octet-stream' });
}

describe('normalizeLoadSource', () => {
    it('normalizes the canonical envi-local shape', () => {
        const headerFile = createFile('cube.hdr', 'ENVI');
        const dataFile = createFile('cube.img', new Uint8Array([1, 2, 3]));

        expect(normalizeLoadSource({
            kind: LoadSourceKind.ENVI_LOCAL,
            headerFile,
            dataFile,
        })).toEqual({
            kind: LoadSourceKind.ENVI_LOCAL,
            headerFile,
            dataFile,
        });
    });

    it('supports legacy file aliases', () => {
        const headerFile = createFile('cube.hdr', 'ENVI');
        const dataFile = createFile('cube.img', new Uint8Array([1]));

        expect(normalizeLoadSource({
            kind: LoadSourceKind.ENVI_LOCAL,
            hdrFile: headerFile,
            imgFile: dataFile,
        })).toEqual({
            kind: LoadSourceKind.ENVI_LOCAL,
            headerFile,
            dataFile,
        });
    });

    it('supports the legacy loadFile argument pair', () => {
        const headerFile = createFile('cube.hdr', 'ENVI');
        const dataFile = createFile('cube.img', new Uint8Array([1]));

        expect(normalizeLoadSource(headerFile, dataFile)).toEqual({
            kind: LoadSourceKind.ENVI_LOCAL,
            headerFile,
            dataFile,
        });
    });

    it('normalizes the canonical envi-http shape', () => {
        expect(normalizeLoadSource({
            kind: LoadSourceKind.ENVI_HTTP,
            headerUrl: 'https://example.com/cube.hdr',
            dataUrl: 'https://example.com/cube.img',
            headers: {
                Authorization: 'Bearer token',
            },
        })).toEqual({
            kind: LoadSourceKind.ENVI_HTTP,
            headerUrl: 'https://example.com/cube.hdr',
            dataUrl: 'https://example.com/cube.img',
            headers: {
                Authorization: 'Bearer token',
            },
        });
    });

    it('rejects unsupported load source kinds', () => {
        const headerFile = createFile('cube.hdr', 'ENVI');
        const dataFile = createFile('cube.img', new Uint8Array([1]));

        expect(() => normalizeLoadSource({
            kind: 'unknown-source',
            headerFile,
            dataFile,
        })).toThrow('Unsupported load source kind');
    });
});
