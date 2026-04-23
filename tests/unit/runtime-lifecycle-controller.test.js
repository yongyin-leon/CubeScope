import { describe, expect, it } from 'vitest';

import { ViewerRuntimeLifecycleController } from '../../src/runtime/runtime-lifecycle-controller.js';

describe('ViewerRuntimeLifecycleController', () => {
    it('creates metadata summaries and tolerates unavailable file sizes', async () => {
        const controller = new ViewerRuntimeLifecycleController();

        await expect(controller.createMetadataSummary({
            dataSource: {
                name: 'cube.img',
                kind: 'envi-http',
                size: async () => 2048,
            },
            header: {
                samples: 256,
                lines: 128,
                bands: 32,
                interleave: 'bil',
                dataType: 'float32',
                byteOrder: 'little-endian',
            },
        })).resolves.toEqual({
            fileName: 'cube.img',
            fileSize: 2048,
            sourceKind: 'envi-http',
            dimensions: {
                samples: 256,
                lines: 128,
                bands: 32,
            },
            format: {
                interleave: 'BIL',
                dataType: 'float32',
                byteOrder: 'LITTLE-ENDIAN',
            },
        });

        await expect(controller.createMetadataSummary({
            dataSource: {
                name: 'cube.img',
                kind: 'envi-local',
                size: async () => {
                    throw new Error('no size');
                },
            },
            header: {
                samples: 1,
                lines: 1,
                bands: 1,
                interleave: 'bsq',
                dataType: 'uint16',
                byteOrder: 'little-endian',
            },
        })).resolves.toMatchObject({
            fileSize: null,
            sourceKind: 'envi-local',
        });
    });

    it('resets source-scoped state through the provided callbacks', () => {
        const controller = new ViewerRuntimeLifecycleController();
        const calls = [];

        controller.resetSourceState({
            canceledSourceId: 9,
            cancelReason: 'source-switch',
            cancelSourceRequests: (sourceId, reason) => calls.push(['cancelSourceRequests', sourceId, reason]),
            resetWorkState: () => calls.push(['resetWorkState']),
            rejectPendingSpectrumRequests: (message) => calls.push(['rejectPendingSpectrumRequests', message]),
            disposeRendererSource: (sourceId) => calls.push(['disposeRendererSource', sourceId]),
            clearMetadataCache: (sourceId) => calls.push(['clearMetadataCache', sourceId]),
            clearStatsCache: (sourceId) => calls.push(['clearStatsCache', sourceId]),
            clearRequestTracker: () => calls.push(['clearRequestTracker']),
            unloadCubeStore: () => calls.push(['unloadCubeStore']),
            clearRuntimeState: () => calls.push(['clearRuntimeState']),
            resetRuntimePolicy: () => calls.push(['resetRuntimePolicy']),
            resetRenderSession: () => calls.push(['resetRenderSession']),
        });

        expect(calls).toEqual([
            ['cancelSourceRequests', 9, 'source-switch'],
            ['resetWorkState'],
            ['rejectPendingSpectrumRequests', 'Viewer source unloaded.'],
            ['disposeRendererSource', 9],
            ['clearMetadataCache', 9],
            ['clearStatsCache', 9],
            ['clearRequestTracker'],
            ['unloadCubeStore'],
            ['clearRuntimeState'],
            ['resetRuntimePolicy'],
            ['resetRenderSession'],
        ]);
    });

    it('handles device-loss recovery for both transition resume and redraw paths', async () => {
        const logs = [];
        const errors = [];
        const scheduledFrames = [];
        const controller = new ViewerRuntimeLifecycleController({
            emitLog: (message) => logs.push(message),
            emitError: (message) => errors.push(message),
            requestAnimationFrameImpl: (callback) => {
                scheduledFrames.push('frame');
                callback();
            },
        });

        let transitionResumed = 0;
        let redraws = 0;
        const renderer = {
            init: async () => {},
            getKind: () => 'webgl',
        };

        await controller.handleRendererLifecycleEvent({
            event: {
                type: 'device-loss',
                message: 'adapter lost',
            },
            resetForRendererRecovery: () => true,
            clearTileRequests: () => logs.push('clear-tile-requests'),
            stopPreloading: () => logs.push('stop-preloading'),
            recoverRenderer: () => controller.recoverRendererAfterDeviceLoss({
                renderer,
                hasRenderableSource: () => true,
                startTransition: () => {
                    transitionResumed += 1;
                },
                requestDraw: () => {
                    redraws += 1;
                },
            }),
        });

        await controller.recoverRendererAfterDeviceLoss({
            renderer,
            hasRenderableSource: () => true,
            startTransition: () => {
                transitionResumed += 1;
            },
            requestDraw: () => {
                redraws += 1;
            },
        });

        expect(logs).toContain('Renderer lifecycle event: adapter lost');
        expect(logs).toContain('clear-tile-requests');
        expect(logs).toContain('stop-preloading');
        expect(logs).toContain('Reinitializing renderer after device loss...');
        expect(logs).toContain('Renderer recovered after device loss (webgl).');
        expect(transitionResumed).toBe(1);
        expect(redraws).toBe(1);
        expect(scheduledFrames).toEqual(['frame']);
        expect(errors).toEqual([]);
    });

    it('logs auto-renderer fallback arming without starting recovery', () => {
        const logs = [];
        const controller = new ViewerRuntimeLifecycleController({
            emitLog: (message) => logs.push(message),
        });
        let recovered = 0;

        const result = controller.handleRendererLifecycleEvent({
            event: {
                type: 'renderer-fallback-armed',
                message: 'Auto renderer will prefer WebGL after WebGPU device loss.',
            },
            recoverRenderer: () => {
                recovered += 1;
            },
        });

        expect(result).toBeUndefined();
        expect(recovered).toBe(0);
        expect(logs).toEqual([
            'Auto renderer will prefer WebGL after WebGPU device loss.',
        ]);
    });
});
