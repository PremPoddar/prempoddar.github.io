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
