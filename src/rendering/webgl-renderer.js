/**
 * @fileoverview WebGL fallback renderer that consumes explicit renderer input.
 */

import { isRendererInput } from './renderer-contract.js';
import { DEFAULT_RENDER_TILE_CACHE_POLICY } from '../runtime/source-cache.js';

const VERTEX_SHADER_SOURCE = `
attribute vec2 aPosition;
attribute vec2 aTexCoord;
uniform vec2 uScale;
uniform vec2 uOffset;
varying vec2 vTexCoord;

void main() {
  gl_Position = vec4(aPosition * uScale + uOffset, 0.0, 1.0);
  vTexCoord = aTexCoord;
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uTexture;

void main() {
  gl_FragColor = texture2D(uTexture, vTexCoord);
}
`;

function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`WebGL shader compilation failed: ${info}`);
    }

    return shader;
}

function createProgram(gl) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error(`WebGL program link failed: ${info}`);
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return program;
}

export class WebGlRenderer {
    #canvas;
    #gl = null;
    #program = null;
    #vertexBuffer = null;
    #positionLocation = null;
    #texCoordLocation = null;
    #scaleLocation = null;
    #offsetLocation = null;
    #textureLocation = null;
    #sourceTileCaches = new Map();
    #cachePolicy;
    #touchSequence = 0;
    #isDestroyed = false;

    constructor(canvas, options = {}) {
        this.#canvas = canvas;
        this.#cachePolicy = options.cachePolicy ?? DEFAULT_RENDER_TILE_CACHE_POLICY;
    }

    getKind() {
        return 'webgl';
    }

    getCachePolicy() {
        return this.#cachePolicy;
    }

    async init() {
        const gl = this.#canvas.getContext('webgl', {
            alpha: true,
            antialias: false,
            premultipliedAlpha: true,
            preserveDrawingBuffer: true,
        });

        if (!gl) {
            throw new Error('WebGL is not supported');
        }

        const program = createProgram(gl);
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 0, 1,
             1, -1, 1, 1,
            -1,  1, 0, 0,
            -1,  1, 0, 0,
             1, -1, 1, 1,
             1,  1, 1, 0,
        ]), gl.STATIC_DRAW);

        this.#gl = gl;
        this.#program = program;
        this.#vertexBuffer = vertexBuffer;
        this.#positionLocation = gl.getAttribLocation(program, 'aPosition');
        this.#texCoordLocation = gl.getAttribLocation(program, 'aTexCoord');
        this.#scaleLocation = gl.getUniformLocation(program, 'uScale');
        this.#offsetLocation = gl.getUniformLocation(program, 'uOffset');
        this.#textureLocation = gl.getUniformLocation(program, 'uTexture');
        this.#isDestroyed = false;
    }

    storeTile({ sourceId, slot = 'active', header, tilePayload }) {
        if (!this.#gl || !this.#program) {
            return false;
        }

        const cache = this.#getSlotCache(sourceId, slot);
        const tileKey = `${tilePayload.tile.x},${tilePayload.tile.y}`;
        const previous = cache.get(tileKey);

        if (previous) {
            this.#deleteTileResource(sourceId, slot, tileKey, previous);
        }

        cache.set(tileKey, this.#createTileResources(header, tilePayload));
        this.#enforceSourceBudget(sourceId);
        return true;
    }

    dropTile({ sourceId, slot = 'active', tileKey }) {
        const cache = this.#getSlotCache(sourceId, slot, false);
        if (!cache) {
            return;
        }

        const previous = cache.get(tileKey);
        if (previous) {
            this.#deleteTileResource(sourceId, slot, tileKey, previous);
        }
    }

    clearSlot({ sourceId, slot = 'active' }) {
        const slotCache = this.#getSlotCache(sourceId, slot, false);
        if (!slotCache) {
            return;
        }

        this.#clearCache(slotCache);
        const sourceSlots = this.#sourceTileCaches.get(sourceId);
        sourceSlots?.delete(slot);

        if (sourceSlots?.size === 0) {
            this.#sourceTileCaches.delete(sourceId);
        }
    }

    swapSlot({ sourceId, from = 'transition', to = 'active' }) {
        const sourceSlots = this.#sourceTileCaches.get(sourceId);
        if (!sourceSlots) {
            return;
        }

        const fromCache = sourceSlots.get(from);
        if (!fromCache) {
            return;
        }

        const targetCache = sourceSlots.get(to);
        this.#clearCache(targetCache);
        sourceSlots.set(to, fromCache);
        sourceSlots.delete(from);
    }

    disposeSource(sourceId) {
        const sourceSlots = this.#sourceTileCaches.get(sourceId);
        if (!sourceSlots) {
            return;
        }

        for (const cache of sourceSlots.values()) {
            this.#clearCache(cache);
        }

        this.#sourceTileCaches.delete(sourceId);
    }

    destroy() {
        this.#isDestroyed = true;
        for (const sourceId of this.#sourceTileCaches.keys()) {
            this.disposeSource(sourceId);
        }

        if (this.#gl && this.#vertexBuffer) {
            this.#gl.deleteBuffer(this.#vertexBuffer);
        }
        if (this.#gl && this.#program) {
            this.#gl.deleteProgram(this.#program);
        }

        this.#gl = null;
        this.#program = null;
        this.#vertexBuffer = null;
        this.#positionLocation = null;
        this.#texCoordLocation = null;
        this.#scaleLocation = null;
        this.#offsetLocation = null;
        this.#textureLocation = null;
    }

    clearCanvas() {
        if (!this.#gl) {
            return;
        }

        this.#gl.viewport(0, 0, this.#canvas.width || this.#canvas.clientWidth, this.#canvas.height || this.#canvas.clientHeight);
        this.#gl.clearColor(0, 0, 0, 1);
        this.#gl.clear(this.#gl.COLOR_BUFFER_BIT);
    }

    render(input) {
        if (!isRendererInput(input)) {
            throw new TypeError('WebGlRenderer.render(...) requires a valid RendererInput.');
        }

        if (!this.#gl || !this.#program || !this.#vertexBuffer) {
            return {
                missingTiles: [],
                rendererReady: false,
            };
        }

        const {
            sourceId,
            slot = 'active',
            header,
            viewState = {},
            tiles = [],
            clearMode = 'clear',
        } = input;

        if (!header?.samples || !header?.lines) {
            return {
                missingTiles: Array.from(tiles),
                rendererReady: true,
            };
        }

        const gl = this.#gl;
        const cache = this.#getSlotCache(Number(sourceId), slot, false);
        const missingTiles = [];

        gl.viewport(0, 0, this.#canvas.width || this.#canvas.clientWidth, this.#canvas.height || this.#canvas.clientHeight);
        if (clearMode !== 'load') {
            gl.clearColor(1, 1, 1, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }

        gl.useProgram(this.#program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.#vertexBuffer);
        gl.enableVertexAttribArray(this.#positionLocation);
        gl.vertexAttribPointer(this.#positionLocation, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(this.#texCoordLocation);
        gl.vertexAttribPointer(this.#texCoordLocation, 2, gl.FLOAT, false, 16, 8);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(this.#textureLocation, 0);

        for (const tile of tiles) {
            const tileKey = `${tile.x},${tile.y}`;
            const resource = cache?.get(tileKey);

            if (!resource) {
                missingTiles.push(tile);
                continue;
            }

            resource.lastTouched = ++this.#touchSequence;
            const transform = this.#getTileTransform({
                header,
                tile,
                effectiveWidth: resource.effectiveWidth,
                effectiveHeight: resource.effectiveHeight,
                viewState,
            });
            gl.uniform2fv(this.#scaleLocation, transform.subarray(0, 2));
            gl.uniform2fv(this.#offsetLocation, transform.subarray(2, 4));
            gl.bindTexture(gl.TEXTURE_2D, resource.texture);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        return {
            missingTiles,
            rendererReady: true,
        };
    }

    #getOrCreateSourceSlots(sourceId) {
        let slots = this.#sourceTileCaches.get(sourceId);
        if (!slots) {
            slots = new Map();
            this.#sourceTileCaches.set(sourceId, slots);
        }
        return slots;
    }

    #getSlotCache(sourceId, slot = 'active', create = true) {
        if (!(sourceId > 0)) {
            return null;
        }

        const sourceSlots = create
            ? this.#getOrCreateSourceSlots(sourceId)
            : this.#sourceTileCaches.get(sourceId);

        if (!sourceSlots) {
            return null;
        }

        let cache = sourceSlots.get(slot);
        if (!cache && create) {
            cache = new Map();
            sourceSlots.set(slot, cache);
        }

        return cache ?? null;
    }

    #createTileResources(header, { pixels, effectiveWidth, effectiveHeight, tile }) {
        const gl = this.#gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            effectiveWidth,
            effectiveHeight,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels
        );

        return {
            texture,
            effectiveWidth,
            effectiveHeight,
            byteSize: effectiveWidth * effectiveHeight * 4,
            lastTouched: ++this.#touchSequence,
            tile,
            headerSamples: header.samples,
            headerLines: header.lines,
        };
    }

    #getTileTransform({ header, tile, effectiveWidth, effectiveHeight, viewState }) {
        const { x: aspectX, y: aspectY } = this.#getAspectRatioCorrection(header);
        const normalizedViewState = viewState ?? {};
        const scale = normalizedViewState.scale ?? 1;
        const offsetX = normalizedViewState.offsetX ?? 0;
        const offsetY = normalizedViewState.offsetY ?? 0;
        const tileScaleX = (effectiveWidth / header.samples) * aspectX;
        const tileScaleY = (effectiveHeight / header.lines) * aspectY;
        const tileOffsetX = ((tile.x * 512 + effectiveWidth / 2) / header.samples * 2 - 1) * aspectX;
        const tileOffsetY = ((tile.y * 512 + effectiveHeight / 2) / header.lines * -2 + 1) * aspectY;

        return new Float32Array([
            tileScaleX * scale,
            tileScaleY * scale,
            tileOffsetX * scale + offsetX,
            tileOffsetY * scale + offsetY,
        ]);
    }

    #getAspectRatioCorrection(header) {
        if (!header || !this.#canvas.clientWidth || !this.#canvas.clientHeight) {
            return { x: 1, y: 1 };
        }

        const imageAspect = header.samples / header.lines;
        const canvasAspect = this.#canvas.clientWidth / this.#canvas.clientHeight;
        let aspectX = 1;
        let aspectY = 1;

        if (imageAspect > canvasAspect) {
            aspectY = canvasAspect / imageAspect;
        } else {
            aspectX = imageAspect / canvasAspect;
        }

        return { x: aspectX, y: aspectY };
    }

    #releaseTileResource(resource) {
        if (this.#gl && resource?.texture) {
            this.#gl.deleteTexture(resource.texture);
        }
    }

    #deleteTileResource(sourceId, slot, tileKey, resource) {
        const cache = this.#getSlotCache(sourceId, slot, false);
        if (!cache) {
            return;
        }

        this.#releaseTileResource(resource);
        cache.delete(tileKey);

        if (cache.size === 0) {
            const sourceSlots = this.#sourceTileCaches.get(sourceId);
            sourceSlots?.delete(slot);
            if (sourceSlots?.size === 0) {
                this.#sourceTileCaches.delete(sourceId);
            }
        }
    }

    #clearCache(cache) {
        if (!cache) {
            return;
        }

        for (const resource of cache.values()) {
            this.#releaseTileResource(resource);
        }

        cache.clear();
    }

    #getSourceUsage(sourceId) {
        const sourceSlots = this.#sourceTileCaches.get(sourceId);
        let tileCount = 0;
        let byteSize = 0;

        if (!sourceSlots) {
            return { tileCount, byteSize };
        }

        for (const cache of sourceSlots.values()) {
            tileCount += cache.size;
            for (const resource of cache.values()) {
                byteSize += resource.byteSize ?? 0;
            }
        }

        return { tileCount, byteSize };
    }

    #findOldestResource(sourceId) {
        const sourceSlots = this.#sourceTileCaches.get(sourceId);
        if (!sourceSlots) {
            return null;
        }

        let oldest = null;
        for (const [slot, cache] of sourceSlots.entries()) {
            for (const [tileKey, resource] of cache.entries()) {
                if (!oldest || resource.lastTouched < oldest.resource.lastTouched) {
                    oldest = { slot, tileKey, resource };
                }
            }
        }

        return oldest;
    }

    #enforceSourceBudget(sourceId) {
        if (!(sourceId > 0)) {
            return;
        }

        const byteBudget = this.#cachePolicy.byteBudget ?? Number.MAX_SAFE_INTEGER;
        const tileBudget = this.#cachePolicy.tileBudget ?? Number.MAX_SAFE_INTEGER;

        while (true) {
            const usage = this.#getSourceUsage(sourceId);
            if (usage.byteSize <= byteBudget && usage.tileCount <= tileBudget) {
                break;
            }

            const oldest = this.#findOldestResource(sourceId);
            if (!oldest) {
                break;
            }

            this.#deleteTileResource(sourceId, oldest.slot, oldest.tileKey, oldest.resource);
        }
    }
}
