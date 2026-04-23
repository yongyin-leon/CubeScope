import { describe, expect, it } from 'vitest';

import { ViewerRuntimeViewController } from '../../src/runtime/runtime-view-controller.js';

describe('ViewerRuntimeViewController', () => {
    it('resizes the canvas using device pixel ratio when needed', () => {
        const controller = new ViewerRuntimeViewController({
            getDevicePixelRatio: () => 2,
        });
        const canvas = {
            clientWidth: 320,
            clientHeight: 180,
            width: 320,
            height: 180,
        };

        expect(controller.resizeCanvas(canvas)).toBe(true);
        expect(canvas.width).toBe(640);
        expect(canvas.height).toBe(360);
        expect(controller.resizeCanvas(canvas)).toBe(false);
    });

    it('updates the view, queues missing tiles, and drains preload when appropriate', () => {
        const queued = [];
        let tileQueueDrains = 0;
        let preloadDrains = 0;
        const controller = new ViewerRuntimeViewController();
        const renderSession = {
            calculateVisibleTiles: () => [{ x: 0, y: 0 }],
            getViewState: () => ({ scale: 1, offsetX: 0, offsetY: 0 }),
            isTransitioning: () => false,
            markActiveTilePending: () => true,
        };
        const workScheduler = {
            isPreloading: () => true,
            hasTileRequests: () => false,
            hasPreloadEntries: () => true,
        };
        const runtimePolicy = {
            registerVisibleTiles: () => {},
        };

        const first = controller.updateAndDraw({
            header: { samples: 512, lines: 512, bands: 32 },
            renderer: {
                render: () => ({
                    rendererReady: true,
                    missingTiles: [{ x: 1, y: 0 }],
                }),
            },
            sourceId: 7,
            renderSession,
            runtimePolicy,
            globalStats: { 10: { min: 1, max: 2 } },
            canvas: { clientWidth: 320, clientHeight: 180 },
            workScheduler,
            enqueueTileRequest: (tileKey, tile) => queued.push({ tileKey, tile }),
            processTileRequestQueue: () => {
                tileQueueDrains += 1;
            },
            processPreloadQueue: () => {
                preloadDrains += 1;
            },
        });

        expect(first).toEqual({
            rendered: true,
            needsLoad: true,
            visibleTiles: [{ x: 0, y: 0 }],
        });
        expect(queued).toEqual([{ tileKey: '1,0', tile: { x: 1, y: 0 } }]);
        expect(tileQueueDrains).toBe(1);
        expect(preloadDrains).toBe(0);

        const second = controller.updateAndDraw({
            header: { samples: 512, lines: 512, bands: 32 },
            renderer: {
                render: () => ({
                    rendererReady: true,
                    missingTiles: [],
                }),
            },
            sourceId: 7,
            renderSession: {
                ...renderSession,
                markActiveTilePending: () => false,
            },
            runtimePolicy,
            globalStats: { 10: { min: 1, max: 2 } },
            canvas: { clientWidth: 320, clientHeight: 180 },
            workScheduler,
            enqueueTileRequest: () => {},
            processTileRequestQueue: () => {
                tileQueueDrains += 1;
            },
            processPreloadQueue: () => {
                preloadDrains += 1;
            },
        });

        expect(second).toEqual({
            rendered: true,
            needsLoad: false,
            visibleTiles: [{ x: 0, y: 0 }],
        });
        expect(preloadDrains).toBe(1);
    });

    it('sets the initial view, schedules a draw, and starts preloading later', () => {
        const logs = [];
        const scheduled = [];
        let draws = 0;
        let preloads = 0;
        const controller = new ViewerRuntimeViewController({
            emitLog: (message) => logs.push(message),
            requestAnimationFrameImpl: (callback) => {
                scheduled.push('raf');
                callback();
            },
            setTimeoutImpl: (callback, delay) => {
                scheduled.push(`timeout:${delay}`);
                callback();
            },
        });

        const scale = controller.setInitialViewAndDraw({
            header: { samples: 4096, lines: 1024 },
            renderSession: {
                setInitialView: () => 2,
            },
            requestDraw: () => {
                draws += 1;
            },
            startPreloading: () => {
                preloads += 1;
            },
        });

        expect(scale).toBe(2);
        expect(logs).toEqual(['Setting initial focused view: scale 2.00x']);
        expect(draws).toBe(1);
        expect(preloads).toBe(1);
        expect(scheduled).toEqual(['raf', 'timeout:500']);
    });
});
