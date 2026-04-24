/**
 * @fileoverview Internal transition controller for band-switch and render-transition orchestration.
 */

import { buildTileWorkerRequest } from './worker-dispatch-policy.js';

function normalizeBands(requestedBands) {
    return {
        r: parseInt(requestedBands.r, 10),
        g: parseInt(requestedBands.g, 10),
        b: parseInt(requestedBands.b, 10),
    };
}

export class ViewerRuntimeTransitionController {
    #emitStateChange;
    #requestAnimationFrameImpl;
    #setTimeoutImpl;
    #postTrackedWorkerRequest;
    #debugLog;

    constructor({
        emitStateChange = () => {},
        requestAnimationFrameImpl = (callback) => requestAnimationFrame(callback),
        setTimeoutImpl = (callback, delay) => setTimeout(callback, delay),
        postTrackedWorkerRequest = () => {},
        debugLog = () => {},
    } = {}) {
        this.#emitStateChange = emitStateChange;
        this.#requestAnimationFrameImpl = requestAnimationFrameImpl;
        this.#setTimeoutImpl = setTimeoutImpl;
        this.#postTrackedWorkerRequest = postTrackedWorkerRequest;
        this.#debugLog = debugLog;
    }

    planBandSelectionChange({
        currentBands,
        requestedBands,
        resolveBandStatsPlan,
    }) {
        const nextBands = normalizeBands(requestedBands);

        if (
            nextBands.r === currentBands.r
            && nextBands.g === currentBands.g
            && nextBands.b === currentBands.b
        ) {
            return {
                changed: false,
                nextBands: currentBands,
                plan: null,
            };
        }

        const neededBands = [nextBands.r, nextBands.g, nextBands.b];
        return {
            changed: true,
            nextBands,
            plan: resolveBandStatsPlan({
                bands: neededBands,
            }),
        };
    }

    startTransition({
        renderSession,
        renderer,
        sourceId,
        getVisibleTiles,
        takeIdleWorker,
        enqueueTileRequest,
        stopPreloading,
        requestDraw,
        hdrBytes,
        dataSource,
        currentBands,
        globalStats,
        header,
    }) {
        if (!renderSession.beginTransition({
            renderer,
            sourceId,
        })) {
            return {
                started: false,
                visibleTileCount: 0,
            };
        }

        this.#emitStateChange({ loading: true, message: 'Switching bands...' });
        const visibleTiles = getVisibleTiles();
        renderSession.setTransitionTileCount(visibleTiles.length);

        if (visibleTiles.length === 0) {
            renderSession.cancelTransition();
            this.#requestAnimationFrameImpl(() => requestDraw());
            this.#emitStateChange({ loading: false });
            return {
                started: false,
                visibleTileCount: 0,
            };
        }

        for (const tile of visibleTiles) {
            const worker = takeIdleWorker();
            if (worker) {
                const bandsPayload = [currentBands.r, currentBands.g, currentBands.b];
                this.#debugLog(`[main-thread:transition-request] tile: (${tile.x}, ${tile.y}), bands:`, bandsPayload);
                this.#postTrackedWorkerRequest(worker, buildTileWorkerRequest({
                    sourceId,
                    hdrBytes,
                    dataSource,
                    tile,
                    bands: bandsPayload,
                    globalStats,
                    header,
                    phase: 'transition',
                }));
            } else {
                renderSession.consumeTransitionTile();
                enqueueTileRequest(`${tile.x},${tile.y}`, tile);
            }
        }

        stopPreloading();
        return {
            started: true,
            visibleTileCount: visibleTiles.length,
        };
    }

    finalizeTransitionFrame({
        canvas,
        renderSession,
        renderer,
        sourceId,
        requestDraw,
    }) {
        canvas.style.opacity = '0';
        this.#setTimeoutImpl(() => {
            renderSession.completeTransition({
                renderer,
                sourceId,
            });
            this.#requestAnimationFrameImpl(() => requestDraw());
            this.#emitStateChange({ loading: false });
            this.#setTimeoutImpl(() => {
                canvas.style.opacity = '1';
            }, 20);
        }, 200);
    }
}
