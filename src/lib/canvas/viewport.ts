export type View = { x: number; y: number; scale: number };
export type Rect = { x: number; y: number; w: number; h: number };

export const MIN_SCALE = 0.4;
export const MAX_SCALE = 2;

export function clampScale(s: number, min = MIN_SCALE, max = MAX_SCALE): number {
  return Math.min(max, Math.max(min, s));
}

// Zoom by `factor` while keeping the world point under screen point (px, py) still.
export function zoomAt(view: View, factor: number, px: number, py: number, min = MIN_SCALE, max = MAX_SCALE): View {
  const scale = clampScale(view.scale * factor, min, max);
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

// The zoom at which the whole desk fits on screen. Zooming out further would only show empty mat.
export function fitScale(desk: Rect, vw: number, vh: number, padding: number): number {
  return Math.min(1, Math.max(0.2, Math.min((vw - 2 * padding) / desk.w, (vh - 2 * padding) / desk.h)));
}

// Let the desk move freely, but always leave at least `keep` pixels of it on screen.
export function clampView(view: View, desk: Rect, vw: number, vh: number, keep: number): View {
  const axis = (pos: number, start: number, size: number, screen: number) => {
    const lo = keep - (start + size) * view.scale;
    const hi = screen - keep - start * view.scale;
    return Math.min(hi, Math.max(lo, pos));
  };
  return { x: axis(view.x, desk.x, desk.w, vw), y: axis(view.y, desk.y, desk.h, vh), scale: view.scale };
}

// The opening view: 100% zoom, the opening area centred if it fits, otherwise starting from its top left.
export function homeView(start: Rect, vw: number, vh: number, pad: number): View {
  const axis = (from: number, size: number, screen: number) =>
    size + 2 * pad <= screen ? (screen - size) / 2 - from : pad - from;
  return { x: axis(start.x, start.w, vw), y: axis(start.y, start.h, vh), scale: 1 };
}
