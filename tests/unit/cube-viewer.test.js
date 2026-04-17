/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const viewerInstances = [];

class InternalViewerMock {
    constructor(canvas, options) {
        this.canvas = canvas;
        this.options = options;
        this.listeners = new Map();
        this.init = vi.fn(async () => {});
        this.load = vi.fn(async () => {});
        this.unload = vi.fn(async () => {});
        this.setBands = vi.fn();
        this.updateConfig = vi.fn();
        this.getSpectralProfile = vi.fn(async () => new Float32Array([1, 2, 3]));
        this.destroy = vi.fn();
        viewerInstances.push(this);
    }

    on(eventName, listener) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName).push(listener);
    }

    emit(eventName, payload) {
        for (const listener of this.listeners.get(eventName) ?? []) {
            listener(payload);
        }
    }
}

vi.mock('../../src/runtime/viewer-runtime.js', () => ({
    ViewerRuntime: InternalViewerMock,
}));

const {
    CubeViewer,
    EnviViewer,
    default: DefaultCubeViewer,
} = await import('../../src/cube-viewer.js');

function createFile(name, content) {
    const bytes = typeof content === 'string'
        ? new TextEncoder().encode(content)
        : Uint8Array.from(content);

    return {
        name,
        size: bytes.byteLength,
        async arrayBuffer() {
            return bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength
            );
        }
    };
}

describe('CubeViewer public wrapper', () => {
    beforeEach(() => {
        viewerInstances.length = 0;
        document.body.innerHTML = '';
    });

    it('normalizes source-based loads before delegating to the internal viewer', async () => {
        const container = document.createElement('div');
        const viewer = new DefaultCubeViewer(container);
        const internal = viewerInstances.at(-1);
        const headerFile = createFile('cube.hdr', 'ENVI');
        const dataFile = createFile('cube.img', new Uint8Array([1, 2, 3]));

        await viewer.load({ kind: 'envi-local', headerFile, dataFile });

        expect(internal.load).toHaveBeenCalledWith({
            kind: 'envi-local',
            headerFile,
            dataFile,
        });
    });

    it('keeps loadFile as a compatibility alias', async () => {
        const container = document.createElement('div');
        const viewer = new CubeViewer(container);
        const internal = viewerInstances.at(-1);
        const headerFile = createFile('cube.hdr', 'ENVI');
        const dataFile = createFile('cube.img', new Uint8Array([1]));

        await viewer.loadFile(headerFile, dataFile);

        expect(internal.load).toHaveBeenCalledWith({
            kind: 'envi-local',
            headerFile,
            dataFile,
        });
    });

    it('forwards stable event aliases and tracks header state', async () => {
        const container = document.createElement('div');
        const viewer = new EnviViewer(container);
        const internal = viewerInstances.at(-1);
        const headerSpy = vi.fn();
        const bandsSpy = vi.fn();
        const header = { bands: 32, samples: 48, lines: 48 };
        const bands = { r: 30, g: 20, b: 10 };

        viewer.on('header', headerSpy);
        viewer.on('bandschange', bandsSpy);

        internal.emit('headerloaded', header);
        internal.emit('bandschanged', bands);

        expect(viewer.getHeader()).toEqual(header);
        expect(headerSpy).toHaveBeenCalledWith(header);
        expect(bandsSpy).toHaveBeenCalledWith(bands);
    });

    it('forwards unload and clears wrapper header state', async () => {
        const container = document.createElement('div');
        const viewer = new CubeViewer(container);
        const internal = viewerInstances.at(-1);
        internal.emit('headerloaded', { bands: 32 });

        expect(viewer.getHeader()).toEqual({ bands: 32 });

        await viewer.unload();

        expect(internal.unload).toHaveBeenCalledTimes(1);
        expect(viewer.getHeader()).toBeNull();
    });

    it('keeps EnviViewer as a compatibility export alias', () => {
        expect(EnviViewer).toBe(CubeViewer);
        expect(DefaultCubeViewer).toBe(CubeViewer);
    });
});
