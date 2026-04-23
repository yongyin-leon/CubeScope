import { describe, expect, it } from 'vitest';

import {
    planStatsCompletionReaction,
    planTileCompletionReaction,
    planTileErrorReaction,
} from '../../src/runtime/runtime-reaction-plan.js';

describe('runtime-reaction-plan', () => {
    it('plans initial stats completion into initial-view setup steps', () => {
        const stats = new Map([
            [10, { min: 1, max: 2 }],
            [20, { min: 3, max: 4 }],
            [30, { min: 5, max: 6 }],
        ]);

        const reaction = planStatsCompletionReaction({
            route: {
                isInitial: true,
                bands: [10, 20, 30],
                stats: {
                    10: { min: 1, max: 2 },
                    20: { min: 3, max: 4 },
                    30: { min: 5, max: 6 },
                },
            },
            currentBands: { r: 30, g: 20, b: 10 },
            hasBandStats: (band) => stats.has(band),
            getBandStats: (band) => stats.get(band),
            isTransitioning: false,
            isWaitingForStats: false,
            resolveBandStatsPlan: () => ({
                ready: true,
                missingBands: [],
                globalStats: null,
            }),
        });

        expect(reaction.statsToCache).toEqual([
            { band: 10, stats: { min: 1, max: 2 } },
            { band: 20, stats: { min: 3, max: 4 } },
            { band: 30, stats: { min: 5, max: 6 } },
        ]);
        expect(reaction.nextGlobalStats).toEqual({
            10: { min: 1, max: 2 },
            20: { min: 3, max: 4 },
            30: { min: 5, max: 6 },
        });
        expect(reaction.shouldSetInitialView).toBe(true);
        expect(reaction.shouldEmitLoadEnd).toBe(true);
        expect(reaction.nextStateChange).toEqual({ loading: false });
        expect(reaction.shouldStartBackgroundStats).toBe(true);
        expect(reaction.shouldProcessBackgroundStatsQueue).toBe(true);
    });

    it('plans non-initial stats completion into a transition when requested bands are ready', () => {
        const reaction = planStatsCompletionReaction({
            route: {
                isInitial: false,
                bands: [11],
                stats: {
                    11: { min: 1, max: 9 },
                },
            },
            currentBands: { r: 30, g: 20, b: 11 },
            hasBandStats: (band) => band !== 11,
            getBandStats: (band) => ({ min: band, max: band + 1 }),
            isTransitioning: false,
            isWaitingForStats: true,
            resolveBandStatsPlan: () => ({
                ready: true,
                missingBands: [],
                globalStats: {
                    11: { min: 1, max: 9 },
                    20: { min: 20, max: 21 },
                    30: { min: 30, max: 31 },
                },
            }),
        });

        expect(reaction.statsToCache).toEqual([
            { band: 11, stats: { min: 1, max: 9 } },
        ]);
        expect(reaction.shouldStopWaitingForStats).toBe(true);
        expect(reaction.shouldStartTransition).toBe(true);
        expect(reaction.nextGlobalStats).toEqual({
            11: { min: 1, max: 9 },
            20: { min: 20, max: 21 },
            30: { min: 30, max: 31 },
        });
    });

    it('plans tile completion outcomes for transition and initial-view cases', () => {
        expect(planTileCompletionReaction({
            stored: false,
            isTransitioning: false,
            transitionTilesRemaining: null,
            initialViewMetric: null,
        })).toEqual({
            shouldRemoveCurrentTile: true,
            shouldFinalizeTransitionFrame: false,
            performanceMetric: null,
            shouldRequestAnimationFrameDraw: false,
            drain: {
                tiles: true,
                preload: true,
            },
        });

        expect(planTileCompletionReaction({
            stored: true,
            isTransitioning: true,
            transitionTilesRemaining: 0,
            initialViewMetric: {
                name: 'bandSwitchTime',
                value: 12,
                unit: 'ms',
            },
        })).toEqual({
            shouldRemoveCurrentTile: false,
            shouldFinalizeTransitionFrame: true,
            performanceMetric: {
                name: 'bandSwitchTime',
                value: 12,
                unit: 'ms',
            },
            shouldRequestAnimationFrameDraw: false,
            drain: {
                tiles: true,
                preload: true,
            },
        });

        expect(planTileCompletionReaction({
            stored: true,
            isTransitioning: false,
            transitionTilesRemaining: null,
            initialViewMetric: {
                name: 'timeToInitialView',
                value: 18,
                unit: 'ms',
            },
        })).toEqual({
            shouldRemoveCurrentTile: false,
            shouldFinalizeTransitionFrame: false,
            performanceMetric: {
                name: 'timeToInitialView',
                value: 18,
                unit: 'ms',
            },
            shouldRequestAnimationFrameDraw: true,
            drain: {
                tiles: true,
                preload: true,
            },
        });
    });

    it('plans tile errors into cleanup and transition completion when needed', () => {
        expect(planTileErrorReaction({
            tileKey: '3,4',
            message: 'boom',
            isTransitioning: true,
            transitionTilesRemaining: 0,
        })).toEqual({
            tileKey: '3,4',
            logMessage: 'Worker failed to load tile (3,4) : boom',
            shouldFinalizeTransitionFrame: true,
            shouldRemoveCurrentTile: true,
            drain: {
                tiles: true,
                preload: true,
            },
        });
    });
});
