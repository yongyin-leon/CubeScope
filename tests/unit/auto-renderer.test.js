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

describe('AutoRenderer', () => {
    beforeEach(() => {
        delete globalThis.navigator.gpu;
    });

    it('falls back to WebGL when WebGPU is unavailable', async () => {
        const renderer = new AutoRenderer(createCanvas(createMinimalWebGlContext()));

        await renderer.init();
        expect(renderer.getKind()).toBe('webgl');
    });
});
