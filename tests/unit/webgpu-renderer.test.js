/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRendererInput } from '../../src/rendering/renderer-contract.js';
import { WebGpuRenderer } from '../../src/rendering/webgpu-renderer.js';

function installFakeWebGpu() {
    const textureDestroySpies = [];
    const bufferDestroySpies = [];
    let resolveLoss;
    const lost = new Promise((resolve) => {
        resolveLoss = resolve;
    });

    const context = {
        configure: vi.fn(),
        getCurrentTexture: vi.fn(() => ({
            createView: () => ({}),
        })),
    };

    const device = {
        lost,
        queue: {
            submit: vi.fn(),
            writeBuffer: vi.fn(),
            writeTexture: vi.fn(),
        },
        createSampler: vi.fn(() => ({})),
        createShaderModule: vi.fn(() => ({})),
        createRenderPipeline: vi.fn(() => ({
            getBindGroupLayout: () => ({}),
        })),
        createTexture: vi.fn(() => {
            const destroy = vi.fn();
            textureDestroySpies.push(destroy);
            return {
                createView: () => ({}),
                destroy,
            };
        }),
        createBuffer: vi.fn(() => {
            const destroy = vi.fn();
            bufferDestroySpies.push(destroy);
            return { destroy };
        }),
        createBindGroup: vi.fn(() => ({})),
        createCommandEncoder: vi.fn(() => ({
            beginRenderPass: () => ({
                setPipeline: vi.fn(),
                setBindGroup: vi.fn(),
                draw: vi.fn(),
                end: vi.fn(),
            }),
            finish: () => ({}),
        })),
    };

    const adapter = {
        requestDevice: vi.fn(async () => device),
    };

    Object.defineProperty(globalThis.navigator, 'gpu', {
        configurable: true,
        value: {
            requestAdapter: vi.fn(async () => adapter),
            getPreferredCanvasFormat: vi.fn(() => 'rgba8unorm'),
        },
    });
    globalThis.GPUTextureUsage = { TEXTURE_BINDING: 1, COPY_DST: 2 };
    globalThis.GPUBufferUsage = { UNIFORM: 1, COPY_DST: 2 };

    return {
        adapter,
        bufferDestroySpies,
        context,
        device,
        resolveLoss,
        textureDestroySpies,
    };
}

function createCanvas(context) {
    return {
        clientWidth: 512,
        clientHeight: 512,
        getContext: vi.fn(() => context),
    };
}

function createTilePayload() {
    return {
        tile: { x: 0, y: 0 },
        effectiveWidth: 2,
        effectiveHeight: 2,
        pixels: new Uint8Array(16),
    };
}

describe('WebGpuRenderer lifecycle', () => {
    beforeEach(() => {
        delete globalThis.GPUTextureUsage;
        delete globalThis.GPUBufferUsage;
    });

    it('returns false when storing tiles before initialization', () => {
        const renderer = new WebGpuRenderer(createCanvas({
            configure: vi.fn(),
            getCurrentTexture: vi.fn(),
        }));

        expect(renderer.storeTile({
            sourceId: 1,
            header: { samples: 2, lines: 2 },
            tilePayload: createTilePayload(),
        })).toBe(false);
    });

    it('disposes GPU resources and reports device loss explicitly', async () => {
        const harness = installFakeWebGpu();
        const lifecycleSpy = vi.fn();
        const renderer = new WebGpuRenderer(
            createCanvas(harness.context),
            { onLifecycleEvent: lifecycleSpy }
        );

        await renderer.init();
        expect(renderer.storeTile({
            sourceId: 7,
            header: { samples: 2, lines: 2 },
            tilePayload: createTilePayload(),
        })).toBe(true);

        harness.resolveLoss({
            reason: 'unknown',
            message: 'WebGPU device lost during test.',
        });
        await Promise.resolve();
        await Promise.resolve();

        expect(lifecycleSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'device-loss',
            reason: 'unknown',
            sourceIds: [7],
        }));
        expect(harness.textureDestroySpies[0]).toHaveBeenCalledTimes(1);
        expect(harness.bufferDestroySpies[0]).toHaveBeenCalledTimes(1);
        expect(renderer.render(createRendererInput({
            sourceId: 7,
            header: { samples: 2, lines: 2 },
            tiles: [{ x: 0, y: 0 }],
        }))).toEqual({
            missingTiles: [],
            rendererReady: false,
        });
    });

    it('uses the renderer input tileSize when writing tile transforms', async () => {
        const harness = installFakeWebGpu();
        const renderer = new WebGpuRenderer(createCanvas(harness.context));

        await renderer.init();
        renderer.storeTile({
            sourceId: 1,
            header: { samples: 8, lines: 4 },
            tilePayload: {
                ...createTilePayload(),
                tile: { x: 1, y: 0 },
            },
        });
        renderer.render(createRendererInput({
            sourceId: 1,
            header: { samples: 8, lines: 4 },
            tiles: [{ x: 1, y: 0 }],
            tileSize: 2,
        }));

        const transform = harness.device.queue.writeBuffer.mock.calls.at(-1)?.[2];
        expect(Array.from(transform)).toEqual([0.25, 0.25, -0.25, 0.25]);
    });
});
