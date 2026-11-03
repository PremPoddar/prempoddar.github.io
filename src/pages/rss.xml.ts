import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { publishedPosts } from '../lib/content';
import { site } from '../data/site';

export async function GET(context: APIContext) {
  const posts = publishedPosts(await getCollection('writing'), import.meta.env.PROD);
  return rss({
    title: `${site.name}, writing`,
    description: 'Posts and guides about the apps I build.',
    site: context.site ?? site.origin,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: `/writing/${p.id}/`,
    })),
  });
}
