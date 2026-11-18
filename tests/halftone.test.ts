import { describe, it, expect } from 'vitest';
import { alignmentCenters, makeQr, QrTooLongError, reservedMask } from '../src/lib/halftone/qr';
import {
  buildSvg,
  cellSizeFor,
  composeGrid,
  contrastRatio,
  dither,
  hexToRgb,
  totalCellsFor,
  applyTone,
  CELLS_PER_MODULE,
  QUIET_CELLS,
} from '../src/lib/halftone/render';
import { clampFocus, containRect, coverRect, panFocus } from '../src/lib/halftone/crop';

describe('reserved module mask', () => {
  const counts = [233, 266, 274, 282, 290, 298, 457, 465, 473, 481];

  it('covers the same modules as the reference for versions 1 to 10', () => {
    for (let version = 1; version <= 10; version += 1) {
      const mask = reservedMask(version);
      const count = mask.reduce((sum, value) => sum + value, 0);
      expect(count, `version ${version}`).toBe(counts[version - 1]);
      expect(mask.length).toBe((version * 4 + 17) ** 2);
    }
  });

  it('covers all 40 versions with the standard data module counts', () => {
    expect(reservedMask(40).reduce((sum, value) => sum + value, 0)).toBe(1681);
  });

  it('places alignment patterns where the standard says', () => {
    expect(alignmentCenters(1)).toEqual([]);
    expect(alignmentCenters(2)).toEqual([6, 18]);
    expect(alignmentCenters(7)).toEqual([6, 22, 38]);
    expect(alignmentCenters(32)).toEqual([6, 34, 60, 86, 112, 138]);
    expect(alignmentCenters(40)).toEqual([6, 30, 58, 86, 114, 142, 170]);
  });

  it('marks finders, separators, timing, format and the dark module', () => {
    const mask = reservedMask(4);
    const n = 33;
    expect(mask[0]).toBe(1);
    expect(mask[7 * n + 7]).toBe(1);
    expect(mask[8 * n + 8]).toBe(1);
    expect(mask[6 * n + 10]).toBe(1);
    expect(mask[10 * n + 6]).toBe(1);
    expect(mask[(n - 8) * n + 8]).toBe(1);
    expect(mask[20 * n + 20]).toBe(0);
  });

  it('marks version information only from version 7', () => {
    expect(reservedMask(6)[0 * 41 + 30]).toBe(0);
    expect(reservedMask(7)[0 * 45 + 34]).toBe(1);
  });
});

describe('QR generation', () => {
  it('builds the smallest code for a short string', () => {
    const qr = makeQr('hello', 'H');
    expect(qr.version).toBe(1);
    expect(qr.modules).toBe(21);
    expect(qr.dark.length).toBe(441);
    expect(qr.dark[0]).toBe(1);
    expect(qr.dark[7 * 21 + 7]).toBe(0);
  });

  it('builds a version 4 code for the site URL at H', () => {
    const qr = makeQr('https://prempoddar.is-a.dev', 'H');
    expect(qr.version).toBe(4);
    expect(qr.modules).toBe(33);
  });

  it('encodes UTF-8 text by byte length', () => {
    expect(makeQr('こんにちは', 'H').version).toBe(3);
    expect(makeQr('👋🏽 café', 'H').version).toBe(2);
  });

  it('honours a manual version', () => {
    const qr = makeQr('hello', 'H', 2);
    expect(qr.version).toBe(2);
    expect(qr.modules).toBe(25);
  });

  it('rejects text that does not fit', () => {
    expect(() => makeQr('x'.repeat(1500), 'H')).toThrow(QrTooLongError);
    expect(() => makeQr('x'.repeat(100), 'H', 1)).toThrow(QrTooLongError);
  });

  it('rejects a version outside the standard range', () => {
    expect(() => makeQr('hi', 'H', 41)).toThrow();
    expect(() => makeQr('hi', 'H', -1)).toThrow();
  });
});

describe('tone adjustment', () => {
  const input = new Float32Array([0, 64, 128, 192, 255]);

  it('leaves the image alone at the defaults', () => {
    expect(Array.from(applyTone(input, 0, 100))).toEqual([0, 64, 128, 192, 255]);
  });

  it('shifts brightness and clamps', () => {
    expect(Array.from(applyTone(input, 20, 100))).toEqual([20, 84, 148, 212, 255]);
  });

  it('applies contrast around the midpoint', () => {
    const low = Array.from(applyTone(input, 0, 50));
    const high = Array.from(applyTone(input, 0, 200));
    expect(low[1]).toBeCloseTo(96);
    expect(low[4]).toBeCloseTo(191.5);
    expect(high[1]).toBe(0);
    expect(high[4]).toBe(255);
  });

  it('returns a new buffer', () => {
    expect(applyTone(input, 0, 100)).not.toBe(input);
  });
});

describe('dithering', () => {
  it('thresholds at the midpoint', () => {
    const out = dither(new Float32Array([0, 100, 127, 128, 200, 255]), 6, 1, 'threshold');
    expect(Array.from(out)).toEqual([1, 1, 1, 0, 0, 0]);
  });

  it('makes an even ordered pattern from flat grey', () => {
    const bayer4 = dither(new Float32Array(16).fill(128), 4, 4, 'bayer4');
    const bayer8 = dither(new Float32Array(64).fill(128), 8, 8, 'bayer8');
    expect(bayer4.reduce((sum, value) => sum + value, 0)).toBe(8);
    expect(bayer8.reduce((sum, value) => sum + value, 0)).toBe(32);
  });

  it('keeps error diffusion between black and white', () => {
    for (const mode of ['floyd', 'atkinson'] as const) {
      const out = dither(new Float32Array(64).fill(128), 8, 8, mode);
      expect([...out].every((value) => value === 0 || value === 1)).toBe(true);
      const ones = out.reduce((sum, value) => sum + value, 0);
      expect(ones, mode).toBeGreaterThanOrEqual(24);
      expect(ones, mode).toBeLessThanOrEqual(40);
    }
  });

  it('rejects a buffer that does not match the size', () => {
    expect(() => dither(new Float32Array(3), 2, 2, 'threshold')).toThrow();
  });
});

describe('halftone composition', () => {
  const modules = 2;
  const size = modules * CELLS_PER_MODULE;

  it('keeps a dark image around a centre module', () => {
    const dark = new Uint8Array([1, 0, 0, 1]);
    const reserved = new Uint8Array([0, 0, 0, 0]);
    const out = composeGrid(dark, reserved, modules, new Uint8Array(size * size).fill(1));
    expect(out[1 * size + 1]).toBe(1);
    expect(out[1 * size + 0]).toBe(1);
    expect(out[4 * size + 4]).toBe(1);
    expect(out[4 * size + 3]).toBe(1);
  });

  it('forces a light centre into a bright image', () => {
    const dark = new Uint8Array([0, 0, 0, 1]);
    const reserved = new Uint8Array([0, 0, 0, 0]);
    const out = composeGrid(dark, reserved, modules, new Uint8Array(size * size));
    expect(out[4 * size + 1]).toBe(0);
    expect(out[3 * size + 1]).toBe(0);
  });

  it('fills a reserved module with the module value', () => {
    const dark = new Uint8Array([1, 0, 0, 1]);
    const reserved = new Uint8Array([0, 1, 0, 0]);
    const out = composeGrid(dark, reserved, modules, new Uint8Array(size * size).fill(1));
    for (let y = 0; y < 3; y += 1) {
      for (let x = 3; x < 6; x += 1) expect(out[y * size + x]).toBe(0);
    }
  });

  it('rejects mismatched buffers', () => {
    expect(() => composeGrid(new Uint8Array(2), new Uint8Array(4), 2, new Uint8Array(36))).toThrow();
    expect(() => composeGrid(new Uint8Array(4), new Uint8Array(4), 2, new Uint8Array(4))).toThrow();
  });
});

describe('image framing', () => {
  it('covers a wide image and centres it', () => {
    expect(coverRect(100, 50, 100, 1, 0.5, 0.5)).toEqual({ x: -50, y: 0, w: 200, h: 100 });
  });

  it('zooms around the focus point', () => {
    expect(coverRect(100, 50, 100, 2, 0.5, 0.5)).toEqual({ x: -150, y: -50, w: 400, h: 200 });
    expect(coverRect(100, 50, 100, 1, 0, 0)).toEqual({ x: 0, y: 0, w: 200, h: 100 });
    expect(coverRect(100, 50, 100, 1, 1, 1)).toEqual({ x: -100, y: 0, w: 200, h: 100 });
  });

  it('contains the whole image with light bars', () => {
    expect(containRect(100, 50, 100)).toEqual({ x: 0, y: 25, w: 100, h: 50 });
  });

  it('turns a drag into a focus move and clamps at the edges', () => {
    expect(panFocus(0.5, 0.5, 10, -5, 100, 50)).toEqual({ x: 0.4, y: 0.6 });
    expect(panFocus(0.5, 0.5, 1000, 1000, 100, 50)).toEqual({ x: 0, y: 0 });
    expect(panFocus(0.5, 0.5, -1000, -1000, 100, 50)).toEqual({ x: 1, y: 1 });
    expect(panFocus(0.5, 0.5, 10, 10, 0, 0)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('clamps focus values', () => {
    expect(clampFocus(-1)).toBe(0);
    expect(clampFocus(2)).toBe(1);
    expect(clampFocus(0.25)).toBe(0.25);
  });
});

describe('export sizing', () => {
  it('keeps whole cells near the requested size', () => {
    expect(cellSizeFor(2048, 123)).toBe(17);
    expect(cellSizeFor(1024, 123)).toBe(8);
    expect(cellSizeFor(100, 1000)).toBe(2);
  });

  it('counts the quiet zone in cells', () => {
    expect(CELLS_PER_MODULE).toBe(3);
    expect(QUIET_CELLS).toBe(12);
    expect(totalCellsFor(33, true)).toBe(123);
    expect(totalCellsFor(33, false)).toBe(99);
  });
});

describe('colour', () => {
  it('parses short and long hex colours', () => {
    expect(hexToRgb('#15201a')).toEqual([21, 32, 26]);
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(() => hexToRgb('#12345')).toThrow();
  });

  it('measures contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
    expect(contrastRatio('#15201a', '#fdfdfb')).toBeGreaterThan(10);
  });
});

describe('SVG export', () => {
  const base = {
    modules: 1,
    ink: '#112233',
    paper: '#ffffff',
    transparent: false,
    quietZone: false,
  };

  it('draws runs as one path with a paper background', () => {
    const svg = buildSvg({ ...base, grid: new Uint8Array(9).fill(1) });
    expect(svg).toContain('viewBox="0 0 3 3"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<rect width="3" height="3" fill="#ffffff"/>');
    expect(svg).toContain('d="M0 0h3v1h-3zM0 1h3v1h-3zM0 2h3v1h-3z"');
    expect(svg).toContain('fill="#112233"');
  });

  it('leaves the background out when transparent', () => {
    const svg = buildSvg({ ...base, transparent: true, grid: new Uint8Array(9).fill(1) });
    expect(svg).not.toContain('<rect width="3"');
    expect(svg).toContain('<path');
  });

  it('adds the quiet zone around the grid', () => {
    const svg = buildSvg({ ...base, quietZone: true, grid: new Uint8Array(9).fill(1) });
    expect(svg).toContain('viewBox="0 0 27 27"');
    expect(svg).toContain('d="M12 12h3v1h-3z');
  });

  it('omits the path when nothing is dark', () => {
    const svg = buildSvg({ ...base, grid: new Uint8Array(9) });
    expect(svg).not.toContain('<path');
  });

  it('rejects a grid that does not match the module count', () => {
    expect(() => buildSvg({ ...base, grid: new Uint8Array(8) })).toThrow();
  });
});
