/**
 * @fileoverview Shared message contracts for the CubeScope worker runtime.
 */

export const WorkerCommand = Object.freeze({
    INIT: 'init',
    CANCEL: 'cancel',
    CALCULATE_STATS: 'calculate_stats',
    LOAD_TILE: 'load_tile',
    GET_SPECTRUM: 'get_spectrum'
});

export const WorkerResponse = Object.freeze({
    INIT_COMPLETE: 'init_complete',
    CANCELED: 'canceled',
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

function createWorkerEnvelope(type, {
    sourceId = 0,
    requestId,
    payload = {},
    error,
} = {}) {
    const envelope = {
        type,
        sourceId,
        payload,
    };

    if (requestId !== undefined) {
        envelope.requestId = requestId;
    }

    if (error) {
        envelope.error = error;
    }

    return envelope;
}

export function createWorkerRequest(type, options = {}) {
    return createWorkerEnvelope(type, options);
}

export function createWorkerResponse(type, options = {}) {
    return createWorkerEnvelope(type, options);
}

export function createWorkerError({
    sourceId = 0,
    requestId,
    message,
    payload = {},
} = {}) {
    return createWorkerResponse(WorkerResponse.ERROR, {
        sourceId,
        requestId,
        payload,
        error: {
            message: message ?? 'Unknown worker error.',
        },
    });
}

export function isWorkerEnvelope(value) {
    return Boolean(value)
        && typeof value.type === 'string'
        && typeof value.sourceId === 'number'
        && Object.prototype.hasOwnProperty.call(value, 'payload');
}

export function createWorkerMessage(type, payload = {}) {
    const {
        sourceId = 0,
        requestId,
        ...restPayload
    } = payload ?? {};

    return createWorkerRequest(type, {
        sourceId,
        requestId,
        payload: restPayload,
    });
}
