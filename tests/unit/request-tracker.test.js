import { describe, expect, it } from 'vitest';

import { isStaleSourceMessage, RequestTracker } from '../../src/runtime/request-tracker.js';

describe('request tracker lifecycle', () => {
    it('tracks and invalidates source-scoped request ids', () => {
        const tracker = new RequestTracker();

        tracker.track(7, 'tile:7:0,0');
        tracker.track(7, 'stats:7:1,2,3');
        tracker.track(8, 'tile:8:0,0');

        expect(tracker.has(7, 'tile:7:0,0')).toBe(true);
        expect(tracker.list(7)).toEqual(['tile:7:0,0', 'stats:7:1,2,3']);

        expect(tracker.release(7, 'tile:7:0,0')).toBe(true);
        expect(tracker.has(7, 'tile:7:0,0')).toBe(false);
        expect(tracker.list(7)).toEqual(['stats:7:1,2,3']);

        expect(tracker.invalidateSource(7)).toEqual(['stats:7:1,2,3']);
        expect(tracker.list(7)).toEqual([]);
        expect(tracker.list(8)).toEqual(['tile:8:0,0']);
    });

    it('identifies stale source messages against the active source id', () => {
        expect(isStaleSourceMessage(9, 8)).toBe(true);
        expect(isStaleSourceMessage(9, 9)).toBe(false);
        expect(isStaleSourceMessage(9, 0)).toBe(false);
    });
});
