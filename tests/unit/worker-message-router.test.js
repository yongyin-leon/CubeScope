import { describe, expect, it } from 'vitest';

import {
    WORKER_PROTOCOL_VERSION,
    WorkerResponse,
} from '../../src/protocol/worker-protocol.js';
import {
    classifyWorkerRuntimeMessage,
    normalizeWorkerRuntimeMessage,
} from '../../src/runtime/worker-message-router.js';

function normalize(data, worker = { id: 'worker-1' }) {
    return normalizeWorkerRuntimeMessage({
        data: {
            protocolVersion: WORKER_PROTOCOL_VERSION,
            ...data,
        },
        target: worker,
    });
}

describe('worker-message-router', () => {
    const currentBands = { r: 30, g: 20, b: 10 };

    it('classifies stale-source envelopes before response-specific handling', () => {
        const route = classifyWorkerRuntimeMessage(normalize({
            type: WorkerResponse.TILE_COMPLETE,
            sourceId: 2,
            payload: {
                tile: { x: 0, y: 0 },
                bands: [30, 20, 10],
            },
        }), {
            activeSourceId: 3,
            currentBands,
        });

        expect(route).toEqual({ kind: 'stale-source' });
    });

    it('classifies valid tile completions with a derived tile key', () => {
        const route = classifyWorkerRuntimeMessage(normalize({
            type: WorkerResponse.TILE_COMPLETE,
            sourceId: 3,
            payload: {
                tile: { x: 4, y: 5 },
                bands: [30, 20, 10],
            },
        }), {
            activeSourceId: 3,
            currentBands,
        });

        expect(route).toEqual({
            kind: 'tile-complete',
            tileKey: '4,5',
        });
    });

    it('rejects stale-band tile completions without treating them as malformed', () => {
        const route = classifyWorkerRuntimeMessage(normalize({
            type: WorkerResponse.TILE_COMPLETE,
            sourceId: 3,
            payload: {
                tile: { x: 4, y: 5 },
                bands: [31, 21, 11],
            },
        }), {
            activeSourceId: 3,
            currentBands,
        });

        expect(route).toEqual({
            kind: 'tile-complete-stale-bands',
            requestedBands: { r: 31, g: 21, b: 11 },
            requestedBandsText: '31,21,11',
        });
    });

    it('classifies missing tile metadata as a malformed tile completion', () => {
        const route = classifyWorkerRuntimeMessage(normalize({
            type: WorkerResponse.TILE_COMPLETE,
            sourceId: 3,
            payload: {
                bands: [30, 20, 10],
            },
        }), {
            activeSourceId: 3,
            currentBands,
        });

        expect(route.kind).toBe('tile-complete-malformed');
    });

    it('prefers error metadata when classifying worker error responses', () => {
        const route = classifyWorkerRuntimeMessage(normalize({
            type: WorkerResponse.ERROR,
            sourceId: 3,
            payload: { message: 'payload message' },
            error: { message: 'typed error message' },
        }), {
            activeSourceId: 3,
            currentBands,
        });

        expect(route).toEqual({
            kind: 'error',
            message: 'typed error message',
        });
    });

    it('rejects unsupported protocol versions before mutating runtime state', () => {
        const message = normalizeWorkerRuntimeMessage({
            data: {
                protocolVersion: WORKER_PROTOCOL_VERSION + 1,
                type: WorkerResponse.TILE_COMPLETE,
                sourceId: 3,
                payload: {
                    tile: { x: 0, y: 0 },
                    bands: [30, 20, 10],
                },
            },
            target: { id: 'worker-1' },
        });

        expect(classifyWorkerRuntimeMessage(message, {
            activeSourceId: 3,
            currentBands,
        })).toEqual({
            kind: 'error',
            message: `Unsupported worker protocol version: ${WORKER_PROTOCOL_VERSION + 1}. Expected ${WORKER_PROTOCOL_VERSION}.`,
        });
    });
});
