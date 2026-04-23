/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AutoRenderer } from '../../src/rendering/auto-renderer.js';

function createMinimalWebGlContext() {
    return {
        ARRAY_BUFFER: 0x8892,
        STATIC_DRAW: 0x88E4,
        FLOAT: 0x1406,
        TRIANGLES: 0x0004,
        COLOR_BUFFER_BIT: 0x4000,
        TEXTURE_2D: 0x0DE1,
        TEXTURE_WRAP_S: 0x2802,
        TEXTURE_WRAP_T: 0x2803,
        TEXTURE_MIN_FILTER: 0x2801,
        TEXTURE_MAG_FILTER: 0x2800,
        CLAMP_TO_EDGE: 0x812F,
        LINEAR: 0x2601,
        RGBA: 0x1908,
        UNSIGNED_BYTE: 0x1401,
        TEXTURE0: 0x84C0,
        COMPILE_STATUS: 0x8B81,
        LINK_STATUS: 0x8B82,
        VERTEX_SHADER: 0x8B31,
        FRAGMENT_SHADER: 0x8B30,
        createShader: vi.fn(() => ({})),
        shaderSource: vi.fn(),
        compileShader: vi.fn(),
        getShaderParameter: vi.fn(() => true),
        getShaderInfoLog: vi.fn(() => ''),
        deleteShader: vi.fn(),
        createProgram: vi.fn(() => ({})),
        attachShader: vi.fn(),
        linkProgram: vi.fn(),
        getProgramParameter: vi.fn(() => true),
        getProgramInfoLog: vi.fn(() => ''),
        deleteProgram: vi.fn(),
        createBuffer: vi.fn(() => ({})),
        bindBuffer: vi.fn(),
        bufferData: vi.fn(),
        getAttribLocation: vi.fn((_, name) => name === 'aPosition' ? 0 : 1),
        getUniformLocation: vi.fn((_, name) => ({ name })),
        createTexture: vi.fn(() => ({})),
        bindTexture: vi.fn(),
        texParameteri: vi.fn(),
        texImage2D: vi.fn(),
        viewport: vi.fn(),
        clearColor: vi.fn(),
        clear: vi.fn(),
        useProgram: vi.fn(),
        enableVertexAttribArray: vi.fn(),
        vertexAttribPointer: vi.fn(),
        activeTexture: vi.fn(),
        uniform1i: vi.fn(),
        uniform2fv: vi.fn(),
        drawArrays: vi.fn(),
        deleteTexture: vi.fn(),
        deleteBuffer: vi.fn(),
    };
}

function createCanvas(gl) {
    return {
        width: 256,
        height: 256,
        clientWidth: 256,
        clientHeight: 256,
        getContext: vi.fn((type) => type === 'webgl' ? gl : null),
    };
}

function installFakeWebGpu() {
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
        createTexture: vi.fn(() => ({
            createView: () => ({}),
            destroy: vi.fn(),
        })),
        createBuffer: vi.fn(() => ({
            destroy: vi.fn(),
        })),
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

    const requestAdapter = vi.fn(async () => adapter);
    Object.defineProperty(globalThis.navigator, 'gpu', {
        configurable: true,
        value: {
            requestAdapter,
            getPreferredCanvasFormat: vi.fn(() => 'rgba8unorm'),
        },
    });
    globalThis.GPUTextureUsage = { TEXTURE_BINDING: 1, COPY_DST: 2 };
    globalThis.GPUBufferUsage = { UNIFORM: 1, COPY_DST: 2 };

    return {
        context,
        requestAdapter,
        resolveLoss,
    };
}

function createHybridCanvas({ gl, webgpuContext }) {
    return {
        width: 256,
        height: 256,
        clientWidth: 256,
        clientHeight: 256,
        getContext: vi.fn((type) => {
            if (type === 'webgl') {
                return gl;
            }
            if (type === 'webgpu') {
                return webgpuContext;
            }
            return null;
        }),
    };
}

describe('AutoRenderer', () => {
    beforeEach(() => {
        delete globalThis.navigator.gpu;
        delete globalThis.GPUTextureUsage;
        delete globalThis.GPUBufferUsage;
    });

    it('falls back to WebGL when WebGPU is unavailable', async () => {
        const renderer = new AutoRenderer(createCanvas(createMinimalWebGlContext()));

        await renderer.init();
        expect(renderer.getKind()).toBe('webgl');
        expect(renderer.getLastInitReport()).toMatchObject({
            selectedKind: 'webgl',
            usedFallback: true,
        });
    });

    it('disables WebGPU for the rest of the auto session after device loss', async () => {
        const webGpuHarness = installFakeWebGpu();
        const lifecycleSpy = vi.fn();
        const renderer = new AutoRenderer(createHybridCanvas({
            gl: createMinimalWebGlContext(),
            webgpuContext: webGpuHarness.context,
        }), {
            preference: 'auto',
            onLifecycleEvent: lifecycleSpy,
        });

        await renderer.init();
        expect(renderer.getKind()).toBe('webgpu');
        expect(webGpuHarness.requestAdapter).toHaveBeenCalledTimes(1);

        webGpuHarness.resolveLoss({
            reason: 'unknown',
            message: 'WebGPU device lost during auto-renderer test.',
        });
        await Promise.resolve();
        await Promise.resolve();

        expect(lifecycleSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'renderer-fallback-armed',
            rendererKind: 'webgpu',
            nextKind: 'webgl',
        }));
        expect(lifecycleSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'device-loss',
            rendererKind: 'webgpu',
            autoFallbackArmed: true,
        }));

        await renderer.init();

        expect(renderer.getKind()).toBe('webgl');
        expect(webGpuHarness.requestAdapter).toHaveBeenCalledTimes(1);
        expect(renderer.getLastInitReport()).toMatchObject({
            selectedKind: 'webgl',
            disabledKinds: ['webgpu'],
            usedFallback: false,
        });
    });

    it('can seed the auto session with disabled WebGPU kinds after recovery', async () => {
        const webGpuHarness = installFakeWebGpu();
        const renderer = new AutoRenderer(createHybridCanvas({
            gl: createMinimalWebGlContext(),
            webgpuContext: webGpuHarness.context,
        }), {
            preference: 'auto',
            disabledKinds: ['webgpu'],
        });

        await renderer.init();

        expect(renderer.getKind()).toBe('webgl');
        expect(webGpuHarness.requestAdapter).not.toHaveBeenCalled();
        expect(renderer.getLastInitReport()).toMatchObject({
            selectedKind: 'webgl',
            disabledKinds: ['webgpu'],
        });
    });
});
