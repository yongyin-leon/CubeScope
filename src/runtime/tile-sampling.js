/**
 * @fileoverview Deterministic tile sampling helpers for reproducible statistics.
 */

export function getTileGrid(header, tileSize = 512) {
    const samples = Number(header?.samples);
    const lines = Number(header?.lines);
    const normalizedTileSize = Number(tileSize);

    if (
        !Number.isInteger(samples)
        || !Number.isInteger(lines)
        || !Number.isInteger(normalizedTileSize)
        || samples < 1
        || lines < 1
        || normalizedTileSize < 1
    ) {
        throw new TypeError('getTileGrid(...) requires positive integer dimensions and tile size.');
    }

    return Object.freeze({
        columns: Math.max(1, Math.ceil(samples / normalizedTileSize)),
        rows: Math.max(1, Math.ceil(lines / normalizedTileSize)),
    });
}

function addCandidate(candidates, seen, x, y, { columns, rows }) {
    const tile = {
        x: Math.max(0, Math.min(columns - 1, Number(x))),
        y: Math.max(0, Math.min(rows - 1, Number(y))),
    };
    const key = `${tile.x},${tile.y}`;

    if (seen.has(key)) {
        return;
    }

    seen.add(key);
    candidates.push(Object.freeze(tile));
}

export function buildDeterministicSampleTiles(header, {
    tileSize = 512,
    sampleCount = 5,
} = {}) {
    const grid = getTileGrid(header, tileSize);
    const requestedCount = Math.max(1, Number(sampleCount) || 1);
    const candidates = [];
    const seen = new Set();
    const maxX = grid.columns - 1;
    const maxY = grid.rows - 1;
    const midX = Math.floor(maxX / 2);
    const midY = Math.floor(maxY / 2);

    for (const [x, y] of [
        [0, 0],
        [maxX, maxY],
        [midX, midY],
        [maxX, 0],
        [0, maxY],
        [Math.floor(maxX * 0.25), Math.floor(maxY * 0.25)],
        [Math.floor(maxX * 0.75), Math.floor(maxY * 0.75)],
    ]) {
        addCandidate(candidates, seen, x, y, grid);
        if (candidates.length >= requestedCount) {
            return Object.freeze(candidates);
        }
    }

    for (let y = 0; y < grid.rows && candidates.length < requestedCount; y += 1) {
        for (let x = 0; x < grid.columns && candidates.length < requestedCount; x += 1) {
            addCandidate(candidates, seen, x, y, grid);
        }
    }

    return Object.freeze(candidates);
}
