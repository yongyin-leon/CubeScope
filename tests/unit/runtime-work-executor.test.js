import { describe, expect, it } from 'vitest';

import { WorkerCommand, ProgressType } from '../../src/protocol/worker-protocol.js';
import { ViewerRuntimeWorkExecutor } from '../../src/runtime/runtime-work-executor.js';
import { WorkScheduler } from '../../src/runtime/work-scheduler.js';

function createExecutorHarness() {
    const scheduler = new WorkScheduler();
    const logs = [];
    const errors = [];
    const progressEvents = [];
    const dispatched = [];
    const executor = new ViewerRuntimeWorkExecutor({
        scheduler,
        emitLog: (message) => logs.push(message),
        emitError: (message) => errors.push(message),
        emitProgress: (payload) => progressEvents.push(payload),
        postTrackedWorkerRequest: (worker, request) => dispatched.push({ worker, request }),
        debugLog: () => {},
    });

    return {
        scheduler,
        logs,
        errors,
        progressEvents,
        dispatched,
        executor,
    };
}

function createRuntimeContext(overrides = {}) {
    return {
        sourceId: 7,
        hdrBytes: new Uint8Array([1, 2, 3]),
        dataSource: { kind: 'file', name: 'cube.img' },
        header: {
            bands: 4,
            samples: 512,
            lines: 512,
        },
        currentBands: { r: 30, g: 20, b: 10 },
        globalStats: { 10: { min: 1, max: 2 } },
        ...overrides,
    };
}

describe('ViewerRuntimeWorkExecutor', () => {
    it('dispatches initial stats work when an idle worker is available', () => {
        const harness = createExecutorHarness();
        const worker = { id: 'worker-a' };
        harness.scheduler.registerIdleWorker(worker);

        const result = harness.executor.dispatchStatsCalculation({
            ...createRuntimeContext(),
            bands: [10, 20, 30],
            isInitial: true,
        });

        expect(result).toEqual({
            dispatched: true,
            queued: false,
            errored: false,
        });
        expect(harness.dispatched).toHaveLength(1);
        expect(harness.dispatched[0].worker).toBe(worker);
        expect(harness.dispatched[0].request.envelope.type).toBe(WorkerCommand.CALCULATE_STATS);
        expect(harness.dispatched[0].request.envelope.payload.bands).toEqual([10, 20, 30]);
        expect(harness.dispatched[0].request.envelope.payload.isInitial).toBe(true);
    });

    it('queues non-initial stats work when no worker is idle', () => {
        const harness = createExecutorHarness();

        const result = harness.executor.dispatchStatsCalculation({
            ...createRuntimeContext(),
            bands: [11, 12],
            isInitial: false,
        });

        expect(result).toEqual({
            dispatched: false,
            queued: true,
            errored: false,
        });
        expect(harness.logs).toContain('No idle worker; task queued for background.');
        expect(harness.scheduler.takeNextBackgroundStatsBand()).toMatchObject({
            band: 12,
        });
    });

    it('starts background stats only for uncached bands', () => {
        const harness = createExecutorHarness();

        const result = harness.executor.startBackgroundStatsCalculation({
            enabled: true,
            header: { bands: 4 },
            hasBandStats: (band) => band === 2 || band === 4,
        });

        expect(result).toEqual({
            started: true,
            pendingBands: [1, 3],
        });
        expect(harness.logs).toContain('开始后台统计... 队列中有 2 个波段待处理。');
    });

    it('emits progress and dispatches background stats work', () => {
        const harness = createExecutorHarness();
        harness.scheduler.replaceBackgroundStatsQueue([7]);
        harness.scheduler.registerIdleWorker({ id: 'worker-b' });

        const result = harness.executor.processBackgroundStatsQueue({
            ...createRuntimeContext(),
            isTransitioning: false,
        });

        expect(result).toMatchObject({
            dispatched: true,
            nextBand: { band: 7 },
        });
        expect(harness.progressEvents).toEqual([{
            type: ProgressType.STATS_CALCULATION,
            processed: 1,
            total: 1,
            progress: 100,
        }]);
        expect(harness.dispatched[0].request.envelope.payload.bands).toEqual([7]);
    });

    it('dispatches queued visible tiles through worker requests', () => {
        const harness = createExecutorHarness();
        harness.scheduler.registerIdleWorker({ id: 'worker-c' });
        harness.scheduler.enqueueTileRequest('0,0', { x: 0, y: 0 });

        const result = harness.executor.processTileRequestQueue({
            ...createRuntimeContext(),
            isTransitioning: false,
        });

        expect(result).toEqual({ dispatched: 1 });
        expect(harness.dispatched).toHaveLength(1);
        expect(harness.dispatched[0].request.envelope.type).toBe(WorkerCommand.LOAD_TILE);
        expect(harness.dispatched[0].request.requestId).toContain(':visible:');
        expect(harness.dispatched[0].request.envelope.payload.tile).toEqual({ x: 0, y: 0 });
    });

    it('plans and dispatches preloads, then stops when the queue is drained', () => {
        const harness = createExecutorHarness();
        harness.scheduler.registerIdleWorker({ id: 'worker-d' });

        const startResult = harness.executor.startPreloading({
            enabled: true,
            isPreloading: false,
            header: { samples: 1024, lines: 1024 },
            globalStats: { 10: { min: 1, max: 2 } },
            tileSize: 512,
            visibleTiles: [{ x: 0, y: 0 }],
            hasActiveTile: () => false,
            buildPreloadEntries: () => [{ tile: { x: 1, y: 0 }, dist: 1 }],
        });

        const marked = [];
        const removed = [];
        const drainResult = harness.executor.processPreloadQueue({
            ...createRuntimeContext(),
            isTransitioning: false,
            markActiveTilePending: (tileKey) => {
                marked.push(tileKey);
                return true;
            },
            removeCurrentTile: (tileKey) => removed.push(tileKey),
        });

        expect(startResult).toEqual({
            started: true,
            preloadEntries: [{ tile: { x: 1, y: 0 }, dist: 1 }],
        });
        expect(drainResult).toEqual({ dispatched: 1 });
        expect(marked).toEqual(['1,0']);
        expect(removed).toEqual([]);
        expect(harness.dispatched[0].request.requestId).toContain(':preload:');
        expect(harness.logs).toContain('Starting smart preloading: 1 tiles queued for background loading.');
        expect(harness.logs).toContain('All tile preloads completed.');
        expect(harness.scheduler.isPreloading()).toBe(false);
    });
});
