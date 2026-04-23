/**
 * @fileoverview Internal scheduler-state holder for workers and source-scoped work queues.
 */

export class WorkScheduler {
    #idleWorkers = [];
    #tileRequestQueue = new Map();
    #backgroundStatsQueue = [];
    #totalBandsForStats = 0;
    #isWaitingForStats = false;
    #preloadQueue = [];
    #isPreloading = false;

    registerIdleWorker(worker) {
        this.#idleWorkers.push(worker);
    }

    takeIdleWorker() {
        return this.#idleWorkers.pop() ?? null;
    }

    hasIdleWorker() {
        return this.#idleWorkers.length > 0;
    }

    getIdleWorkerCount() {
        return this.#idleWorkers.length;
    }

    resetWorkers() {
        this.#idleWorkers = [];
    }

    startWaitingForStats() {
        this.#isWaitingForStats = true;
    }

    stopWaitingForStats() {
        this.#isWaitingForStats = false;
    }

    isWaitingForStats() {
        return this.#isWaitingForStats;
    }

    replaceBackgroundStatsQueue(bands) {
        this.#backgroundStatsQueue = Array.from(bands);
        this.#totalBandsForStats = this.#backgroundStatsQueue.length;
    }

    prependBackgroundStatsBands(bands) {
        for (const band of bands) {
            if (!this.#backgroundStatsQueue.includes(band)) {
                this.#backgroundStatsQueue.unshift(band);
            }
        }
    }

    hasBackgroundStatsWork() {
        return this.#backgroundStatsQueue.length > 0;
    }

    getBackgroundStatsCount() {
        return this.#backgroundStatsQueue.length;
    }

    takeNextBackgroundStatsBand() {
        if (this.#backgroundStatsQueue.length === 0) {
            return null;
        }

        const band = this.#backgroundStatsQueue.shift();
        const remaining = this.#backgroundStatsQueue.length;
        const total = this.#totalBandsForStats;
        const processed = total - remaining;
        const progressPercent = total > 0 ? (processed / total) * 100 : 0;

        return {
            band,
            total,
            remaining,
            processed,
            progressPercent,
        };
    }

    clearBackgroundStatsQueue() {
        this.#backgroundStatsQueue = [];
        this.#totalBandsForStats = 0;
        this.#isWaitingForStats = false;
    }

    enqueueTileRequest(tileKey, tile) {
        this.#tileRequestQueue.set(tileKey, { tile });
    }

    takeNextTileRequest() {
        const tileKey = this.#tileRequestQueue.keys().next().value;
        if (tileKey === undefined) {
            return null;
        }

        const entry = this.#tileRequestQueue.get(tileKey) ?? null;
        this.#tileRequestQueue.delete(tileKey);
        return {
            tileKey,
            tile: entry?.tile ?? null,
        };
    }

    hasTileRequests() {
        return this.#tileRequestQueue.size > 0;
    }

    getTileRequestCount() {
        return this.#tileRequestQueue.size;
    }

    clearTileRequests() {
        this.#tileRequestQueue.clear();
    }

    startPreloading(entries = []) {
        this.#isPreloading = true;
        this.#preloadQueue = Array.from(entries);
    }

    isPreloading() {
        return this.#isPreloading;
    }

    stopPreloading() {
        this.#isPreloading = false;
        this.#preloadQueue = [];
    }

    hasPreloadEntries() {
        return this.#preloadQueue.length > 0;
    }

    getPreloadCount() {
        return this.#preloadQueue.length;
    }

    takeNextPreloadEntry() {
        return this.#preloadQueue.shift() ?? null;
    }

    resetSourceWorkState() {
        this.clearTileRequests();
        this.clearBackgroundStatsQueue();
        this.stopPreloading();
    }
}
