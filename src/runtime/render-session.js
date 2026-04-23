/**
 * @fileoverview Internal render-session state holder for viewport and tile-slot orchestration.
 */

export class RenderSession {
    #tileSize;
    #renderingKey;
    #scale = 1.0;
    #offsetX = 0.0;
    #offsetY = 0.0;
    #activeTileState = new Map();
    #transitionTileState = null;
    #isTransitioning = false;
    #transitionTileCounter = 0;

    constructor(options = {}) {
        this.#tileSize = options.tileSize ?? 512;
        this.#renderingKey = options.renderingKey ?? 'rendering';
    }

    getTileSize() {
        return this.#tileSize;
    }

    getScale() {
        return this.#scale;
    }

    getViewState() {
        return {
            scale: this.#scale,
            offsetX: this.#offsetX,
            offsetY: this.#offsetY,
        };
    }

    isTransitioning() {
        return this.#isTransitioning;
    }

    getCurrentRenderSlot() {
        return this.#isTransitioning ? 'transition' : 'active';
    }

    getCurrentTileState() {
        return this.#isTransitioning
            ? this.#transitionTileState
            : this.#activeTileState;
    }

    hasActiveTile(tileKey) {
        return this.#activeTileState.has(tileKey);
    }

    markActiveTilePending(tileKey) {
        if (this.#isTransitioning || this.#activeTileState.get(tileKey) === this.#renderingKey) {
            return false;
        }

        this.#activeTileState.set(tileKey, this.#renderingKey);
        return true;
    }

    markCurrentTileLoaded(tileKey) {
        this.getCurrentTileState()?.set(tileKey, true);
    }

    removeCurrentTile(tileKey) {
        this.getCurrentTileState()?.delete(tileKey);
    }

    beginTransition({ renderer, sourceId }) {
        if (this.#isTransitioning) {
            return false;
        }

        this.#isTransitioning = true;
        this.#transitionTileState = new Map();
        this.#transitionTileCounter = 0;
        renderer?.clearSlot?.({
            sourceId,
            slot: 'transition',
        });
        return true;
    }

    setTransitionTileCount(count) {
        this.#transitionTileCounter = Math.max(0, Number(count) || 0);
    }

    consumeTransitionTile() {
        if (this.#transitionTileCounter > 0) {
            this.#transitionTileCounter -= 1;
        }

        return this.#transitionTileCounter;
    }

    cancelTransition() {
        this.#transitionTileState?.clear();
        this.#transitionTileState = null;
        this.#isTransitioning = false;
        this.#transitionTileCounter = 0;
    }

    completeTransition({ renderer, sourceId }) {
        renderer?.swapSlot?.({
            sourceId,
            from: 'transition',
            to: 'active',
        });
        this.#activeTileState = this.#transitionTileState ?? new Map();
        this.#transitionTileState = null;
        this.#isTransitioning = false;
        this.#transitionTileCounter = 0;
    }

    resetSourceState() {
        this.#activeTileState.clear();
        this.cancelTransition();
        this.resetView();
    }

    resetForRendererRecovery() {
        const shouldResumeTransition = this.#isTransitioning;
        this.#activeTileState.clear();
        this.cancelTransition();
        return shouldResumeTransition;
    }

    resetView() {
        this.#scale = 1.0;
        this.#offsetX = 0.0;
        this.#offsetY = 0.0;
    }

    setInitialView(header, options = {}) {
        const maxInitialDim = options.maxInitialDim ?? 2048;
        const initialViewWidth = Math.min(header.samples, maxInitialDim);
        const initialViewHeight = Math.min(header.lines, maxInitialDim);
        const scaleX = header.samples / initialViewWidth;
        const scaleY = header.lines / initialViewHeight;
        this.#scale = Math.max(scaleX, scaleY);
        this.#offsetX = 0;
        this.#offsetY = 0;
        return this.#scale;
    }

    panBy({ dx, dy, aspect }) {
        if (this.#scale <= 1.0) {
            return false;
        }

        this.#offsetX += dx;
        this.#offsetY -= dy;
        const limitX = (this.#scale - 1) * aspect.x;
        const limitY = (this.#scale - 1) * aspect.y;
        this.#offsetX = Math.max(-limitX, Math.min(limitX, this.#offsetX));
        this.#offsetY = Math.max(-limitY, Math.min(limitY, this.#offsetY));
        return true;
    }

    zoomAround({ zoomFactor, anchorX, anchorY }) {
        const newScale = this.#scale * zoomFactor;

        if (this.#scale > 1.0 && newScale <= 1.0) {
            this.resetView();
            return;
        }

        this.#scale = Math.max(1.0, newScale);
        if (this.#scale > 1.0) {
            this.#offsetX = (this.#offsetX - anchorX) * zoomFactor + anchorX;
            this.#offsetY = (this.#offsetY - anchorY) * zoomFactor + anchorY;
        }
    }

    canvasPointToPixel({ canvasX, canvasY, canvasWidth, canvasHeight, header }) {
        if (!header || !canvasWidth || !canvasHeight) {
            return null;
        }

        const mouseX = (canvasX / canvasWidth) * 2 - 1;
        const mouseY = (canvasY / canvasHeight) * -2 + 1;
        const aspect = this.getAspectRatioCorrection({
            header,
            canvasWidth,
            canvasHeight,
        });
        const viewX = (mouseX - this.#offsetX) / this.#scale;
        const viewY = (mouseY - this.#offsetY) / this.#scale;
        const imageU = (viewX / aspect.x + 1) / 2;
        const imageV = (viewY / -aspect.y + 1) / 2;
        const imageX = Math.floor(imageU * header.samples);
        const imageY = Math.floor(imageV * header.lines);

        if (imageX < 0 || imageX >= header.samples || imageY < 0 || imageY >= header.lines) {
            return null;
        }

        return { x: imageX, y: imageY };
    }

    calculateVisibleTiles({ header, canvasWidth, canvasHeight }) {
        if (!header || !canvasWidth || !canvasHeight) {
            return [];
        }

        const aspect = this.getAspectRatioCorrection({
            header,
            canvasWidth,
            canvasHeight,
        });
        const viewLeft = (-1 - this.#offsetX) / this.#scale;
        const viewRight = (1 - this.#offsetX) / this.#scale;
        const viewTop = (1 - this.#offsetY) / this.#scale;
        const viewBottom = (-1 - this.#offsetY) / this.#scale;
        const unitStartX = (viewLeft / aspect.x + 1) / 2;
        const unitEndX = (viewRight / aspect.x + 1) / 2;
        const unitStartY = (viewTop / -aspect.y + 1) / 2;
        const unitEndY = (viewBottom / -aspect.y + 1) / 2;
        const maxTileX = Math.ceil(header.samples / this.#tileSize);
        const maxTileY = Math.ceil(header.lines / this.#tileSize);
        const startTileX = Math.max(0, Math.floor(unitStartX * header.samples / this.#tileSize));
        const endTileX = Math.min(maxTileX, Math.ceil(unitEndX * header.samples / this.#tileSize));
        const startTileY = Math.max(0, Math.floor(unitStartY * header.lines / this.#tileSize));
        const endTileY = Math.min(maxTileY, Math.ceil(unitEndY * header.lines / this.#tileSize));
        const tiles = [];

        for (let y = startTileY; y < endTileY; y += 1) {
            for (let x = startTileX; x < endTileX; x += 1) {
                tiles.push({ x, y });
            }
        }

        return tiles;
    }

    getAspectRatioCorrection({ header, canvasWidth, canvasHeight }) {
        if (!header || !canvasWidth || !canvasHeight) {
            return { x: 1.0, y: 1.0 };
        }

        const imageAspect = header.samples / header.lines;
        const canvasAspect = canvasWidth / canvasHeight;
        let aspectX = 1.0;
        let aspectY = 1.0;

        if (imageAspect > canvasAspect) {
            aspectY = canvasAspect / imageAspect;
        } else {
            aspectX = imageAspect / canvasAspect;
        }

        return { x: aspectX, y: aspectY };
    }
}
