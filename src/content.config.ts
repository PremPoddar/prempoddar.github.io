import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const platform = z.enum(['android', 'ios', 'macos', 'web']);

const apps = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/apps' }),
  schema: z.object({
    title: z.string(),
    platform: z.array(platform),
    tagline: z.string(),
    summary: z.string(),
    order: z.number(),
    featured: z.boolean().default(false),
    icon: z.string(),
    screenshots: z.array(z.string()).default([]),
    accent: z.string(),
    links: z.object({
      site: z.string().url(),
      github: z.string().url(),
      store: z.string().url().optional(),
    }),
    related: z.array(z.string()).default([]),
  }),
});

const work = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    client: z.string(),
    role: z.string(),
    when: z.string(),
    where: z.string(),
    summary: z.string(),
    order: z.number(),
    link: z.string().url().optional(),
    related: z.array(z.string()).default([]),
  }),
});

const writing = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    kind: z.enum(['post', 'guide']),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    related: z.array(z.string()).default([]),
  }),
});

export const TOOLBOX_CATEGORIES = [
  'Privacy & security',
  'Reverse engineering & dev',
  'Android',
  'Make & share',
  'Indie software',
  'Math & science',
  'Rabbit holes',
  'Reading',
] as const;

const toolbox = defineCollection({
  loader: file('./src/content/toolbox.yaml'),
  schema: z.object({
    name: z.string(),
    url: z.string().url(),
    category: z.enum(TOOLBOX_CATEGORIES),
    why: z.string(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { apps, work, writing, toolbox };
