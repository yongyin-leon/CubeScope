/**
 * @fileoverview Internal helpers for building outgoing worker requests and request ids.
 */

import { WorkerCommand, createWorkerRequest } from '../protocol/worker-protocol.js';

export function createSpectrumRequestId() {
    return `spec_${Date.now()}_${Math.random()}`;
}

export function createStatsRequestId({ sourceId, bands, isInitial = false }) {
    const bandKey = Array.isArray(bands) ? bands.join(',') : String(bands);
    const phase = isInitial ? 'initial' : 'background';
    return `stats:${sourceId}:${phase}:${bandKey}`;
}

export function createTileRequestId({ sourceId, tile, bands, phase = 'visible' }) {
    const bandKey = Array.isArray(bands) ? bands.join(',') : String(bands);
    return `tile:${sourceId}:${phase}:${tile.x},${tile.y}:${bandKey}`;
}

export function buildTrackedWorkerRequestEnvelope({ type, sourceId, requestId, payload }) {
    return {
        sourceId,
        requestId,
        envelope: createWorkerRequest(type, {
            sourceId,
            requestId,
            payload,
        }),
    };
}

export function buildWorkerInitRequest({ wasmJsPath, wasmWasmPath }) {
    return createWorkerRequest(WorkerCommand.INIT, {
        sourceId: 0,
        payload: {
            wasmJsPath,
            wasmWasmPath,
        },
    });
}

export function buildWorkerCancelRequest({ sourceId, requestId, reason }) {
    return createWorkerRequest(WorkerCommand.CANCEL, {
        sourceId,
        requestId,
        payload: { reason },
    });
}

export function buildSpectrumWorkerRequest({
    sourceId,
    hdrBytes,
    dataSource,
    x,
    y,
    header,
    requestId = createSpectrumRequestId(),
}) {
    return buildTrackedWorkerRequestEnvelope({
        type: WorkerCommand.GET_SPECTRUM,
        sourceId,
        requestId,
        payload: {
            hdrBytes,
            dataSource,
            x,
            y,
            header,
        },
    });
}

export function buildStatsWorkerRequest({
    sourceId,
    hdrBytes,
    dataSource,
    bands,
    header,
    isInitial = false,
    requestId = createStatsRequestId({ sourceId, bands, isInitial }),
}) {
    return buildTrackedWorkerRequestEnvelope({
        type: WorkerCommand.CALCULATE_STATS,
        sourceId,
        requestId,
        payload: {
            hdrBytes,
            dataSource,
            bands,
            header,
            isInitial,
        },
    });
}

export function buildTileWorkerRequest({
    sourceId,
    hdrBytes,
    dataSource,
    tile,
    bands,
    globalStats,
    header,
    phase = 'visible',
    requestId = createTileRequestId({ sourceId, tile, bands, phase }),
}) {
    return buildTrackedWorkerRequestEnvelope({
        type: WorkerCommand.LOAD_TILE,
        sourceId,
        requestId,
        payload: {
            hdrBytes,
            dataSource,
            tile,
            bands,
            globalStats,
            header,
        },
    });
}
