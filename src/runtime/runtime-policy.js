/**
 * @fileoverview Internal runtime policy for timing, stats readiness, and preload planning.
 */

function createPerformanceState() {
    return {
        loadStartTime: 0,
        bandSwitchStartTime: 0,
        isInitialLoading: false,
        initialVisibleTiles: new Set(),
        completedInitialTiles: new Set(),
    };
}

function collectGlobalStats(bands, getBandStats) {
    const globalStats = {};

    for (const band of bands) {
        globalStats[band] = getBandStats(band);
    }

    return globalStats;
}

export class ViewerRuntimePolicy {
    #now;
    #performance = createPerformanceState();

    constructor(options = {}) {
        this.#now = options.now ?? (() => performance.now());
    }

    reset() {
        this.#performance = createPerformanceState();
    }

    beginLoad() {
        this.reset();
        this.#performance.loadStartTime = this.#now();
        this.#performance.isInitialLoading = true;
    }

    beginBandSwitch() {
        this.#performance.bandSwitchStartTime = this.#now();
    }

    resolveBandStatsPlan({ bands, hasBandStats, getBandStats }) {
        const missingBands = bands.filter((band) => !hasBandStats(band));

        if (missingBands.length > 0) {
            return {
                ready: false,
                missingBands,
                globalStats: null,
            };
        }

        return {
            ready: true,
            missingBands: [],
            globalStats: collectGlobalStats(bands, getBandStats),
        };
    }

    registerVisibleTiles(visibleTiles) {
        if (this.#performance.isInitialLoading && this.#performance.initialVisibleTiles.size === 0 && visibleTiles.length > 0) {
            this.#performance.initialVisibleTiles = new Set(visibleTiles.map((tile) => `${tile.x},${tile.y}`));
        }
    }

    recordCompletedInitialTile(tileKey) {
        if (!this.#performance.isInitialLoading || !this.#performance.initialVisibleTiles.has(tileKey)) {
            return null;
        }

        this.#performance.completedInitialTiles.add(tileKey);

        if (this.#performance.completedInitialTiles.size >= this.#performance.initialVisibleTiles.size) {
            this.#performance.isInitialLoading = false;
            return {
                name: 'timeToInitialView',
                value: this.#now() - this.#performance.loadStartTime,
                unit: 'ms',
            };
        }

        return null;
    }

    completeBandSwitchMetric() {
        return {
            name: 'bandSwitchTime',
            value: this.#now() - this.#performance.bandSwitchStartTime,
            unit: 'ms',
        };
    }

    buildPreloadEntries({ header, visibleTiles, tileSize, hasActiveTile }) {
        const preloadEntries = [];
        const maxTileX = Math.ceil(header.samples / tileSize);
        const maxTileY = Math.ceil(header.lines / tileSize);
        const visibleSet = new Set(visibleTiles.map((tile) => `${tile.x},${tile.y}`));
        const centerX = Math.floor((visibleTiles.reduce((sum, tile) => sum + tile.x, 0) / visibleTiles.length) || 0);
        const centerY = Math.floor((visibleTiles.reduce((sum, tile) => sum + tile.y, 0) / visibleTiles.length) || 0);

        for (let y = 0; y < maxTileY; y += 1) {
            for (let x = 0; x < maxTileX; x += 1) {
                const tileKey = `${x},${y}`;
                if (!visibleSet.has(tileKey) && !hasActiveTile(tileKey)) {
                    const dist = Math.abs(x - centerX) + Math.abs(y - centerY);
                    preloadEntries.push({ tile: { x, y }, dist });
                }
            }
        }

        preloadEntries.sort((a, b) => a.dist - b.dist);
        return preloadEntries;
    }
}
