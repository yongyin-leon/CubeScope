import { describe, expect, it, vi } from 'vitest';

import { RenderSession } from '../../src/runtime/render-session.js';

describe('RenderSession', () => {
    it('maps canvas coordinates back into zero-based image pixels', () => {
        const session = new RenderSession();
        const pixel = session.canvasPointToPixel({
            canvasX: 128,
            canvasY: 128,
            canvasWidth: 256,
            canvasHeight: 256,
            header: {
                samples: 256,
                lines: 256,
            },
        });

        expect(pixel).toEqual({ x: 128, y: 128 });
    });

    it('tracks transition slot lifecycle through the renderer seam', () => {
        const renderer = {
            clearSlot: vi.fn(),
            swapSlot: vi.fn(),
        };
        const session = new RenderSession();

        expect(session.beginTransition({ renderer, sourceId: 5 })).toBe(true);
        session.setTransitionTileCount(2);
        session.markCurrentTileLoaded('0,0');

        expect(session.isTransitioning()).toBe(true);
        expect(session.getCurrentRenderSlot()).toBe('transition');
        expect(session.consumeTransitionTile()).toBe(1);

        session.completeTransition({ renderer, sourceId: 5 });

        expect(renderer.clearSlot).toHaveBeenCalledWith({ sourceId: 5, slot: 'transition' });
        expect(renderer.swapSlot).toHaveBeenCalledWith({
            sourceId: 5,
            from: 'transition',
            to: 'active',
        });
        expect(session.isTransitioning()).toBe(false);
        expect(session.hasActiveTile('0,0')).toBe(true);
    });

    it('clamps pan offsets when zoomed', () => {
        const session = new RenderSession();
        session.zoomAround({
            zoomFactor: 1.2,
            anchorX: 0,
            anchorY: 0,
        });

        const moved = session.panBy({
            dx: 10,
            dy: -10,
            aspect: { x: 0.5, y: 0.25 },
        });

        expect(moved).toBe(true);
        expect(session.getViewState()).toEqual({
            scale: 1.2,
            offsetX: 0.09999999999999998,
            offsetY: 0.04999999999999999,
        });
    });

    it('reports normalized visible bounds for minimap linkage', () => {
        const session = new RenderSession();
        session.zoomAround({
            zoomFactor: 2,
            anchorX: 0,
            anchorY: 0,
        });
        expect(session.getVisibleBounds({
            header: { samples: 100, lines: 100 },
            canvasWidth: 500,
            canvasHeight: 500,
        })).toEqual({
            x: 0.25,
            y: 0.25,
            width: 0.5,
            height: 0.5,
        });
    });
});
