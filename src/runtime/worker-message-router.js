/**
 * @fileoverview Internal helpers for normalizing and classifying worker runtime messages.
 */

import { WorkerResponse } from '../protocol/worker-protocol.js';
import { isStaleSourceMessage } from './request-tracker.js';

function toTileKey(tile) {
    if (!tile || !Number.isFinite(tile.x) || !Number.isFinite(tile.y)) {
        return null;
    }

    return `${tile.x},${tile.y}`;
}

function normalizeBandTriplet(bands = []) {
    if (!Array.isArray(bands) || bands.length < 3) {
        return null;
    }

    return {
        r: parseInt(bands[0], 10),
        g: parseInt(bands[1], 10),
        b: parseInt(bands[2], 10),
    };
}

export function normalizeWorkerRuntimeMessage(event) {
    const data = event?.data ?? {};

    return Object.freeze({
        worker: event?.target ?? null,
        type: data.type ?? WorkerResponse.ERROR,
        sourceId: data.sourceId ?? 0,
        requestId: data.requestId,
        payload: data.payload ?? {},
        error: data.error,
        message: data.message,
    });
}

export function classifyWorkerRuntimeMessage(message, { activeSourceId, currentBands }) {
    if (isStaleSourceMessage(activeSourceId, message.sourceId)) {
        return Object.freeze({ kind: 'stale-source' });
    }

    switch (message.type) {
        case WorkerResponse.CANCELED:
            return Object.freeze({ kind: 'canceled' });
        case WorkerResponse.STATS_COMPLETE:
            return Object.freeze({
                kind: 'stats-complete',
                stats: message.payload?.stats ?? {},
                bands: Array.isArray(message.payload?.bands) ? message.payload.bands : [],
                isInitial: message.payload?.isInitial === true,
            });
        case WorkerResponse.TILE_COMPLETE: {
            if (!Array.isArray(message.payload?.bands)) {
                return Object.freeze({
                    kind: 'tile-complete-malformed',
                    detail: JSON.stringify(message.payload),
                });
            }

            const requestedBands = normalizeBandTriplet(message.payload.bands);
            if (!requestedBands) {
                return Object.freeze({
                    kind: 'tile-complete-malformed',
                    detail: JSON.stringify(message.payload),
                });
            }

            if (
                requestedBands.r !== currentBands.r
                || requestedBands.g !== currentBands.g
                || requestedBands.b !== currentBands.b
            ) {
                return Object.freeze({
                    kind: 'tile-complete-stale-bands',
                    requestedBands,
                    requestedBandsText: message.payload.bands.join(','),
                });
            }

            const tileKey = toTileKey(message.payload?.tile);
            if (!tileKey) {
                return Object.freeze({
                    kind: 'tile-complete-malformed',
                    detail: JSON.stringify(message.payload),
                });
            }

            return Object.freeze({
                kind: 'tile-complete',
                tileKey,
            });
        }
        case WorkerResponse.SPECTRUM_COMPLETE:
            return Object.freeze({
                kind: 'spectrum-complete',
                spectrum: message.payload?.spectrum ?? null,
            });
        case WorkerResponse.SPECTRUM_ERROR:
            return Object.freeze({
                kind: 'spectrum-error',
                message: message.error?.message ?? message.payload?.message ?? null,
            });
        case WorkerResponse.TILE_ERROR:
            return Object.freeze({
                kind: 'tile-error',
                tile: message.payload?.tile ?? null,
                tileKey: toTileKey(message.payload?.tile),
                message: message.payload?.message ?? null,
            });
        case WorkerResponse.ERROR:
            return Object.freeze({
                kind: 'error',
                message: message.error?.message ?? message.payload?.message ?? message.message ?? 'Unknown worker error',
            });
        default:
            return Object.freeze({
                kind: 'unknown',
                message: `Unknown worker response: ${String(message.type)}`,
            });
    }
}
