export type Tool = {
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

export function filterTools(tools: Tool[], query: string, category: string | null, tag: string | null): Tool[] {
  const q = query.trim().toLowerCase();
  return tools.filter((t) => {
    if (category && t.category !== category) return false;
    if (tag && !t.tags.includes(tag)) return false;
    if (!q) return true;
    const hay = [t.name, t.why, host(t.url), ...t.tags].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

export function groupByCategory(tools: Tool[], order: readonly string[]): { category: string; tools: Tool[] }[] {
  return order
    .map((category) => ({ category, tools: tools.filter((t) => t.category === category) }))
    .filter((g) => g.tools.length > 0);
}
