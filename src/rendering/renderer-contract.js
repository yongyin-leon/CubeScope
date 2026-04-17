/**
 * @fileoverview Minimal renderer input contract helpers.
 */

export function createRendererInput({
    sourceId,
    slot = 'active',
    header = null,
    viewState = null,
    layers = [],
    tiles = [],
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
        && Array.isArray(value.tiles);
}
