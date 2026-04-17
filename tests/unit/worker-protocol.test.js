import { describe, expect, it } from 'vitest';

import {
    ProgressType,
    WorkerCommand,
    WorkerResponse,
    createWorkerError,
    createWorkerMessage,
    createWorkerRequest,
    createWorkerResponse,
    isWorkerEnvelope,
} from '../../src/protocol/worker-protocol.js';

describe('worker protocol contracts', () => {
    it('freezes the stable worker command set', () => {
        expect(WorkerCommand).toEqual({
            INIT: 'init',
            CANCEL: 'cancel',
            CALCULATE_STATS: 'calculate_stats',
            LOAD_TILE: 'load_tile',
            GET_SPECTRUM: 'get_spectrum',
        });
    });

    it('freezes the stable worker response set', () => {
        expect(WorkerResponse).toEqual({
            INIT_COMPLETE: 'init_complete',
            CANCELED: 'canceled',
            ERROR: 'error',
            STATS_COMPLETE: 'stats_complete',
            TILE_COMPLETE: 'tile_complete',
            TILE_ERROR: 'tile_error',
            SPECTRUM_COMPLETE: 'spectrum_complete',
            SPECTRUM_ERROR: 'spectrum_error',
        });
    });

    it('creates stable request envelopes with first-class sourceId and requestId fields', () => {
        const envelope = createWorkerRequest(WorkerCommand.LOAD_TILE, {
            sourceId: 3,
            requestId: 'tile:3:0,0',
            payload: {
                tile: { x: 0, y: 0 },
            },
        });

        expect(envelope).toEqual({
            type: WorkerCommand.LOAD_TILE,
            sourceId: 3,
            requestId: 'tile:3:0,0',
            payload: {
                tile: { x: 0, y: 0 },
            },
        });
        expect(isWorkerEnvelope(envelope)).toBe(true);
    });

    it('creates stable response envelopes and normalized error envelopes', () => {
        expect(createWorkerResponse(WorkerResponse.TILE_COMPLETE, {
            sourceId: 3,
            requestId: 'tile:3:0,0',
            payload: {
                tile: { x: 0, y: 0 },
                bands: [1, 2, 3],
            },
        })).toEqual({
            type: WorkerResponse.TILE_COMPLETE,
            sourceId: 3,
            requestId: 'tile:3:0,0',
            payload: {
                tile: { x: 0, y: 0 },
                bands: [1, 2, 3],
            },
        });

        expect(createWorkerError({
            sourceId: 3,
            requestId: 'tile:3:0,0',
            message: 'boom',
        })).toEqual({
            type: WorkerResponse.ERROR,
            sourceId: 3,
            requestId: 'tile:3:0,0',
            payload: {},
            error: {
                message: 'boom',
            },
        });
    });

    it('keeps createWorkerMessage as a compatibility alias while hoisting source fields', () => {
        expect(createWorkerMessage(WorkerCommand.LOAD_TILE, {
            sourceId: 3,
            requestId: 'tile:3:0,0',
            tile: { x: 0, y: 0 },
        })).toEqual({
            type: WorkerCommand.LOAD_TILE,
            sourceId: 3,
            requestId: 'tile:3:0,0',
            payload: {
                tile: { x: 0, y: 0 },
            },
        });
        expect(ProgressType.STATS_CALCULATION).toBe('stats_calculation');
    });
});
