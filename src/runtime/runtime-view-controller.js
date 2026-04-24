/**
 * @fileoverview Internal view controller for resize, visible-tile calculation, and draw scheduling.
 */

import { createRendererInput } from '../rendering/renderer-contract.js';

export class ViewerRuntimeViewController {
    #emitLog;
    #requestAnimationFrameImpl;
    #setTimeoutImpl;
    #getDevicePixelRatio;

    constructor({
        emitLog = () => {},
        requestAnimationFrameImpl = (callback) => requestAnimationFrame(callback),
        setTimeoutImpl = (callback, delay) => setTimeout(callback, delay),
        getDevicePixelRatio = () => window.devicePixelRatio || 1,
    } = {}) {
        this.#emitLog = emitLog;
        this.#requestAnimationFrameImpl = requestAnimationFrameImpl;
        this.#setTimeoutImpl = setTimeoutImpl;
        this.#getDevicePixelRatio = getDevicePixelRatio;
    }

    resizeCanvas(canvas) {
        const dpr = this.#getDevicePixelRatio();
        const displayWidth = Math.round(canvas.clientWidth * dpr);
        const displayHeight = Math.round(canvas.clientHeight * dpr);

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            return true;
        }

        return false;
    }

    calculateVisibleTiles({ renderSession, header, canvas }) {
        return renderSession.calculateVisibleTiles({
            header,
            canvasWidth: canvas.clientWidth,
            canvasHeight: canvas.clientHeight,
        });
    }

    getAspectRatioCorrection({ renderSession, header, canvas }) {
        return renderSession.getAspectRatioCorrection({
            header,
            canvasWidth: canvas.clientWidth,
            canvasHeight: canvas.clientHeight,
        });
    }

    updateAndDraw({
        header,
        renderer,
        sourceId,
        renderSession,
        runtimePolicy,
        globalStats,
        canvas,
        workScheduler,
        enqueueTileRequest,
        processTileRequestQueue,
        processPreloadQueue,
    }) {
        if (!header || !renderer || !globalStats) {
            return {
                rendered: false,
                needsLoad: false,
                visibleTiles: [],
            };
        }

        const visibleTiles = this.calculateVisibleTiles({
            renderSession,
            header,
            canvas,
        });
        runtimePolicy.registerVisibleTiles(visibleTiles);

        const renderResult = renderer.render(createRendererInput({
            sourceId,
            slot: 'active',
            header,
            viewState: renderSession.getViewState(),
            tiles: visibleTiles,
            clearMode: 'clear',
        }));
        if (renderResult.rendererReady === false) {
            return {
                rendered: false,
                needsLoad: false,
                visibleTiles,
            };
        }

        let needsLoad = false;
        for (const tile of renderResult.missingTiles) {
            const tileKey = `${tile.x},${tile.y}`;
            if (renderSession.markActiveTilePending(tileKey)) {
                enqueueTileRequest(tileKey, tile);
                needsLoad = true;
            }
        }

        if (needsLoad) {
            processTileRequestQueue();
        }
        if (
            !needsLoad
            && workScheduler.isPreloading()
            && !workScheduler.hasTileRequests()
            && workScheduler.hasPreloadEntries()
        ) {
            processPreloadQueue();
        }

        return {
            rendered: true,
            needsLoad,
            visibleTiles,
        };
    }

    setInitialViewAndDraw({
        header,
        renderSession,
        requestDraw,
        startPreloading,
    }) {
        const scale = renderSession.setInitialView(header);
        this.#emitLog(`Setting initial focused view: scale ${scale.toFixed(2)}x`);
        this.#requestAnimationFrameImpl(() => requestDraw());
        this.#setTimeoutImpl(() => startPreloading(), 500);
        return scale;
    }
}
