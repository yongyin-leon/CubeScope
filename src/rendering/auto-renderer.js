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
    #sessionDisabledKinds = new Set();
    #lastInitReport = null;

    constructor(canvas, options = {}) {
        this.#canvas = canvas;
        this.#sessionDisabledKinds = new Set(
            Array.isArray(options.disabledKinds) ? options.disabledKinds : []
        );
        this.#options = {
            cachePolicy: options.cachePolicy ?? DEFAULT_RENDER_TILE_CACHE_POLICY,
            onLifecycleEvent: options.onLifecycleEvent ?? null,
            preference: options.preference ?? 'auto',
        };
    }

    getKind() {
        return this.#kind;
    }

    getLastInitReport() {
        return this.#lastInitReport;
    }

    getCachePolicy() {
        return this.#delegate?.getCachePolicy?.() ?? this.#options.cachePolicy;
    }

    async init() {
        const previousKind = this.#kind;
        const order = this.#resolveInitializationOrder();
        const errors = [];
        const attempts = [];

        for (const kind of order) {
            const candidate = this.#createRenderer(kind);
            try {
                await candidate.init();
                this.#delegate?.destroy?.();
                this.#delegate = candidate;
                this.#kind = kind;
                attempts.push(Object.freeze({
                    kind,
                    status: 'ready',
                    message: null,
                }));
                this.#lastInitReport = this.#createInitReport({
                    previousKind,
                    order,
                    selectedKind: kind,
                    attempts,
                });
                return;
            } catch (error) {
                errors.push(`${kind}: ${error.message}`);
                attempts.push(Object.freeze({
                    kind,
                    status: 'failed',
                    message: error.message,
                }));
                candidate.destroy?.();
            }
        }

        this.#lastInitReport = this.#createInitReport({
            previousKind,
            order,
            selectedKind: null,
            attempts,
        });
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

    #resolveInitializationOrder() {
        const baseOrder = this.#options.preference === 'webgl'
            ? ['webgl']
            : this.#options.preference === 'webgpu'
                ? ['webgpu']
                : ['webgpu', 'webgl'];

        if (this.#options.preference !== 'auto' || this.#sessionDisabledKinds.size === 0) {
            return baseOrder;
        }

        const filteredOrder = baseOrder.filter((kind) => !this.#sessionDisabledKinds.has(kind));
        return filteredOrder.length > 0 ? filteredOrder : ['webgl'];
    }

    #createInitReport({ previousKind = null, order = [], selectedKind = null, attempts = [] } = {}) {
        return Object.freeze({
            preference: this.#options.preference,
            previousKind,
            selectedKind,
            usedFallback: Boolean(selectedKind && order[0] !== selectedKind),
            attemptedKinds: Object.freeze(Array.from(attempts)),
            disabledKinds: Object.freeze(Array.from(this.#sessionDisabledKinds)),
        });
    }

    #notifyLifecycleEvent(event) {
        if (typeof this.#options.onLifecycleEvent === 'function') {
            this.#options.onLifecycleEvent(Object.freeze({ ...event }));
        }
    }

    #handleDelegateLifecycleEvent(kind, event) {
        if (!event) {
            return;
        }

        if (kind === 'webgpu'
            && event.type === 'device-loss'
            && this.#options.preference === 'auto') {
            this.#sessionDisabledKinds.add('webgpu');
            this.#notifyLifecycleEvent({
                type: 'renderer-fallback-armed',
                rendererKind: 'webgpu',
                nextKind: 'webgl',
                reason: event.reason ?? 'device-loss',
                message: 'Auto renderer will prefer WebGL after WebGPU device loss.',
                disabledKinds: Array.from(this.#sessionDisabledKinds),
            });
        }

        this.#notifyLifecycleEvent({
            ...event,
            rendererKind: kind,
            disabledKinds: Array.from(this.#sessionDisabledKinds),
            autoFallbackArmed: kind === 'webgpu'
                && event.type === 'device-loss'
                && this.#options.preference === 'auto',
        });
    }

    #createRenderer(kind) {
        if (kind === 'webgl') {
            return new WebGlRenderer(this.#canvas, {
                cachePolicy: this.#options.cachePolicy,
            });
        }

        return new WebGpuRenderer(this.#canvas, {
            cachePolicy: this.#options.cachePolicy,
            onLifecycleEvent: (event) => this.#handleDelegateLifecycleEvent(kind, event),
        });
    }
}
