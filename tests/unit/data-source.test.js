import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    createBlobDataSource,
    createDataSourceFromDescriptor,
    createHttpRangeDataSource,
    serializeDataSource,
} from '../../src/sources/data-source.js';

describe('data source implementations', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('reads remote bytes through HTTP range requests', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(null, {
                status: 200,
                headers: {
                    'content-length': '8',
                },
            }))
            .mockResolvedValueOnce(new Response(new Uint8Array([20, 30]), {
                status: 206,
                headers: {
                    'content-range': 'bytes 1-2/8',
                },
            }));

        vi.stubGlobal('fetch', fetchMock);

        const source = createHttpRangeDataSource('https://example.com/cube.img');

        expect(await source.size()).toBe(8);
        expect(Array.from(new Uint8Array(await source.read({ start: 1, end: 3 })))).toEqual([20, 30]);
        expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://example.com/cube.img', {
            method: 'HEAD',
            headers: undefined,
        });
        expect(fetchMock.mock.calls[1][1].headers.Range).toBe('bytes=1-2');
    });

    it('reuses a single full HTTP fetch when the whole remote file is requested repeatedly', async () => {
        const fullResponse = new Uint8Array([1, 2, 3, 4]).buffer;
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(null, {
                status: 200,
                headers: {
                    'content-length': '4',
                },
            }))
            .mockResolvedValueOnce(new Response(fullResponse, {
                status: 200,
                headers: {
                    'content-length': '4',
                },
            }));

        vi.stubGlobal('fetch', fetchMock);

        const source = createHttpRangeDataSource('https://example.com/cube.img');

        expect(Array.from(new Uint8Array(await source.read({ start: 0, end: 4 })))).toEqual([1, 2, 3, 4]);
        expect(Array.from(new Uint8Array(await source.read({ start: 0, end: 4 })))).toEqual([1, 2, 3, 4]);
        expect(Array.from(new Uint8Array(await source.readAll()))).toEqual([1, 2, 3, 4]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][1]).toEqual({
            method: 'GET',
            headers: undefined,
        });
    });

    it('serializes and recreates local and remote data sources', async () => {
        const blobSource = createBlobDataSource(new File([new Uint8Array([1, 2, 3])], 'cube.img'));
        const blobCopy = createDataSourceFromDescriptor(serializeDataSource(blobSource));

        expect(Array.from(new Uint8Array(await blobCopy.read({ start: 0, end: 3 })))).toEqual([1, 2, 3]);

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(null, {
                status: 200,
                headers: {
                    'content-length': '4',
                },
            }))
            .mockResolvedValueOnce(new Response(new Uint8Array([9, 8]), {
                status: 206,
                headers: {
                    'content-range': 'bytes 0-1/4',
                },
            }));

        vi.stubGlobal('fetch', fetchMock);

        const httpSource = createHttpRangeDataSource('https://example.com/cube.img', {
            headers: {
                Authorization: 'Bearer token',
            },
        });
        expect(await httpSource.size()).toBe(4);

        const descriptor = serializeDataSource(httpSource);
        const httpCopy = createDataSourceFromDescriptor(descriptor);

        expect(Array.from(new Uint8Array(await httpCopy.read({ start: 0, end: 2 })))).toEqual([9, 8]);
        expect(descriptor.size).toBe(4);
        expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token');
        expect(fetchMock.mock.calls[1][1].headers.Range).toBe('bytes=0-1');
    });
});
