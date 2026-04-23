import { describe, expect, it } from 'vitest';

import {
    applyRendererLogMessage,
    createRendererStatus,
    getActionableErrors,
} from '../../examples/demo/renderer-status.js';

describe('renderer status helpers', () => {
    it('tracks initialization and recovery log messages', () => {
        const status = createRendererStatus('auto');

        applyRendererLogMessage(status, 'Renderer initialization completed (webgpu).');
        expect(status).toMatchObject({
            preference: 'auto',
            activeKind: 'webgpu',
            lastStage: 'initialized',
            fallbackMode: false,
        });

        applyRendererLogMessage(status, 'Auto renderer will prefer WebGL after WebGPU device loss.');
        applyRendererLogMessage(status, 'Renderer recovered after device loss (webgl, fallback mode).');

        expect(status).toMatchObject({
            activeKind: 'webgl',
            lastStage: 'recovered',
            fallbackMode: true,
            fallbackArmed: true,
            degradedFrom: 'webgpu',
            nextKind: 'webgl',
        });
    });

    it('filters known non-actionable WebGPU adapter recovery noise', () => {
        expect(getActionableErrors([
            'Renderer recovery failed: Failed to acquire WebGPU adapter',
            'Unexpected render failure',
        ])).toEqual([
            'Unexpected render failure',
        ]);
    });
});
