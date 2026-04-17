/**
 * @fileoverview Shared message contracts for the CubeScope worker runtime.
 */

export const WorkerCommand = Object.freeze({
    INIT: 'init',
    CALCULATE_STATS: 'calculate_stats',
    LOAD_TILE: 'load_tile',
    GET_SPECTRUM: 'get_spectrum'
});

export const WorkerResponse = Object.freeze({
    INIT_COMPLETE: 'init_complete',
    ERROR: 'error',
    STATS_COMPLETE: 'stats_complete',
    TILE_COMPLETE: 'tile_complete',
    TILE_ERROR: 'tile_error',
    SPECTRUM_COMPLETE: 'spectrum_complete',
    SPECTRUM_ERROR: 'spectrum_error'
});

export const ProgressType = Object.freeze({
    STATS_CALCULATION: 'stats_calculation'
});

export function createWorkerMessage(type, payload = {}) {
    return { type, payload };
}
