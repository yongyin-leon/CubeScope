/**
 * @fileoverview Pure runtime reaction planning for classified worker routes.
 */

function collectCurrentBandStats(currentBands, getBandStats) {
    const globalStats = {};

    for (const band of [currentBands.r, currentBands.g, currentBands.b]) {
        const stats = getBandStats(band);
        if (stats) {
            globalStats[band] = stats;
        }
    }

    return globalStats;
}

export function planStatsCompletionReaction({
    route,
    currentBands,
    hasBandStats,
    getBandStats,
    isTransitioning,
    isWaitingForStats,
    resolveBandStatsPlan,
}) {
    const statsToCache = route.bands.flatMap((band) => (
        route.stats[band]
            ? [{ band, stats: route.stats[band] }]
            : []
    ));

    const reaction = {
        statsToCache,
        drain: { stats: false },
        shouldProcessBackgroundStatsQueue: true,
        logMessage: null,
        nextGlobalStats: null,
        shouldStopWaitingForStats: false,
        shouldStartTransition: false,
        shouldSetInitialView: false,
        shouldEmitLoadEnd: false,
        nextStateChange: null,
        shouldStartBackgroundStats: false,
    };

    if (route.isInitial) {
        reaction.nextGlobalStats = collectCurrentBandStats(currentBands, getBandStats);
        reaction.logMessage = `Initial statistics calculation completed: ${JSON.stringify(reaction.nextGlobalStats)}`;
        reaction.shouldSetInitialView = true;
        reaction.shouldEmitLoadEnd = true;
        reaction.nextStateChange = { loading: false };
        reaction.shouldStartBackgroundStats = true;
        return reaction;
    }

    if (!isTransitioning && isWaitingForStats) {
        const plan = resolveBandStatsPlan({
            bands: [currentBands.r, currentBands.g, currentBands.b],
            hasBandStats,
            getBandStats,
        });

        if (plan.ready) {
            reaction.logMessage = 'Requested band statistics computed; starting smooth transition...';
            reaction.nextGlobalStats = plan.globalStats;
            reaction.shouldStopWaitingForStats = true;
            reaction.shouldStartTransition = true;
        }
    }

    return reaction;
}

export function planTileCompletionReaction({
    stored,
    isTransitioning,
    transitionTilesRemaining,
    initialViewMetric,
}) {
    const reaction = {
        shouldRemoveCurrentTile: !stored,
        shouldFinalizeTransitionFrame: false,
        performanceMetric: null,
        shouldRequestAnimationFrameDraw: false,
        drain: {
            tiles: true,
            preload: true,
        },
    };

    if (!stored) {
        return reaction;
    }

    if (isTransitioning) {
        reaction.performanceMetric = transitionTilesRemaining === 0
            ? initialViewMetric
            : null;
        reaction.shouldFinalizeTransitionFrame = transitionTilesRemaining === 0;
        return reaction;
    }

    reaction.performanceMetric = initialViewMetric;
    reaction.shouldRequestAnimationFrameDraw = true;
    return reaction;
}

export function planTileErrorReaction({
    tileKey,
    message,
    isTransitioning,
    transitionTilesRemaining,
}) {
    return {
        tileKey: tileKey ?? 'unknown',
        logMessage: `Worker failed to load tile (${tileKey ?? 'unknown'}) : ${message || 'Unknown error'}`,
        shouldFinalizeTransitionFrame: isTransitioning && transitionTilesRemaining === 0,
        shouldRemoveCurrentTile: true,
        drain: {
            tiles: true,
            preload: true,
        },
    };
}
