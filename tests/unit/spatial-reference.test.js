import { describe, expect, it } from 'vitest';

import {
    normalizeSpatialReference,
    pixelToWorld,
    worldToPixel,
} from '../../src/spatial/coordinate-mapper.js';

describe('spatial reference normalization and affine mapping', () => {
    it('normalizes ENVI map info into structured metadata and an affine transform', () => {
        const spatialReference = normalizeSpatialReference({
            mapInfo: 'UTM, 1, 1, 500000, 4100000, 30, 30, 50, North, WGS-84, units=Meters',
            coordinateSystemString: 'PROJCS["WGS 84 / UTM zone 50N"]',
        });

        expect(spatialReference).toEqual({
            affineTransform: [500000, 30, 0, 4100000, 0, -30],
            epsg: undefined,
            coordinateSystemString: 'PROJCS["WGS 84 / UTM zone 50N"]',
            mapInfo: {
                projectionName: 'UTM',
                referencePixel: { x: 1, y: 1 },
                referenceCoordinate: { x: 500000, y: 4100000 },
                pixelSize: { x: 30, y: 30 },
                zone: 50,
                hemisphere: 'North',
                datum: 'WGS-84',
                units: 'Meters',
                rawTokens: ['UTM', '1', '1', '500000', '4100000', '30', '30', '50', 'North', 'WGS-84', 'units=Meters'],
            },
        });
    });

    it('maps zero-based image pixels into world coordinates and back', () => {
        const spatialReference = normalizeSpatialReference({
            affineTransform: [500000, 30, 0, 4100000, 0, -30],
        });

        expect(pixelToWorld(spatialReference, 2, 3)).toEqual({ x: 500060, y: 4099910 });
        expect(worldToPixel(spatialReference, 500060, 4099910)).toEqual({ x: 2, y: 3 });
    });

    it('returns null when spatial metadata is missing or the affine transform is singular', () => {
        expect(pixelToWorld(undefined, 1, 1)).toBeNull();
        expect(worldToPixel({ affineTransform: [0, 1, 2, 3, 2, 4] }, 5, 6)).toBeNull();
    });
});
