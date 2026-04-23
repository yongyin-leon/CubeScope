/**
 * @fileoverview Internal execution helper for tile/stats/preload worker dispatch flows.
 */

import { ProgressType } from '../protocol/worker-protocol.js';
import {
    buildStatsWorkerRequest,
    buildTileWorkerRequest,
} from './worker-dispatch-policy.js';

export class ViewerRuntimeWorkExecutor {
    #scheduler;
    #emitLog;
    #emitError;
    #emitProgress;
    #postTrackedWorkerRequest;
    #debugLog;

    constructor({
        scheduler,
        emitLog = () => {},
        emitError = () => {},
        emitProgress = () => {},
        postTrackedWorkerRequest = () => {},
        debugLog = () => {},
    } = {}) {
        this.#scheduler = scheduler;
        this.#emitLog = emitLog;
        this.#emitError = emitError;
        this.#emitProgress = emitProgress;
        this.#postTrackedWorkerRequest = postTrackedWorkerRequest;
        this.#debugLog = debugLog;
    }

    dispatchStatsCalculation({
        bands,
        isInitial = false,
        sourceId,
        hdrBytes,
        dataSource,
        header,
    }) {
        if (this.#scheduler.hasIdleWorker()) {
            const worker = this.#scheduler.takeIdleWorker();
            this.#postTrackedWorkerRequest(worker, buildStatsWorkerRequest({
                sourceId,
                hdrBytes,
                dataSource,
                bands,
                header,
                isInitial,
            }));
            return {
                dispatched: true,
                queued: false,
                errored: false,
            };
        }

        if (!isInitial) {
            this.#emitLog('No idle worker; task queued for background.');
            this.#scheduler.prependBackgroundStatsBands(bands);
            return {
                dispatched: false,
                queued: true,
                errored: false,
            };
        }

        this.#emitError('No available worker for initial stats task!');
        return {
            dispatched: false,
            queued: false,
            errored: true,
        };
    }

    startBackgroundStatsCalculation({
        enabled,
        header,
        hasBandStats,
    }) {
        if (!enabled) {
            this.#emitLog('后台统计功能已关闭。');
            return {
                started: false,
                pendingBands: [],
            };
        }

        const pendingBands = [];
        for (let band = 1; band <= header.bands; band += 1) {
            if (!hasBandStats(band)) {
                pendingBands.push(band);
            }
        }

        this.#scheduler.replaceBackgroundStatsQueue(pendingBands);
        if (!this.#scheduler.hasBackgroundStatsWork()) {
            this.#emitLog('所有波段统计值已在缓存中，无需后台计算。');
            return {
                started: false,
                pendingBands,
            };
        }

        this.#emitLog(`开始后台统计... 队列中有 ${this.#scheduler.getBackgroundStatsCount()} 个波段待处理。`);
        return {
            started: true,
            pendingBands,
        };
    }

    processBackgroundStatsQueue({
        isTransitioning,
        sourceId,
        hdrBytes,
        dataSource,
        header,
    }) {
        if (isTransitioning) {
            return { dispatched: false };
        }

        if (!(this.#scheduler.hasIdleWorker() && this.#scheduler.hasBackgroundStatsWork())) {
            return { dispatched: false };
        }

        const worker = this.#scheduler.takeIdleWorker();
        const nextBand = this.#scheduler.takeNextBackgroundStatsBand();
        if (!worker || !nextBand) {
            return { dispatched: false };
        }

        this.#emitProgress({
            type: ProgressType.STATS_CALCULATION,
            processed: nextBand.processed,
            total: nextBand.total,
            progress: nextBand.progressPercent,
        });
        this.#postTrackedWorkerRequest(worker, buildStatsWorkerRequest({
            sourceId,
            hdrBytes,
            dataSource,
            bands: [nextBand.band],
            header,
            isInitial: false,
        }));

        return {
            dispatched: true,
            nextBand,
        };
    }

    processTileRequestQueue({
        isTransitioning,
        sourceId,
        hdrBytes,
        dataSource,
        header,
        currentBands,
        globalStats,
    }) {
        if (isTransitioning) {
            return { dispatched: 0 };
        }

        let dispatched = 0;
        while (this.#scheduler.hasIdleWorker() && this.#scheduler.hasTileRequests()) {
            const nextTile = this.#scheduler.takeNextTileRequest();
            const worker = this.#scheduler.takeIdleWorker();
            if (!nextTile || !worker || !nextTile.tile) {
                continue;
            }

            const { tile } = nextTile;
            const bandsPayload = [currentBands.r, currentBands.g, currentBands.b];
            this.#debugLog(`[主线程-1-发送任务] tile: (${tile.x}, ${tile.y}), bands:`, bandsPayload);
            this.#postTrackedWorkerRequest(worker, buildTileWorkerRequest({
                sourceId,
                hdrBytes,
                dataSource,
                tile,
                bands: bandsPayload,
                globalStats,
                header,
                phase: 'visible',
            }));
            dispatched += 1;
        }

        return { dispatched };
    }

    startPreloading({
        enabled,
        isPreloading,
        header,
        globalStats,
        tileSize,
        visibleTiles,
        hasActiveTile,
        buildPreloadEntries,
    }) {
        if (!enabled) {
            this.#emitLog('Tile preloading is disabled.');
            return {
                started: false,
                preloadEntries: [],
            };
        }

        if (isPreloading || !header || !globalStats) {
            return {
                started: false,
                preloadEntries: [],
            };
        }

        const preloadEntries = buildPreloadEntries({
            header,
            visibleTiles,
            tileSize,
            hasActiveTile,
        });
        this.#scheduler.startPreloading(preloadEntries);
        this.#emitLog(`Starting smart preloading: ${this.#scheduler.getPreloadCount()} tiles queued for background loading.`);
        return {
            started: true,
            preloadEntries,
        };
    }

    processPreloadQueue({
        isTransitioning,
        sourceId,
        hdrBytes,
        dataSource,
        header,
        currentBands,
        globalStats,
        markActiveTilePending,
        removeCurrentTile,
    }) {
        if (!this.#scheduler.isPreloading() || isTransitioning) {
            return { dispatched: 0 };
        }

        let dispatched = 0;
        while (this.#scheduler.hasIdleWorker() && this.#scheduler.hasPreloadEntries() && !this.#scheduler.hasTileRequests()) {
            const nextEntry = this.#scheduler.takeNextPreloadEntry();
            if (!nextEntry?.tile) {
                continue;
            }

            const { tile } = nextEntry;
            const tileKey = `${tile.x},${tile.y}`;
            if (!markActiveTilePending(tileKey)) {
                continue;
            }

            const worker = this.#scheduler.takeIdleWorker();
            if (!worker) {
                removeCurrentTile(tileKey);
                this.#scheduler.enqueueTileRequest(tileKey, tile);
                break;
            }

            const bandsPayload = [currentBands.r, currentBands.g, currentBands.b];
            this.#debugLog(`[主线程-1-发送任务] (预加载) tile: (${tile.x}, ${tile.y}), bands:`, bandsPayload);
            this.#postTrackedWorkerRequest(worker, buildTileWorkerRequest({
                sourceId,
                hdrBytes,
                dataSource,
                tile,
                bands: bandsPayload,
                globalStats,
                header,
                phase: 'preload',
            }));
            dispatched += 1;
        }

        if (!this.#scheduler.hasPreloadEntries() && this.#scheduler.isPreloading()) {
            this.#scheduler.stopPreloading();
            this.#emitLog('All tile preloads completed.');
        }

        return { dispatched };
    }
}
