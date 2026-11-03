import type { CollectionEntry } from 'astro:content';

/** Minutes to read, at about 220 words a minute. Code counts too: people read it. */
export function readingMinutes(body: string): number {
  const words = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** The app a post is about: the first related id that is an app. */
export function appFor(
  post: CollectionEntry<'writing'>,
  apps: CollectionEntry<'apps'>[],
): CollectionEntry<'apps'> | undefined {
  return post.data.related.map((id) => apps.find((a) => a.id === id)).find(Boolean);
}
