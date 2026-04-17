import { describe, expect, it } from 'vitest';

import { ProgressType, WorkerCommand, WorkerResponse, createWorkerMessage } from '../../src/lib/protocol.js';

describe('worker protocol contracts', () => {
    it('freezes the stable worker command set', () => {
        expect(WorkerCommand).toEqual({
            INIT: 'init',
            CALCULATE_STATS: 'calculate_stats',
            LOAD_TILE: 'load_tile',
            GET_SPECTRUM: 'get_spectrum',
        });
    });

    it('freezes the stable worker response set', () => {
        expect(WorkerResponse).toEqual({
            INIT_COMPLETE: 'init_complete',
            ERROR: 'error',
            STATS_COMPLETE: 'stats_complete',
            TILE_COMPLETE: 'tile_complete',
            TILE_ERROR: 'tile_error',
            SPECTRUM_COMPLETE: 'spectrum_complete',
            SPECTRUM_ERROR: 'spectrum_error',
        });
    });

    it('creates stable protocol envelopes', () => {
        expect(createWorkerMessage(WorkerCommand.LOAD_TILE, {
            sourceId: 3,
            tile: { x: 0, y: 0 },
        })).toEqual({
            type: WorkerCommand.LOAD_TILE,
            payload: {
                sourceId: 3,
                tile: { x: 0, y: 0 },
            },
        });
        expect(ProgressType.STATS_CALCULATION).toBe('stats_calculation');
    });
});
