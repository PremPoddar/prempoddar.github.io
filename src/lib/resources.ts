export type Resource = {
  id: string;
  name: string;
  url: string;
  category: string;
  why: string;
  tags: string[];
};

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function filterResources(resources: Resource[], query: string, category: string | null, tag: string | null): Resource[] {
  const q = query.trim().toLowerCase();
  return resources.filter((r) => {
    if (category && r.category !== category) return false;
    if (tag && !r.tags.includes(tag)) return false;
    if (!q) return true;
    const hay = [r.name, r.why, host(r.url), ...r.tags].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

export function groupByCategory(resources: Resource[], order: readonly string[]): { category: string; resources: Resource[] }[] {
  return order
    .map((category) => ({ category, resources: resources.filter((r) => r.category === category) }))
    .filter((g) => g.resources.length > 0);
}
