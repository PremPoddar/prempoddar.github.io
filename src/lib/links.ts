import { getCollection } from 'astro:content';
import { publishedPosts } from './content';

export type Linkable = { id: string; title: string; href: string; kind: 'app' | 'work' | 'writing' };

export const isProd = import.meta.env.PROD;

export async function allLinkables(): Promise<Map<string, Linkable>> {
  const [apps, work, writing] = await Promise.all([
    getCollection('apps'),
    getCollection('work'),
    getCollection('writing'),
  ]);
  const map = new Map<string, Linkable>();
  for (const a of apps) map.set(a.id, { id: a.id, title: a.data.title, href: `/apps/${a.id}/`, kind: 'app' });
  for (const w of work) map.set(w.id, { id: w.id, title: w.data.title, href: `/work/${w.id}/`, kind: 'work' });
  for (const p of publishedPosts(writing, isProd)) {
    map.set(p.id, { id: p.id, title: p.data.title, href: `/writing/${p.id}/`, kind: 'writing' });
  }
  return map;
}

export async function resolveRelated(ids: string[]): Promise<Linkable[]> {
  const map = await allLinkables();
  return ids.flatMap((id) => (map.has(id) ? [map.get(id)!] : []));
}
