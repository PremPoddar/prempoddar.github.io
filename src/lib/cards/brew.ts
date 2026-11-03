export type BrewItem = { name: string; desc: string; cask: boolean };

export function searchBrew(items: BrewItem[], query: string, limit = 6): BrewItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rank = (i: BrewItem) => {
    const n = i.name.toLowerCase();
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.includes(q)) return 2;
    if (i.desc.toLowerCase().includes(q)) return 3;
    return -1;
  };
  return items
    .map((item) => ({ item, r: rank(item) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.item.name.length - b.item.name.length || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((x) => x.item);
}
