import { describe, expect, it } from 'vitest';

import { createWorkerCancelRegistry } from '../../src/runtime/worker-cancel-registry.js';

describe('worker cancel registry', () => {
    it('marks and consumes request-scoped cancellation safely', () => {
        const registry = createWorkerCancelRegistry();

        expect(registry.cancel(5, 'tile:5:0,0')).toBe(true);
        expect(registry.isCanceled(5, 'tile:5:0,0')).toBe(true);
        expect(registry.consume(5, 'tile:5:0,0')).toBe(true);
        expect(registry.isCanceled(5, 'tile:5:0,0')).toBe(false);
    });

    it('keeps cancellation source-scoped and supports source clearing', () => {
        const registry = createWorkerCancelRegistry();

        registry.cancel(5, 'tile:5:0,0');
        registry.cancel(5, 'stats:5:1,2,3');
        registry.cancel(6, 'tile:6:0,0');

        expect(registry.isCanceled(5, 'tile:5:0,0')).toBe(true);
        expect(registry.isCanceled(6, 'tile:6:0,0')).toBe(true);

        expect(registry.clearSource(5)).toBe(true);
        expect(registry.isCanceled(5, 'tile:5:0,0')).toBe(false);
        expect(registry.isCanceled(5, 'stats:5:1,2,3')).toBe(false);
        expect(registry.isCanceled(6, 'tile:6:0,0')).toBe(true);
    });
});
