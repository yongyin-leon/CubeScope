import { describe, expect, it } from 'vitest';

import { WorkerCommand } from '../../src/protocol/worker-protocol.js';
import { ViewerRuntimeTransitionController } from '../../src/runtime/runtime-transition-controller.js';

describe('ViewerRuntimeTransitionController', () => {
    it('plans band changes and skips no-op updates', () => {
        const controller = new ViewerRuntimeTransitionController();

        expect(controller.planBandSelectionChange({
            currentBands: { r: 30, g: 20, b: 10 },
            requestedBands: { r: 30, g: 20, b: 10 },
            resolveBandStatsPlan: () => ({
                ready: true,
                missingBands: [],
                globalStats: {},
            }),
        })).toEqual({
            changed: false,
            nextBands: { r: 30, g: 20, b: 10 },
            plan: null,
        });

        expect(controller.planBandSelectionChange({
            currentBands: { r: 30, g: 20, b: 10 },
            requestedBands: { r: '31', g: '21', b: '11' },
            resolveBandStatsPlan: ({ bands }) => ({
                ready: false,
                missingBands: bands,
                globalStats: null,
            }),
        })).toEqual({
            changed: true,
            nextBands: { r: 31, g: 21, b: 11 },
            plan: {
                ready: false,
                missingBands: [31, 21, 11],
                globalStats: null,
            },
        });
    });

    it('starts transitions by dispatching visible tiles and queueing overflow work', () => {
        const stateChanges = [];
        const dispatched = [];
        const queued = [];
        let stoppedPreloading = 0;
        let drawRequests = 0;
        let transitionCounter = 0;
        const renderSession = {
            beginTransition: () => true,
            setTransitionTileCount: (count) => {
                transitionCounter = count;
            },
            consumeTransitionTile: () => {
                transitionCounter -= 1;
                return transitionCounter;
            },
            cancelTransition: () => {},
        };
        const workers = [{ id: 'worker-a' }];
        const controller = new ViewerRuntimeTransitionController({
            emitStateChange: (payload) => stateChanges.push(payload),
            postTrackedWorkerRequest: (worker, request) => dispatched.push({ worker, request }),
            debugLog: () => {},
        });

        const result = controller.startTransition({
            renderSession,
            renderer: { clearSlot: () => {} },
            sourceId: 7,
            getVisibleTiles: () => [{ x: 0, y: 0 }, { x: 1, y: 0 }],
            takeIdleWorker: () => workers.pop() ?? null,
            enqueueTileRequest: (tileKey, tile) => queued.push({ tileKey, tile }),
            stopPreloading: () => {
                stoppedPreloading += 1;
            },
            requestDraw: () => {
                drawRequests += 1;
            },
            hdrBytes: new Uint8Array([1, 2, 3]),
            dataSource: { kind: 'file', name: 'cube.img' },
            currentBands: { r: 30, g: 20, b: 10 },
            globalStats: { 10: { min: 1, max: 2 } },
            header: { bands: 32 },
        });

        expect(result).toEqual({
            started: true,
            visibleTileCount: 2,
        });
        expect(stateChanges).toEqual([{ loading: true, message: 'Switching bands...' }]);
        expect(dispatched).toHaveLength(1);
        expect(dispatched[0].request.envelope.type).toBe(WorkerCommand.LOAD_TILE);
        expect(dispatched[0].request.requestId).toContain(':transition:');
        expect(queued).toEqual([{ tileKey: '1,0', tile: { x: 1, y: 0 } }]);
        expect(stoppedPreloading).toBe(1);
        expect(drawRequests).toBe(0);
    });

    it('finalizes transition frames by swapping slots, redrawing, and restoring opacity', () => {
        const stateChanges = [];
        const scheduled = [];
        let draws = 0;
        let completed = 0;
        const canvas = { style: { opacity: '1' } };
        const controller = new ViewerRuntimeTransitionController({
            emitStateChange: (payload) => stateChanges.push(payload),
            requestAnimationFrameImpl: (callback) => {
                scheduled.push('raf');
                callback();
            },
            setTimeoutImpl: (callback, delay) => {
                scheduled.push(`timeout:${delay}`);
                callback();
            },
        });

        controller.finalizeTransitionFrame({
            canvas,
            renderSession: {
                completeTransition: () => {
                    completed += 1;
                },
            },
            renderer: { swapSlot: () => {} },
            sourceId: 9,
            requestDraw: () => {
                draws += 1;
            },
        });

        expect(completed).toBe(1);
        expect(draws).toBe(1);
        expect(stateChanges).toEqual([{ loading: false }]);
        expect(canvas.style.opacity).toBe('1');
        expect(scheduled).toEqual(['timeout:200', 'raf', 'timeout:20']);
    });
});
