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

    it('normalizes array map info with southern UTM metadata and units assignments', () => {
        const spatialReference = normalizeSpatialReference({
            mapInfo: [
                'UTM',
                '1.0',
                '1.0',
                '402000',
                '7231000',
                '5',
                '5',
                '48',
                'South',
                'WGS-84',
                'units = Meters',
            ],
        });

        expect(spatialReference?.mapInfo).toEqual({
            projectionName: 'UTM',
            referencePixel: { x: 1, y: 1 },
            referenceCoordinate: { x: 402000, y: 7231000 },
            pixelSize: { x: 5, y: 5 },
            zone: 48,
            hemisphere: 'South',
            datum: 'WGS-84',
            units: 'Meters',
            rawTokens: ['UTM', '1.0', '1.0', '402000', '7231000', '5', '5', '48', 'South', 'WGS-84', 'units = Meters'],
        });
        expect(spatialReference?.affineTransform).toEqual([402000, 5, 0, 7231000, 0, -5]);
    });

    it('keeps datum and units for non-UTM ENVI map info without zone and hemisphere tokens', () => {
        const spatialReference = normalizeSpatialReference({
            mapInfo: 'Geographic Lat/Lon, 1, 1, -117.25, 34.5, 0.00025, 0.00025, WGS-84, units=Degrees',
        });

        expect(spatialReference?.mapInfo).toEqual({
            projectionName: 'Geographic Lat/Lon',
            referencePixel: { x: 1, y: 1 },
            referenceCoordinate: { x: -117.25, y: 34.5 },
            pixelSize: { x: 0.00025, y: 0.00025 },
            zone: undefined,
            hemisphere: undefined,
            datum: 'WGS-84',
            units: 'Degrees',
            rawTokens: ['Geographic Lat/Lon', '1', '1', '-117.25', '34.5', '0.00025', '0.00025', 'WGS-84', 'units=Degrees'],
        });
        expect(pixelToWorld(spatialReference, 2, 3)).toEqual({ x: -117.2495, y: 34.49925 });
    });

    it('preserves assignment-style map info tokens without treating them as datum', () => {
        const spatialReference = normalizeSpatialReference({
            mapInfo: 'UTM, 1, 1, 500000, 4100000, 30, 30, 50, North, WGS-84, units=Meters, rotation=0.25',
        });

        expect(spatialReference?.mapInfo?.datum).toBe('WGS-84');
        expect(spatialReference?.mapInfo?.units).toBe('Meters');
        expect(spatialReference?.mapInfo?.rawTokens).toContain('rotation=0.25');
        expect(spatialReference?.affineTransform).toEqual([500000, 30, 0, 4100000, 0, -30]);
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
