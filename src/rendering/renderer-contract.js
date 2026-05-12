/**
 * @fileoverview Minimal renderer input contract helpers.
 */

export const DEFAULT_RENDER_TILE_SIZE = 512;

function normalizeTileSize(tileSize) {
    const normalized = Number(tileSize);

    if (!Number.isInteger(normalized) || normalized < 1) {
        throw new TypeError('RendererInput.tileSize must be a positive integer.');
    }

    return normalized;
}

export function createRendererInput({
    sourceId,
    slot = 'active',
    header = null,
    viewState = null,
    layers = [],
    tiles = [],
    tileSize = DEFAULT_RENDER_TILE_SIZE,
    clearMode = 'clear',
}) {
    if (sourceId === undefined || sourceId === null) {
        throw new TypeError('RendererInput requires a sourceId.');
    }

    const input = {
        sourceId: String(sourceId),
        slot,
        header,
        viewState,
        layers: Array.from(layers),
        tiles: Array.from(tiles),
        tileSize: normalizeTileSize(tileSize),
        clearMode,
    };

    Object.freeze(input.layers);
    Object.freeze(input.tiles);

    return Object.freeze(input);
}

export function isRendererInput(value) {
    return Boolean(value)
        && typeof value.sourceId === 'string'
        && typeof value.slot === 'string'
        && Array.isArray(value.layers)
        && Array.isArray(value.tiles)
        && Number.isInteger(value.tileSize)
        && value.tileSize > 0;
}
