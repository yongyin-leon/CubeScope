/**
 * @fileoverview WebGPU renderer that owns GPU resources and consumes explicit renderer input.
 */

import { isRendererInput } from './renderer-contract.js';
import { DEFAULT_RENDER_TILE_CACHE_POLICY } from '../runtime/source-cache.js';

export class WebGpuRenderer {
    #canvas;
    #device = null;
    #context = null;
    #pipeline = null;
    #sampler = null;
    #sourceTileCaches = new Map();
    #cachePolicy;
    #touchSequence = 0;
    #onLifecycleEvent = null;
    #deviceEpoch = 0;
    #isDestroyed = false;

    constructor(canvas, options = {}) {
        this.#canvas = canvas;
        this.#cachePolicy = options.cachePolicy ?? DEFAULT_RENDER_TILE_CACHE_POLICY;
        this.#onLifecycleEvent = options.onLifecycleEvent ?? null;
    }

    getCachePolicy() {
        return this.#cachePolicy;
    }

    async init() {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported');
        }

        const adapter = await navigator.gpu.requestAdapter();

        if (!adapter) {
            throw new Error('Failed to acquire WebGPU adapter');
        }

        const device = await adapter.requestDevice();
        const context = this.#canvas.getContext('webgpu');

        context.configure({
            device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: 'premultiplied',
        });
        this.#device = device;
        this.#context = context;
        this.#isDestroyed = false;
        this.#deviceEpoch += 1;
        this.#watchDeviceLoss(device, this.#deviceEpoch);
        this.#createPipeline();
    }

    storeTile({ sourceId, slot = 'active', header, tilePayload }) {
        if (!this.#pipeline) {
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
        this.#deviceEpoch += 1;
        for (const sourceId of this.#sourceTileCaches.keys()) {
            this.disposeSource(sourceId);
        }

        this.#device = null;
        this.#context = null;
        this.#pipeline = null;
        this.#sampler = null;
    }

    clearCanvas() {
        if (!this.#device || !this.#context) {
            return;
        }

        const commandEncoder = this.#device.createCommandEncoder();
        const textureView = this.#context.getCurrentTexture().createView();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
            }],
        });
        renderPass.end();
        this.#device.queue.submit([commandEncoder.finish()]);
    }

    render(input) {
        if (!isRendererInput(input)) {
            throw new TypeError('WebGpuRenderer.render(...) requires a valid RendererInput.');
        }

        if (!this.#device || !this.#context || !this.#pipeline) {
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

        const cache = this.#getSlotCache(Number(sourceId), slot, false);
        const missingTiles = [];
        const commandEncoder = this.#device.createCommandEncoder();
        const textureView = this.#context.getCurrentTexture().createView();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                loadOp: clearMode === 'load' ? 'load' : 'clear',
                storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
            }],
        });

        renderPass.setPipeline(this.#pipeline);

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

            this.#device.queue.writeBuffer(resource.uniformBuffer, 0, transform);
            renderPass.setBindGroup(0, resource.bindGroup);
            renderPass.draw(6);
        }

        renderPass.end();
        this.#device.queue.submit([commandEncoder.finish()]);

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

    #createPipeline() {
        this.#sampler = this.#device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        const shaderModule = this.#device.createShaderModule({
            code: `
                struct TileUniforms { scale: vec2<f32>, offset: vec2<f32> };
                @group(0) @binding(0) var mySampler: sampler;
                @group(0) @binding(1) var myTexture: texture_2d<f32>;
                @group(0) @binding(2) var<uniform> uniforms: TileUniforms;
                struct VSOutput { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
                @vertex fn vs(@builtin(vertex_index) idx: u32) -> VSOutput {
                    var pos = array<vec2<f32>,6>(
                        vec2(-1,-1), vec2(1,-1), vec2(-1,1),
                        vec2(-1,1), vec2(1,-1), vec2(1,1)
                    );
                    var out: VSOutput;
                    out.pos = vec4(pos[idx] * uniforms.scale + uniforms.offset, 0.0, 1.0);
                    out.uv = pos[idx] * vec2(0.5, -0.5) + 0.5;
                    return out;
                }
                @fragment fn fs(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
                    return textureSample(myTexture, mySampler, uv);
                }
            `,
        });

        this.#pipeline = this.#device.createRenderPipeline({
            layout: 'auto',
            vertex: { module: shaderModule, entryPoint: 'vs' },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs',
                targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
            },
        });
    }

    #createTileResources(header, { pixels, effectiveWidth, effectiveHeight, tile }) {
        const tileTexture = this.#device.createTexture({
            size: [effectiveWidth, effectiveHeight],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        this.#device.queue.writeTexture(
            { texture: tileTexture },
            pixels,
            { bytesPerRow: effectiveWidth * 4 },
            [effectiveWidth, effectiveHeight]
        );
        const uniformBuffer = this.#device.createBuffer({
            size: Float32Array.BYTES_PER_ELEMENT * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const bindGroup = this.#device.createBindGroup({
            layout: this.#pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.#sampler },
                { binding: 1, resource: tileTexture.createView() },
                { binding: 2, resource: { buffer: uniformBuffer } },
            ],
        });

        return {
            bindGroup,
            effectiveWidth,
            effectiveHeight,
            byteSize: effectiveWidth * effectiveHeight * 4,
            lastTouched: ++this.#touchSequence,
            texture: tileTexture,
            uniformBuffer,
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
        resource?.uniformBuffer?.destroy?.();
        resource?.texture?.destroy?.();
    }

    #notifyLifecycleEvent(event) {
        if (typeof this.#onLifecycleEvent === 'function') {
            this.#onLifecycleEvent(Object.freeze({ ...event }));
        }
    }

    #watchDeviceLoss(device, epoch) {
        const lostPromise = device.lost;

        if (!lostPromise) {
            return;
        }

        lostPromise.then(
            (info) => {
                try {
                    this.#handleDeviceLoss(epoch, info);
                } catch {
                    // Ignore lifecycle callback errors here so they do not
                    // masquerade as a second device-loss event.
                }
            },
            () => {
                try {
                    this.#handleDeviceLoss(epoch, { reason: 'unknown', message: 'WebGPU device lost.' });
                } catch {
                    // Ignore lifecycle callback errors here so they do not
                    // masquerade as a second device-loss event.
                }
            }
        );
    }

    #handleDeviceLoss(epoch, info = {}) {
        if (this.#isDestroyed || epoch !== this.#deviceEpoch) {
            return;
        }

        const sourceIds = Array.from(this.#sourceTileCaches.keys());

        for (const sourceId of sourceIds) {
            this.disposeSource(sourceId);
        }

        this.#device = null;
        this.#context = null;
        this.#pipeline = null;
        this.#sampler = null;
        this.#notifyLifecycleEvent({
            type: 'device-loss',
            reason: info.reason ?? 'unknown',
            message: info.message ?? 'WebGPU device lost.',
            sourceIds,
        });
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
        let usage = this.#getSourceUsage(sourceId);

        while (usage.byteSize > byteBudget || usage.tileCount > tileBudget) {
            const oldest = this.#findOldestResource(sourceId);

            if (!oldest) {
                return;
            }

            this.#deleteTileResource(sourceId, oldest.slot, oldest.tileKey, oldest.resource);
            usage = this.#getSourceUsage(sourceId);
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
}
