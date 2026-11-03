import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { lintCopy } from '../scripts/copy-lint.mjs';

function files(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return files(full, exts);
    return exts.some((e) => name.endsWith(e)) ? [full] : [];
  });
}

describe('lintCopy', () => {
  it('flags em and en dashes', () => {
    expect(lintCopy('a — b').length).toBeGreaterThan(0);
    expect(lintCopy('1–2').length).toBeGreaterThan(0);
  });

  it('flags giveaway words as whole words', () => {
    expect(lintCopy('we leverage it').length).toBeGreaterThan(0);
    expect(lintCopy('Seamless sync').length).toBeGreaterThan(0);
    expect(lintCopy('a robust engine').length).toBeGreaterThan(0);
    expect(lintCopy('robustness')).toEqual([]);
  });

  it('flags "not just X, but Y"', () => {
    expect(lintCopy("It's not just fast, but also small").length).toBeGreaterThan(0);
  });

  it('flags the phone number and yandex', () => {
    expect(lintCopy('call 98674 70257').length).toBeGreaterThan(0);
    expect(lintCopy('me@yandex.com').length).toBeGreaterThan(0);
  });

  it('passes plain copy', () => {
    expect(lintCopy('I built this because my phone had no signal at a festival.')).toEqual([]);
  });
});

describe('site copy', () => {
  const all = [...files('src/content', ['.md', '.yaml']), ...files('src/data', ['.ts'])];

  it('has content to check', () => {
    expect(all.length).toBeGreaterThan(10);
  });

  for (const file of all) {
    it(`${file} reads like a person wrote it`, () => {
      expect(lintCopy(readFileSync(file, 'utf8'))).toEqual([]);
    });
  }
});
