import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkDist } from '../scripts/check-dist.mjs';

let dir: string;

function put(path: string, content: string) {
  const full = join(dir, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
}

const page = (body: string) => `<!doctype html><html><body>${body}</body></html>`;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dist-'));
  put('CNAME', 'prempoddar.is-a.dev\n');
  put('index.html', page('<p>Hello</p>'));
});

describe('checkDist', () => {
  it('passes a clean dist', () => {
    expect(checkDist(dir)).toEqual([]);
  });

  it('flags the phone number in any spacing', () => {
    for (const phone of ['+91 98674 70257', '98674-70257', '9867470257']) {
      put('index.html', page(`<p>${phone}</p>`));
      expect(checkDist(dir).length).toBeGreaterThan(0);
    }
  });

  it('flags yandex', () => {
    put('index.html', page('<a href="mailto:prempoddar@yandex.com">mail</a>'));
    expect(checkDist(dir).length).toBeGreaterThan(0);
  });

  it('flags em and en dashes in page text', () => {
    put('index.html', page('<p>a — b</p>'));
    expect(checkDist(dir).length).toBeGreaterThan(0);
    put('index.html', page('<p>1–2</p>'));
    expect(checkDist(dir).length).toBeGreaterThan(0);
  });

  it('ignores dashes inside script and style', () => {
    put('index.html', page('<script>const a = "—";</script><style>a::after{content:"–"}</style>'));
    expect(checkDist(dir)).toEqual([]);
  });

  it('flags noxdrop outside the toolbox', () => {
    put('apps/oaf/index.html', page('<a href="https://noxdrop.com">x</a>'));
    expect(checkDist(dir).length).toBeGreaterThan(0);
  });

  it('allows noxdrop in the toolbox', () => {
    put('toolbox/index.html', page('<a href="https://noxdrop.com">NoxDrop</a>'));
    expect(checkDist(dir)).toEqual([]);
  });

  it('allows the CaffeinateCat page on noxdrop anywhere', () => {
    put('apps/caffeinatecat/index.html', page('<a href="https://www.noxdrop.com/caffeinatecat.html">site</a>'));
    expect(checkDist(dir)).toEqual([]);
  });

  it('flags reserved top-level folders', () => {
    put('duet/index.html', page('<p>x</p>'));
    expect(checkDist(dir).length).toBeGreaterThan(0);
  });

  it('requires a correct CNAME', () => {
    put('CNAME', 'example.com\n');
    expect(checkDist(dir).length).toBeGreaterThan(0);
  });

  it('never scans PDFs', () => {
    put('resume/prem-poddar-resume.pdf', '+91 98674 70257');
    expect(checkDist(dir)).toEqual([]);
  });
});
