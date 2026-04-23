/**
 * @fileoverview Auto-selecting renderer facade for WebGPU/WebGL compatibility.
 */

import { DEFAULT_RENDER_TILE_CACHE_POLICY } from '../runtime/source-cache.js';
import { WebGlRenderer } from './webgl-renderer.js';
import { WebGpuRenderer } from './webgpu-renderer.js';

export class AutoRenderer {
    #canvas;
    #options;
    #delegate = null;
    #kind = null;

    constructor(canvas, options = {}) {
        this.#canvas = canvas;
        this.#options = {
            cachePolicy: options.cachePolicy ?? DEFAULT_RENDER_TILE_CACHE_POLICY,
            onLifecycleEvent: options.onLifecycleEvent ?? null,
            preference: options.preference ?? 'auto',
        };
    }

    getKind() {
        return this.#kind;
    }

    getCachePolicy() {
        return this.#delegate?.getCachePolicy?.() ?? this.#options.cachePolicy;
    }

    async init() {
        const order = this.#options.preference === 'webgl'
            ? ['webgl']
            : this.#options.preference === 'webgpu'
                ? ['webgpu']
                : ['webgpu', 'webgl'];
        const errors = [];

        for (const kind of order) {
            const candidate = this.#createRenderer(kind);
            try {
                await candidate.init();
                this.#delegate?.destroy?.();
                this.#delegate = candidate;
                this.#kind = kind;
                return;
            } catch (error) {
                errors.push(`${kind}: ${error.message}`);
                candidate.destroy?.();
            }
        }

        throw new Error(`Renderer initialization failed (${errors.join(' | ')})`);
    }

    storeTile(args) {
        return this.#delegate?.storeTile(args) ?? false;
    }

    dropTile(args) {
        this.#delegate?.dropTile(args);
    }

    clearSlot(args) {
        this.#delegate?.clearSlot(args);
    }

    swapSlot(args) {
        this.#delegate?.swapSlot(args);
    }

    disposeSource(sourceId) {
        this.#delegate?.disposeSource(sourceId);
    }

    destroy() {
        this.#delegate?.destroy?.();
        this.#delegate = null;
        this.#kind = null;
    }

    clearCanvas() {
        this.#delegate?.clearCanvas?.();
    }

    render(input) {
        return this.#delegate?.render(input) ?? {
            missingTiles: [],
            rendererReady: false,
        };
    }

    #createRenderer(kind) {
        if (kind === 'webgl') {
            return new WebGlRenderer(this.#canvas, {
                cachePolicy: this.#options.cachePolicy,
            });
        }

        return new WebGpuRenderer(this.#canvas, {
            cachePolicy: this.#options.cachePolicy,
            onLifecycleEvent: this.#options.onLifecycleEvent,
        });
    }
}
