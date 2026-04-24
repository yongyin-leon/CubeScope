import { describe, expect, it } from 'vitest';

import {
    createDefaultBandsForHeader,
    ensureBandsForHeader,
    normalizeViewerBands,
    uniqueBands,
} from '../../src/runtime/band-selection.js';

describe('band-selection helpers', () => {
    it('keeps the hyperspectral default when the source has enough bands', () => {
        expect(createDefaultBandsForHeader({ bands: 32 })).toEqual({
            r: 30,
            g: 20,
            b: 10,
        });
    });

    it('chooses safe defaults for lower-band sources', () => {
        expect(createDefaultBandsForHeader({ bands: 16 })).toEqual({
            r: 16,
            g: 8,
            b: 1,
        });
        expect(createDefaultBandsForHeader({ bands: 3 })).toEqual({
            r: 3,
            g: 2,
            b: 1,
        });
        expect(createDefaultBandsForHeader({ bands: 2 })).toEqual({
            r: 2,
            g: 1,
            b: 1,
        });
        expect(createDefaultBandsForHeader({ bands: 1 })).toEqual({
            r: 1,
            g: 1,
            b: 1,
        });
    });

    it('falls back to safe defaults when current bands are out of range', () => {
        expect(ensureBandsForHeader({ r: 30, g: 20, b: 10 }, { bands: 16 })).toEqual({
            bands: {
                r: 16,
                g: 8,
                b: 1,
            },
            changed: true,
        });
    });

    it('normalizes valid band inputs and rejects invalid values', () => {
        expect(normalizeViewerBands({ r: '3', g: 2, b: 1 }, { bands: 3 })).toEqual({
            r: 3,
            g: 2,
            b: 1,
        });
        expect(() => normalizeViewerBands({ r: 0, g: 2, b: 1 }, { bands: 3 })).toThrow(RangeError);
        expect(() => normalizeViewerBands({ r: 4, g: 2, b: 1 }, { bands: 3 })).toThrow(RangeError);
        expect(() => normalizeViewerBands({ r: 1.5, g: 2, b: 1 }, { bands: 3 })).toThrow(TypeError);
    });

    it('deduplicates bands before stats planning', () => {
        expect(uniqueBands([1, 1, '2', 0, 'x', 3])).toEqual([1, 2, 3]);
    });
});
