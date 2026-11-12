import { site } from '../data/site';

const author = { '@type': 'Person', name: site.name, url: `${site.origin}/` };

const OS_NAMES: Record<string, string> = {
  android: 'Android',
  ios: 'iOS',
  macos: 'macOS',
  web: 'Web',
};

export function personSchema() {
  return {
    '@type': 'Person',
    name: site.name,
    url: `${site.origin}/`,
    jobTitle: 'App Developer',
    description: site.tagline,
    sameAs: [site.links.github, site.links.linkedin, site.links.x],
  };
}

export function websiteSchema() {
  return {
    '@type': 'WebSite',
    name: site.name,
    url: `${site.origin}/`,
  };
}

export function softwareApplicationSchema(
  app: { title: string; summary: string; platform: string[]; screenshots: string[] },
  url: string,
) {
  const platforms = app.platform ?? [];
  const schema: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    name: app.title,
    description: app.summary,
    operatingSystem: platforms.map((p) => OS_NAMES[p] ?? p).join(', '),
    applicationCategory:
      platforms.includes('android') || platforms.includes('ios')
        ? 'MobileApplication'
        : platforms.includes('macos')
          ? 'DesktopApplication'
          : 'WebApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author,
    url,
  };
  const shot = app.screenshots?.[0];
  if (shot) schema.screenshot = new URL(shot, `${site.origin}/`).href;
  return schema;
}

export function blogPostingSchema(
  post: { title: string; description: string; date: Date },
  url: string,
  image?: string,
) {
  return {
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date.toISOString(),
    author,
    publisher: author,
    image: image ?? `${site.origin}/og.jpg`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
}
