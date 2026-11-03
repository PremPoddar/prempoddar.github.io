import { describe, it, expect } from 'vitest';
import { publishedPosts, byOrder } from '../src/lib/content';

const post = (id: string, date: string, draft: boolean) =>
  ({ id, data: { date: new Date(date), draft } }) as any;

describe('publishedPosts', () => {
  const posts = [post('a', '2026-01-01', false), post('b', '2026-03-01', true), post('c', '2026-02-01', false)];

  it('drops drafts in production', () => {
    expect(publishedPosts(posts, true).map((p) => p.id)).toEqual(['c', 'a']);
  });

  it('keeps drafts in development', () => {
    expect(publishedPosts(posts, false).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('returns nothing when every post is a draft', () => {
    expect(publishedPosts([post('x', '2026-01-01', true)], true)).toEqual([]);
  });
});

describe('byOrder', () => {
  it('sorts by order ascending without mutating', () => {
    const xs = [{ data: { order: 2 } }, { data: { order: 1 } }];
    expect(byOrder(xs).map((x) => x.data.order)).toEqual([1, 2]);
    expect(xs[0].data.order).toBe(2);
  });
});

describe('app links', () => {
  it('point straight at each app site at an address that works today', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    for (const f of readdirSync('src/content/apps')) {
      const text = readFileSync(`src/content/apps/${f}`, 'utf8');
      const title = text.match(/^title: (.*)$/m)![1];
      const site = text.match(/^  site: (.*)$/m)![1];
      const ok = site === `https://prempoddar.github.io/${title}/` || site === 'https://www.noxdrop.com/caffeinatecat.html';
      expect({ f, site, ok }).toEqual({ f, site, ok: true });
    }
  });
});
