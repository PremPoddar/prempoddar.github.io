export type View = { x: number; y: number; scale: number };
export type Rect = { x: number; y: number; w: number; h: number };

export const MIN_SCALE = 0.4;
export const MAX_SCALE = 2;

export function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

// Zoom by `factor` while keeping the world point under screen point (px, py) still.
export function zoomAt(view: View, factor: number, px: number, py: number): View {
  const scale = clampScale(view.scale * factor);
  if (scale === view.scale) return view;
  const wx = (px - view.x) / view.scale;
  const wy = (py - view.y) / view.scale;
  return { x: px - wx * scale, y: py - wy * scale, scale };
}

export function pan(view: View, dx: number, dy: number): View {
  return { x: view.x + dx, y: view.y + dy, scale: view.scale };
}

// Trackpad pinches arrive as wheel events with ctrlKey set and small deltas, so they get more weight.
export function wheelToZoomFactor(deltaY: number, ctrlKey: boolean): number {
  const factor = Math.exp(-deltaY * (ctrlKey ? 0.012 : 0.0015));
  return Math.min(2, Math.max(0.5, factor));
}

// Fit bounds into the viewport, never zooming in past 1:1.
export function fitView(bounds: Rect, vw: number, vh: number, padding: number): View {
  const scale = clampScale(Math.min(1, (vw - 2 * padding) / bounds.w, (vh - 2 * padding) / bounds.h));
  return {
    x: vw / 2 - (bounds.x + bounds.w / 2) * scale,
    y: vh / 2 - (bounds.y + bounds.h / 2) * scale,
    scale,
  };
}

// How far to pan so `card` (screen rect) sits inside `viewport` with `margin` to spare.
export function revealPan(card: Rect, viewport: Rect, margin: number): { dx: number; dy: number } {
  const axis = (start: number, size: number, vStart: number, vSize: number) => {
    if (start < vStart + margin) return vStart + margin - start;
    if (start + size > vStart + vSize - margin) return Math.max(vStart + margin - start, vStart + vSize - margin - (start + size));
    return 0;
  };
  return { dx: axis(card.x, card.w, viewport.x, viewport.w), dy: axis(card.y, card.h, viewport.y, viewport.h) };
}

export type KeyAction = { pan: [number, number] } | { zoom: number } | { home: true } | null;

// Desk keys. Anything with a modifier is left to the browser (Ctrl or Cmd with + zooms the page, for example).
export function keyToAction(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }, step = 80): KeyAction {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case 'ArrowLeft': return { pan: [step, 0] };
    case 'ArrowRight': return { pan: [-step, 0] };
    case 'ArrowUp': return { pan: [0, step] };
    case 'ArrowDown': return { pan: [0, -step] };
    case '+': case '=': return { zoom: 1.25 };
    case '-': case '_': return { zoom: 0.8 };
    case '0': return { home: true };
    default: return null;
  }
}
