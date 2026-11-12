import { execFileSync } from 'node:child_process';

// Files (or folders) whose last git change counts as a change to each page.
// URL paths always carry a trailing slash; '' below means the home page.
function filesForPage(path: string): string[] {
  const parts = path.split('/').filter(Boolean);
  const [first, second] = parts;
  switch (first) {
    case undefined:
      return ['src/pages/index.astro', 'src/data/site.ts', 'src/components/canvas', 'src/content'];
    case 'apps':
      return second
        ? [`src/content/apps/${second}.md`, 'src/pages/apps/[slug].astro', 'src/components/Platforms.astro']
        : ['src/pages/apps/index.astro', 'src/content/apps', 'src/components/AppShowcase.astro'];
    case 'writing':
      return second
        ? [`src/content/writing/${second}.md`, 'src/pages/writing/[slug].astro']
        : ['src/pages/writing/index.astro', 'src/content/writing'];
    case 'work':
      return second
        ? [`src/content/work/${second}.md`, 'src/pages/work/[slug].astro', 'src/components/WorkVisual.astro']
        : ['src/pages/work/index.astro', 'src/content/work'];
    case 'toolbox':
      return ['src/pages/toolbox.astro', 'src/content/toolbox.yaml', 'src/lib/toolbox.ts'];
    case 'resume':
      return ['src/pages/resume.astro', 'src/data/resume.ts'];
    default:
      return [];
  }
}

// Maps a page url to the date of the last commit that touched anything it is
// built from, or undefined when nothing maps. Used as sitemap lastmod.
export function lastmodForPage(page: string): string | undefined {
  const path = page.replace(/^https?:\/\/[^/]+/, '');
  const files = filesForPage(path);
  if (files.length === 0) return undefined;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%aI', '--', ...files], {
      encoding: 'utf8',
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}
