import { describe, it, expect } from 'vitest';
import { clampView, fitScale, homeView, zoomAt } from '../src/lib/canvas/viewport';

const desk = { x: 0, y: 0, w: 2200, h: 1600 };

describe('clampView', () => {
  it('lets the desk go until only a strip is left on the left or top', () => {
    const v = clampView({ x: -5000, y: -5000, scale: 1 }, desk, 1440, 900, 200);
    expect(v.x).toBe(200 - 2200);
    expect(v.y).toBe(200 - 1600);
  });

  it('lets the desk go until only a strip is left on the right or bottom', () => {
    const v = clampView({ x: 5000, y: 5000, scale: 1 }, desk, 1440, 900, 200);
    expect(v).toEqual({ x: 1440 - 200, y: 900 - 200, scale: 1 });
  });

  it('allows content right up to the screen edge', () => {
    const v = { x: 1200, y: -1300, scale: 1 };
    expect(clampView(v, desk, 1440, 900, 200)).toEqual(v);
  });

  it('works at other zoom levels', () => {
    const v = clampView({ x: -5000, y: 0, scale: 0.5 }, desk, 1440, 900, 200);
    expect(v.x).toBe(200 - 2200 * 0.5);
  });
});

describe('homeView', () => {
  const start = { x: 0, y: 30, w: 1640, h: 840 };

  it('opens at 100%', () => {
    expect(homeView(start, 1440, 900, 48).scale).toBe(1);
  });

  it('starts from the top left of the opening area when it is wider than the screen', () => {
    const v = homeView(start, 1440, 900, 48);
    expect(v.x).toBe(48);
    expect(v.y).toBe(48 - 30);
  });

  it('centres the opening area when the screen is wider', () => {
    const v = homeView(start, 2000, 1200, 48);
    expect(v.x).toBe((2000 - 1640) / 2);
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
