import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { revealPan, keyToAction } from '../src/lib/canvas/viewport';
import { lintCopy } from '../scripts/copy-lint.mjs';

describe('revealPan', () => {
  const vp = { x: 0, y: 0, w: 1000, h: 800 };

  it('pans a card that is up and to the left back into view', () => {
    expect(revealPan({ x: -700, y: -500, w: 300, h: 200 }, vp, 60)).toEqual({ dx: 760, dy: 560 });
  });

  it('pans a card that is down and to the right back into view', () => {
    expect(revealPan({ x: 900, y: 750, w: 300, h: 200 }, vp, 60)).toEqual({ dx: -260, dy: -210 });
  });

  it('leaves a visible card alone', () => {
    expect(revealPan({ x: 100, y: 100, w: 300, h: 200 }, vp, 60)).toEqual({ dx: 0, dy: 0 });
  });
});

describe('keyToAction', () => {
  const k = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) =>
    keyToAction({ key, ctrlKey: false, metaKey: false, altKey: false, ...mods });

  it('maps plain keys', () => {
    expect(k('ArrowLeft')).toEqual({ pan: [80, 0] });
    expect(k('+')).toEqual({ zoom: 1.25 });
    expect(k('-')).toEqual({ zoom: 0.8 });
    expect(k('0')).toEqual({ home: true });
    expect(k('a')).toBeNull();
  });

  it('leaves browser shortcuts alone', () => {
    expect(k('+', { ctrlKey: true })).toBeNull();
    expect(k('0', { metaKey: true })).toBeNull();
    expect(k('-', { ctrlKey: true })).toBeNull();
    expect(k('ArrowLeft', { altKey: true })).toBeNull();
  });
});

describe('copy rules', () => {
  it('flags "wasn\'t X, it was Y"', () => {
    expect(lintCopy("The question wasn't which is best. It was which will work.").length).toBeGreaterThan(0);
    expect(lintCopy("It isn't a toy, it's a tool.").length).toBeGreaterThan(0);
    expect(lintCopy("It wasn't hard.")).toEqual([]);
  });

  it('does not promise posts that are not published', () => {
    const drafts = new Set(
      readdirSync('src/content/writing')
        .filter((f) => /draft:\s*true/.test(readFileSync(`src/content/writing/${f}`, 'utf8')))
        .map((f) => f.replace(/\.md$/, '')),
    );
    for (const f of readdirSync('src/content/apps')) {
      const text = readFileSync(`src/content/apps/${f}`, 'utf8');
      const promises = /\bI wrote\b|\bseparate post\b/i.test(text);
      const related = (text.match(/related: \[(.*)\]/)?.[1] ?? '').split(',').map((s) => s.trim());
      const hasPublished = related.some((r) => r && !drafts.has(r) && readdirSync('src/content/writing').includes(`${r}.md`));
      if (promises) expect({ file: f, hasPublished }).toEqual({ file: f, hasPublished: true });
    }
  });
});
