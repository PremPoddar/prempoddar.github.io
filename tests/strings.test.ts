import { describe, it, expect } from 'vitest';
import { stringPath, resolveStrings } from '../src/lib/canvas/strings';

describe('strings', () => {
  it('drops links whose ends are not on the desk', () => {
    const ids = new Set(['a', 'b', 'c']);
    expect(resolveStrings([['a', 'b'], ['a', 'draft-post'], ['c', 'a']], ids)).toEqual([['a', 'b'], ['c', 'a']]);
  });

  it('returns no strings when nothing connects', () => {
    expect(resolveStrings([['x', 'y']], new Set())).toEqual([]);
  });

  it('draws a curve between facing edges', () => {
    const d = stringPath({ x: 0, y: 0, w: 100, h: 50 }, { x: 300, y: 0, w: 100, h: 50 });
    expect(d.startsWith('M 100 25 C')).toBe(true);
    expect(d.endsWith('300 25')).toBe(true);
  });

  it('uses top and bottom edges when cards are stacked', () => {
    const d = stringPath({ x: 0, y: 0, w: 100, h: 50 }, { x: 0, y: 300, w: 100, h: 50 });
    expect(d.startsWith('M 50 50 C')).toBe(true);
    expect(d.endsWith('50 300')).toBe(true);
  });
});
