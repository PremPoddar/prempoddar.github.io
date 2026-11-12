import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  personSchema,
  websiteSchema,
  softwareApplicationSchema,
  blogPostingSchema,
} from '../src/lib/seo';

const read = (path: string) => readFileSync(path, 'utf8');

describe('robots.txt', () => {
  it('exists, allows everyone and points at the sitemap', () => {
    expect(existsSync('public/robots.txt')).toBe(true);
    const txt = read('public/robots.txt');
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Sitemap: https://prempoddar.is-a.dev/sitemap-index.xml');
  });
});

describe('personSchema', () => {
  it('describes Prem as an app developer and links his profiles', () => {
    const p = personSchema();
    expect(p['@type']).toBe('Person');
    expect(p.name).toBe('Prem Poddar');
    expect(p.url).toBe('https://prempoddar.is-a.dev/');
    expect(p.jobTitle).toBe('App Developer');
    expect(p.sameAs).toEqual(
      expect.arrayContaining([
        'https://github.com/PremPoddar',
        'https://www.linkedin.com/in/prem-poddar/',
        'https://x.com/premp0ddar',
      ]),
    );
  });

  it('names no city outside the resume', () => {
    expect(JSON.stringify(personSchema())).not.toMatch(/Mumbai|India/i);
  });
});

describe('websiteSchema', () => {
  it('names the site at its origin', () => {
    const w = websiteSchema();
    expect(w['@type']).toBe('WebSite');
    expect(w.name).toBe('Prem Poddar');
    expect(w.url).toBe('https://prempoddar.is-a.dev/');
  });
});

describe('softwareApplicationSchema', () => {
  const app = {
    title: 'Brewlight',
    summary: 'A fast Mac app that searches Homebrew packages as you type.',
    platform: ['macos'],
    screenshots: ['/apps/brewlight/showcase.jpg'],
    links: {
      site: 'https://prempoddar.github.io/Brewlight/',
      github: 'https://github.com/PremPoddar/Brewlight',
    },
  };
  const schema = softwareApplicationSchema(
    app as any,
    'https://prempoddar.is-a.dev/apps/brewlight/',
  );

  it('describes a free app by Prem at its own address', () => {
    expect(schema['@type']).toBe('SoftwareApplication');
    expect(schema.name).toBe('Brewlight');
    expect(schema.description).toBe(app.summary);
    expect(schema.offers).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'USD' });
    expect(schema.author).toEqual({
      '@type': 'Person',
      name: 'Prem Poddar',
      url: 'https://prempoddar.is-a.dev/',
    });
    expect(schema.url).toBe('https://prempoddar.is-a.dev/apps/brewlight/');
  });

  it('maps the platform to a category and an operating system', () => {
    expect(schema.applicationCategory).toBe('DesktopApplication');
    expect(schema.operatingSystem).toBe('macOS');
    const android = softwareApplicationSchema(
      { ...app, platform: ['android', 'web'] } as any,
      'https://prempoddar.is-a.dev/apps/duet/',
    );
    expect(android.applicationCategory).toBe('MobileApplication');
    expect(android.operatingSystem).toBe('Android, Web');
    const web = softwareApplicationSchema(
      { ...app, platform: ['web'] } as any,
      'https://prempoddar.is-a.dev/apps/campfire/',
    );
    expect(web.applicationCategory).toBe('WebApplication');
    expect(web.operatingSystem).toBe('Web');
  });

  it('uses the first screenshot at the site origin, or nothing when there is none', () => {
    expect(schema.screenshot).toBe('https://prempoddar.is-a.dev/apps/brewlight/showcase.jpg');
    const bare = softwareApplicationSchema(
      { ...app, screenshots: [] } as any,
      'https://prempoddar.is-a.dev/apps/brewlight/',
    );
    expect('screenshot' in bare).toBe(false);
  });
});

describe('blogPostingSchema', () => {
  const post = {
    title: 'Keeping a Mac awake with the lid closed',
    description: 'Why lid-closed mode needs root.',
    date: new Date('2026-11-02T00:00:00Z'),
  };
  const url = 'https://prempoddar.is-a.dev/writing/caffeinatecat-lid-closed/';
  const schema = blogPostingSchema(
    post as any,
    url,
    'https://prempoddar.is-a.dev/apps/caffeinatecat/banner.jpg',
  );

  it('marks the post with its date, author and address', () => {
    expect(schema['@type']).toBe('BlogPosting');
    expect(schema.headline).toBe(post.title);
    expect(schema.description).toBe(post.description);
    expect(schema.datePublished).toBe('2026-11-02T00:00:00.000Z');
    expect(schema.author).toEqual({
      '@type': 'Person',
      name: 'Prem Poddar',
      url: 'https://prempoddar.is-a.dev/',
    });
    expect(schema.image).toBe('https://prempoddar.is-a.dev/apps/caffeinatecat/banner.jpg');
    expect(schema.mainEntityOfPage).toEqual({ '@type': 'WebPage', '@id': url });
  });

  it('falls back to the site image when the post has no banner', () => {
    const bare = blogPostingSchema(post as any, url);
    expect(bare.image).toBe('https://prempoddar.is-a.dev/og.jpg');
  });
});

describe('the shared head carries the search console tag', () => {
  it('keeps the google-site-verification meta tag in Base.astro', () => {
    const base = read('src/layouts/Base.astro');
    expect(base).toContain('google-site-verification');
    expect(base).toContain('W8fzQ8yXuCIAOU05BRlFMitbXawtlL_d0aXooERSyXY');
  });
});

describe('structured data is wired into the pages', () => {
  it('Base emits the person and website schema', () => {
    const base = read('src/layouts/Base.astro');
    expect(base).toMatch(/personSchema/);
    expect(base).toMatch(/websiteSchema/);
    expect(base).toMatch(/<JsonLd data=\{\[personSchema\(\), websiteSchema\(\)\]\}/);
    expect(read('src/components/JsonLd.astro')).toMatch(/application\/ld\+json/);
  });

  it('app pages emit SoftwareApplication', () => {
    expect(read('src/pages/apps/[slug].astro')).toMatch(/softwareApplicationSchema/);
  });

  it('writing pages emit BlogPosting', () => {
    expect(read('src/pages/writing/[slug].astro')).toMatch(/blogPostingSchema/);
  });
});

describe('titles carry keywords without the city', () => {
  it('gives the homepage a keyword title', () => {
    expect(read('src/pages/index.astro')).toMatch(/App Developer/);
  });

  it('names the platforms on the apps index and lists the apps', () => {
    const apps = read('src/pages/apps/index.astro');
    expect(apps).toMatch(/Apps by Prem Poddar/);
    expect(apps).toMatch(/CaffeinateCat/);
  });

  it('keeps the city on the resume only', () => {
    expect(read('src/pages/resume.astro')).toMatch(/Mumbai/);
  });
});

describe('open graph details', () => {
  it('declares image dimensions and alt text in Base', () => {
    const base = read('src/layouts/Base.astro');
    expect(base).toContain('og:image:width');
    expect(base).toContain('og:image:height');
    expect(base).toContain('og:image:alt');
  });

  it('marks writing posts as articles with a publish time', () => {
    const post = read('src/pages/writing/[slug].astro');
    expect(post).toMatch(/ogType="article"/);
    expect(post).toMatch(/publishedTime/);
  });
});
