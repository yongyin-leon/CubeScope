import { describe, expect, it } from 'vitest';

import {
    buildRemoteSampleLoadSource,
    getRemoteSampleById,
    normalizeRemoteSampleCatalog,
    resolveRemoteSampleUrl,
} from '../../src/samples/remote-sample-catalog.js';

describe('remote sample catalog', () => {
    it('normalizes the catalog and resolves sample ids', () => {
        const catalog = normalizeRemoteSampleCatalog({
            version: 1,
            samples: [
                {
                    id: 'repo-local-http',
                    title: 'Repo Local HTTP Fixture',
                    kind: 'envi-http',
                    availability: 'deterministic-local',
                    validationTier: 'local',
                    headerUrl: '/fixtures/cube.hdr',
                    dataUrl: '/fixtures/cube.img',
                },
            ],
        });

        const sample = getRemoteSampleById(catalog, 'repo-local-http');

        expect(catalog.samples).toHaveLength(1);
        expect(sample?.title).toBe('Repo Local HTTP Fixture');
        expect(sample?.kind).toBe('envi-http');
    });

    it('builds a canonical envi-http load source and resolves URLs against a base origin', () => {
        const sample = {
            id: 'repo-local-http',
            title: 'Repo Local HTTP Fixture',
            kind: 'envi-http',
            availability: 'deterministic-local',
            validationTier: 'local',
            headerUrl: '/fixtures/cube.hdr',
            dataUrl: '/fixtures/cube.img',
            headers: {
                Authorization: 'Bearer example',
            },
        };

        expect(buildRemoteSampleLoadSource(sample)).toEqual({
            kind: 'envi-http',
            headerUrl: '/fixtures/cube.hdr',
            dataUrl: '/fixtures/cube.img',
            headers: {
                Authorization: 'Bearer example',
            },
        });
        expect(resolveRemoteSampleUrl(sample, 'headerUrl', 'https://example.com/examples/')).toBe('https://example.com/fixtures/cube.hdr');
        expect(resolveRemoteSampleUrl(sample, 'dataUrl', 'https://example.com/examples/')).toBe('https://example.com/fixtures/cube.img');
    });

    it('rejects duplicate sample ids', () => {
        expect(() => normalizeRemoteSampleCatalog({
            samples: [
                {
                    id: 'duplicate-id',
                    title: 'First',
                    kind: 'envi-http',
                    headerUrl: '/fixtures/first.hdr',
                    dataUrl: '/fixtures/first.img',
                },
                {
                    id: 'duplicate-id',
                    title: 'Second',
                    kind: 'envi-http',
                    headerUrl: '/fixtures/second.hdr',
                    dataUrl: '/fixtures/second.img',
                },
            ],
        })).toThrow(/duplicate id/i);
    });
});
