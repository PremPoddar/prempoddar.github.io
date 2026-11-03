import { describe, it, expect } from 'vitest';
import { clampView, fitScale, zoomAt } from '../src/lib/canvas/viewport';

const desk = { x: 0, y: 0, w: 2200, h: 1600 };

describe('clampView', () => {
  it('stops the desk from being dragged off to the left or top', () => {
    const v = clampView({ x: -5000, y: -5000, scale: 1 }, desk, 1440, 900, 120);
    expect(v.x).toBe(1440 - 120 - 2200);
    expect(v.y).toBe(900 - 120 - 1600);
  });

  it('stops the desk from being dragged off to the right or bottom', () => {
    const v = clampView({ x: 5000, y: 5000, scale: 1 }, desk, 1440, 900, 120);
    expect(v).toEqual({ x: 120, y: 120, scale: 1 });
  });

  it('leaves a view inside the limits alone', () => {
    const v = { x: -300, y: -200, scale: 1 };
    expect(clampView(v, desk, 1440, 900, 120)).toEqual(v);
  });

  it('centres the desk on an axis where it is smaller than the screen', () => {
    const v = clampView({ x: 900, y: 0, scale: 0.4 }, desk, 1440, 900, 120);
    expect(v.x).toBeCloseTo((1440 - 2200 * 0.4) / 2);
  });
});

describe('fitScale', () => {
  it('is the zoom at which the whole desk fits', () => {
    expect(fitScale(desk, 1440, 900, 50)).toBeCloseTo(Math.min(1340 / 2200, 800 / 1600));
  });

  it('never goes above 1 or below 0.2', () => {
    expect(fitScale(desk, 10000, 10000, 0)).toBe(1);
    expect(fitScale(desk, 100, 100, 0)).toBe(0.2);
  });
});

describe('zoomAt with a custom minimum', () => {
  it('stops at the given minimum', () => {
    let v = { x: 0, y: 0, scale: 1 };
    for (let i = 0; i < 50; i++) v = zoomAt(v, 0.5, 0, 0, 0.5);
    expect(v.scale).toBe(0.5);
  });
});
