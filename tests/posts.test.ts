import { describe, expect, it } from 'vitest';
import { appFor, readingMinutes } from '../src/lib/posts';

describe('readingMinutes', () => {
  it('counts about 220 words a minute and never says zero', () => {
    expect(readingMinutes('word '.repeat(440))).toBe(2);
    expect(readingMinutes('')).toBe(1);
  });

  it('ignores markup in inline diagrams', () => {
    const svg = '<svg viewBox="0 0 640 230"><rect x="1" y="2" width="3" height="4"/></svg>';
    expect(readingMinutes(svg.repeat(500))).toBe(1);
  });
});

describe('appFor', () => {
  const apps = [{ id: 'duet' }, { id: 'oaf' }] as never[];
  const post = (related: string[]) => ({ data: { related } }) as never;

  it('finds the first related id that is an app', () => {
    expect(appFor(post(['some-post', 'oaf', 'duet']), apps)).toEqual({ id: 'oaf' });
  });

  it('returns nothing when no related id is an app', () => {
    expect(appFor(post(['some-post']), apps)).toBeUndefined();
  });
});
