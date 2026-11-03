import type { Rect } from './viewport';

export function resolveStrings(links: [string, string][], ids: Set<string>): [string, string][] {
  return links.filter(([a, b]) => ids.has(a) && ids.has(b));
}

// A sagging cubic curve between the two edges that face each other.
export function stringPath(a: Rect, b: Rect): string {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  const r = (n: number) => Math.round(n * 10) / 10;

  if (Math.abs(dx) >= Math.abs(dy)) {
    const s = { x: dx > 0 ? a.x + a.w : a.x, y: ac.y };
    const e = { x: dx > 0 ? b.x : b.x + b.w, y: bc.y };
    const pull = (e.x - s.x) / 2;
    const sag = Math.min(60, Math.abs(e.x - s.x) * 0.15);
    return `M ${r(s.x)} ${r(s.y)} C ${r(s.x + pull)} ${r(s.y + sag)} ${r(e.x - pull)} ${r(e.y + sag)} ${r(e.x)} ${r(e.y)}`;
  }
  const s = { x: ac.x, y: dy > 0 ? a.y + a.h : a.y };
  const e = { x: bc.x, y: dy > 0 ? b.y : b.y + b.h };
  const pull = (e.y - s.y) / 2;
  return `M ${r(s.x)} ${r(s.y)} C ${r(s.x)} ${r(s.y + pull)} ${r(e.x)} ${r(e.y - pull)} ${r(e.x)} ${r(e.y)}`;
}
