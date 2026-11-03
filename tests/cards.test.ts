import { describe, it, expect, vi } from 'vitest';
import { arrowAngle } from '../src/lib/cards/loadstone';
import { createWakeLock } from '../src/lib/cards/wakelock';
import { searchBrew } from '../src/lib/cards/brew';

describe('arrowAngle', () => {
  it('measures clockwise from straight up', () => {
    expect(arrowAngle({ x: 0, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(0);
    expect(arrowAngle({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90);
    expect(arrowAngle({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(180);
    expect(arrowAngle({ x: 0, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(270);
  });
});

function fakeDoc() {
  const listeners: (() => void)[] = [];
  return {
    visibilityState: 'visible',
    addEventListener: (_t: 'visibilitychange', f: () => void) => listeners.push(f),
    fire() { listeners.forEach((f) => f()); },
  };
}

function fakeNav() {
  const sentinels: { released: boolean; onRelease?: () => void; release: () => Promise<void>; addEventListener: (t: 'release', f: () => void) => void }[] = [];
  const request = vi.fn(async () => {
    const s = {
      released: false,
      onRelease: undefined as undefined | (() => void),
      async release() { s.released = true; s.onRelease?.(); },
      addEventListener(_t: 'release', f: () => void) { s.onRelease = f; },
    };
    sentinels.push(s);
    return s;
  });
  return { nav: { wakeLock: { request } }, request, sentinels };
}

describe('createWakeLock', () => {
  it('reports when the browser has no wake lock', async () => {
    const lock = createWakeLock({}, fakeDoc());
    expect(lock.supported).toBe(false);
    expect(await lock.on()).toBe(false);
    expect(lock.isOn()).toBe(false);
  });

  it('turns on and off', async () => {
    const { nav, sentinels } = fakeNav();
    const lock = createWakeLock(nav, fakeDoc());
    expect(await lock.on()).toBe(true);
    expect(lock.isOn()).toBe(true);
    await lock.off();
    expect(lock.isOn()).toBe(false);
    expect(sentinels[0].released).toBe(true);
  });

  it('takes the lock back when the tab becomes visible again', async () => {
    const { nav, request, sentinels } = fakeNav();
    const doc = fakeDoc();
    const lock = createWakeLock(nav, doc);
    await lock.on();
    await sentinels[0].release(); // the browser drops it when the tab is hidden
    doc.visibilityState = 'visible';
    doc.fire();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
    expect(lock.isOn()).toBe(true);
  });

  it('does not take the lock back after being switched off', async () => {
    const { nav, request } = fakeNav();
    const doc = fakeDoc();
    const lock = createWakeLock(nav, doc);
    await lock.on();
    await lock.off();
    doc.fire();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reports failure when the browser refuses', async () => {
    const lock = createWakeLock({ wakeLock: { request: async () => { throw new Error('NotAllowed'); } } }, fakeDoc());
    expect(await lock.on()).toBe(false);
    expect(lock.isOn()).toBe(false);
  });
});

describe('searchBrew', () => {
  const items = [
    { name: 'lazygit', desc: 'Simple terminal UI for git commands', cask: false },
    { name: 'git', desc: 'Distributed revision control system', cask: false },
    { name: 'gitup', desc: 'Git interface', cask: true },
    { name: 'ripgrep', desc: 'Search tool like grep', cask: false },
  ];

  it('puts exact and prefix matches before substring matches', () => {
    expect(searchBrew(items, 'git').map((i) => i.name)).toEqual(['git', 'gitup', 'lazygit']);
  });

  it('falls back to descriptions', () => {
    expect(searchBrew(items, 'grep').map((i) => i.name)).toEqual(['ripgrep']);
    expect(searchBrew(items, 'revision').map((i) => i.name)).toEqual(['git']);
  });

  it('handles empty and odd queries', () => {
    expect(searchBrew(items, '')).toEqual([]);
    expect(searchBrew(items, '(')).toEqual([]);
  });

  it('limits the number of results', () => {
    expect(searchBrew(items, 'g', 2)).toHaveLength(2);
  });
});
