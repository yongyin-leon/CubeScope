import { describe, expect, it } from 'vitest';

import { WorkScheduler } from '../../src/runtime/work-scheduler.js';

describe('WorkScheduler', () => {
    it('tracks idle workers as a simple LIFO pool', () => {
        const scheduler = new WorkScheduler();
        const workerA = { id: 'a' };
        const workerB = { id: 'b' };

        scheduler.registerIdleWorker(workerA);
        scheduler.registerIdleWorker(workerA);
        scheduler.registerIdleWorker(workerB);

        expect(scheduler.getIdleWorkerCount()).toBe(2);
        expect(scheduler.takeIdleWorker()).toBe(workerB);
        expect(scheduler.takeIdleWorker()).toBe(workerA);
        expect(scheduler.takeIdleWorker()).toBeNull();
    });

    it('removes a failed idle worker without disturbing the remaining pool', () => {
        const scheduler = new WorkScheduler();
        const workerA = { id: 'a' };
        const workerB = { id: 'b' };

        scheduler.registerIdleWorker(workerA);
        scheduler.registerIdleWorker(workerB);

        expect(scheduler.removeWorker(workerA)).toBe(1);
        expect(scheduler.getIdleWorkerCount()).toBe(1);
        expect(scheduler.takeIdleWorker()).toBe(workerB);
        expect(scheduler.removeWorker(workerA)).toBe(0);
    });

    it('reports progress while draining background stats bands', () => {
        const scheduler = new WorkScheduler();
        scheduler.replaceBackgroundStatsQueue([7, 9, 11]);
        scheduler.prependBackgroundStatsBands([5, 7]);

        expect(scheduler.getBackgroundStatsCount()).toBe(4);

        const first = scheduler.takeNextBackgroundStatsBand();
        const second = scheduler.takeNextBackgroundStatsBand();

        expect(first).toEqual({
            band: 5,
            total: 3,
            remaining: 3,
            processed: 0,
            progressPercent: 0,
        });
        expect(second).toMatchObject({
            band: 7,
            total: 3,
            remaining: 2,
            processed: 1,
        });
        expect(second.progressPercent).toBeCloseTo(100 / 3);
    });

    it('resets source-scoped tile, stats, and preload queues without dropping workers', () => {
        const scheduler = new WorkScheduler();
        scheduler.registerIdleWorker({ id: 'worker-1' });
        scheduler.enqueueTileRequest('0,0', { x: 0, y: 0 });
        scheduler.replaceBackgroundStatsQueue([1, 2]);
        scheduler.startWaitingForStats();
        scheduler.startPreloading([{ tile: { x: 1, y: 1 }, dist: 1 }]);

        scheduler.resetSourceWorkState();

        expect(scheduler.getIdleWorkerCount()).toBe(1);
        expect(scheduler.hasTileRequests()).toBe(false);
        expect(scheduler.hasBackgroundStatsWork()).toBe(false);
        expect(scheduler.isWaitingForStats()).toBe(false);
        expect(scheduler.isPreloading()).toBe(false);
        expect(scheduler.hasPreloadEntries()).toBe(false);
    });
});
