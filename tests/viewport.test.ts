import { describe, it, expect } from 'vitest';
import { clampScale, zoomAt, pan, wheelToZoomFactor, fitView, MIN_SCALE, MAX_SCALE, type View } from '../src/lib/canvas/viewport';

const toWorld = (v: View, px: number, py: number) => ({ x: (px - v.x) / v.scale, y: (py - v.y) / v.scale });

describe('viewport', () => {
  it('clamps scale to the allowed range', () => {
    expect(clampScale(0.01)).toBe(MIN_SCALE);
    expect(clampScale(50)).toBe(MAX_SCALE);
    expect(clampScale(1)).toBe(1);
    expect(MIN_SCALE).toBe(0.4);
    expect(MAX_SCALE).toBe(2);
  });

  it('keeps the point under the cursor fixed while zooming', () => {
    const v: View = { x: 120, y: -40, scale: 0.8 };
    const before = toWorld(v, 300, 200);
    const after = toWorld(zoomAt(v, 1.3, 300, 200), 300, 200);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it('stays within limits under repeated zooming', () => {
    let v: View = { x: 0, y: 0, scale: 1 };
    for (let i = 0; i < 100; i++) v = zoomAt(v, 1.5, 10, 10);
    expect(v.scale).toBe(MAX_SCALE);
    for (let i = 0; i < 100; i++) v = zoomAt(v, 0.5, 10, 10);
    expect(v.scale).toBe(MIN_SCALE);
  });

  it('does not move the view when zoom is already at a limit', () => {
    const v: View = { x: 50, y: 60, scale: MAX_SCALE };
    expect(zoomAt(v, 2, 300, 300)).toEqual(v);
  });

  it('pans by screen pixels', () => {
    expect(pan({ x: 10, y: 20, scale: 2 }, 5, -5)).toEqual({ x: 15, y: 15, scale: 2 });
  });

  it('turns wheel deltas into zoom factors', () => {
    expect(wheelToZoomFactor(100, false)).toBeLessThan(1);
    expect(wheelToZoomFactor(-100, false)).toBeGreaterThan(1);
    expect(wheelToZoomFactor(10, true)).toBeLessThan(wheelToZoomFactor(10, false));
    expect(wheelToZoomFactor(100000, false)).toBe(0.5);
    expect(wheelToZoomFactor(-100000, true)).toBe(2);
  });

  it('fits and centres bounds in the viewport', () => {
    const v = fitView({ x: 100, y: 100, w: 1000, h: 500 }, 1200, 800, 100);
    expect(v.scale).toBe(1);
    const centre = toWorld(v, 600, 400);
    expect(centre.x).toBeCloseTo(600);
    expect(centre.y).toBeCloseTo(350);
  });

  it('shrinks to fit a small viewport but never below the minimum', () => {
    expect(fitView({ x: 0, y: 0, w: 2000, h: 1000 }, 1100, 700, 50).scale).toBeCloseTo(0.5);
    expect(fitView({ x: 0, y: 0, w: 20000, h: 10000 }, 400, 400, 0).scale).toBe(MIN_SCALE);
  });
});
