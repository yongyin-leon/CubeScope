import { describe, expect, it, vi } from 'vitest';

import {
    WORKER_PROTOCOL_VERSION,
    WorkerCommand,
} from '../../src/protocol/worker-protocol.js';
import {
    buildSpectrumWorkerRequest,
    buildStatsWorkerRequest,
    buildTileWorkerRequest,
    buildWorkerCancelRequest,
    buildWorkerInitRequest,
    createStatsRequestId,
    createTileRequestId,
} from '../../src/runtime/worker-dispatch-policy.js';

describe('worker-dispatch-policy', () => {
    it('builds deterministic stats and tile request ids from source-scoped inputs', () => {
        expect(createStatsRequestId({
            sourceId: 9,
            bands: [1, 2, 3],
            isInitial: true,
        })).toBe('stats:9:initial:1,2,3');

        expect(createTileRequestId({
            sourceId: 9,
            tile: { x: 4, y: 5 },
            bands: [30, 20, 10],
            phase: 'transition',
        })).toBe('tile:9:transition:4,5:30,20,10');
    });

    it('builds tracked tile envelopes with the expected payload shape', () => {
        const request = buildTileWorkerRequest({
            sourceId: 11,
            hdrBytes: new Uint8Array([1, 2]),
            dataSource: { kind: 'blob', name: 'cube.img' },
            tile: { x: 3, y: 7 },
            bands: [30, 20, 10],
            globalStats: { 10: { min: 1, max: 2 } },
            header: { samples: 48, lines: 48, bands: 32 },
            phase: 'preload',
        });

        expect(request.sourceId).toBe(11);
        expect(request.requestId).toBe('tile:11:preload:3,7:30,20,10');
        expect(request.envelope).toMatchObject({
            type: WorkerCommand.LOAD_TILE,
            sourceId: 11,
            requestId: 'tile:11:preload:3,7:30,20,10',
            payload: {
                tile: { x: 3, y: 7 },
                bands: [30, 20, 10],
            },
        });
    });

    it('uses the generated spectrum request id when one is not supplied', () => {
        const dateNow = vi.spyOn(Date, 'now').mockReturnValue(12345);
        const mathRandom = vi.spyOn(Math, 'random').mockReturnValue(0.25);

        const request = buildSpectrumWorkerRequest({
            sourceId: 4,
            hdrBytes: new Uint8Array([1]),
            dataSource: { kind: 'blob' },
            x: 8,
            y: 9,
            header: { samples: 48, lines: 48, bands: 32 },
        });

        expect(request.requestId).toBe('spec_12345_0.25');
        expect(request.envelope.type).toBe(WorkerCommand.GET_SPECTRUM);

        dateNow.mockRestore();
        mathRandom.mockRestore();
    });

    it('builds init and cancel envelopes without tracking metadata wrappers', () => {
        expect(buildWorkerInitRequest({
            wasmJsPath: 'file:///worker.js',
            wasmWasmPath: 'file:///worker.wasm',
        })).toEqual({
            protocolVersion: WORKER_PROTOCOL_VERSION,
            type: WorkerCommand.INIT,
            sourceId: 0,
            payload: {
                wasmJsPath: 'file:///worker.js',
                wasmWasmPath: 'file:///worker.wasm',
            },
        });

        expect(buildWorkerCancelRequest({
            sourceId: 8,
            requestId: 'tile:8:visible:0,0:30,20,10',
            reason: 'source-switch',
        })).toEqual({
            protocolVersion: WORKER_PROTOCOL_VERSION,
            type: WorkerCommand.CANCEL,
            sourceId: 8,
            requestId: 'tile:8:visible:0,0:30,20,10',
            payload: { reason: 'source-switch' },
        });
    });

    it('builds tracked stats envelopes with a derived request id', () => {
        const request = buildStatsWorkerRequest({
            sourceId: 6,
            hdrBytes: new Uint8Array([1, 2]),
            dataSource: { kind: 'blob' },
            bands: [12],
            header: { samples: 48, lines: 48, bands: 32 },
            isInitial: false,
        });

        expect(request.requestId).toBe('stats:6:background:12');
        expect(request.envelope.type).toBe(WorkerCommand.CALCULATE_STATS);
        expect(request.envelope.payload).toMatchObject({
            bands: [12],
            isInitial: false,
        });
    });
});
