/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRendererInput } from '../../src/rendering/renderer-contract.js';
import { WebGlRenderer } from '../../src/rendering/webgl-renderer.js';

function createFakeWebGlContext() {
    const textureDeleteSpies = [];
    const bufferDeleteSpies = [];
    const programDeleteSpies = [];
    const shaderDeleteSpies = [];

    const gl = {
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
        deleteShader: vi.fn((shader) => shaderDeleteSpies.push(shader)),
        createProgram: vi.fn(() => ({})),
        attachShader: vi.fn(),
        linkProgram: vi.fn(),
        getProgramParameter: vi.fn(() => true),
        getProgramInfoLog: vi.fn(() => ''),
        deleteProgram: vi.fn((program) => programDeleteSpies.push(program)),
        createBuffer: vi.fn(() => {
            const buffer = {};
            bufferDeleteSpies.push(vi.fn());
            return buffer;
        }),
        bindBuffer: vi.fn(),
        bufferData: vi.fn(),
        getAttribLocation: vi.fn((_, name) => name === 'aPosition' ? 0 : 1),
        getUniformLocation: vi.fn((_, name) => ({ name })),
        createTexture: vi.fn(() => {
            const texture = {};
            textureDeleteSpies.push(vi.fn());
            return texture;
        }),
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
    };

    const textureDeleteMap = new Map();
    gl.createTexture.mockImplementation(() => {
        const texture = {};
        textureDeleteMap.set(texture, vi.fn());
        return texture;
    });
    gl.deleteTexture.mockImplementation((texture) => textureDeleteMap.get(texture)?.());

    const bufferDeleteMap = new Map();
    gl.createBuffer.mockImplementation(() => {
        const buffer = {};
        bufferDeleteMap.set(buffer, vi.fn());
        return buffer;
    });
    gl.deleteBuffer = vi.fn((buffer) => bufferDeleteMap.get(buffer)?.());

    const programDeleteMap = new Map();
    gl.createProgram.mockImplementation(() => {
        const program = {};
        programDeleteMap.set(program, vi.fn());
        return program;
    });
    gl.deleteProgram = vi.fn((program) => programDeleteMap.get(program)?.());

    return {
        gl,
        textureDeleteMap,
        bufferDeleteMap,
        programDeleteMap,
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

function createTilePayload() {
    return {
        tile: { x: 0, y: 0 },
        effectiveWidth: 2,
        effectiveHeight: 2,
        pixels: new Uint8Array(16),
    };
}

describe('WebGlRenderer', () => {
    beforeEach(() => {
        delete globalThis.navigator.gpu;
    });

    it('stores and renders tile resources after initialization', async () => {
        const harness = createFakeWebGlContext();
        const renderer = new WebGlRenderer(createCanvas(harness.gl));

        await renderer.init();
        expect(renderer.getKind()).toBe('webgl');
        expect(renderer.storeTile({
            sourceId: 1,
            header: { samples: 2, lines: 2 },
            tilePayload: createTilePayload(),
        })).toBe(true);

        expect(renderer.render(createRendererInput({
            sourceId: 1,
            header: { samples: 2, lines: 2 },
            tiles: [{ x: 0, y: 0 }],
        }))).toEqual({
            missingTiles: [],
            rendererReady: true,
        });
        expect(harness.gl.drawArrays).toHaveBeenCalled();
    });

    it('releases textures on source disposal and destroy', async () => {
        const harness = createFakeWebGlContext();
        const renderer = new WebGlRenderer(createCanvas(harness.gl));

        await renderer.init();
        renderer.storeTile({
            sourceId: 3,
            header: { samples: 2, lines: 2 },
            tilePayload: createTilePayload(),
        });
        const texture = harness.gl.createTexture.mock.results.at(-1)?.value;
        renderer.disposeSource(3);
        expect(harness.textureDeleteMap.get(texture)).toHaveBeenCalledTimes(1);

        renderer.destroy();
        expect(harness.gl.deleteProgram).toHaveBeenCalled();
        expect(harness.gl.deleteBuffer).toHaveBeenCalled();
    });
});
