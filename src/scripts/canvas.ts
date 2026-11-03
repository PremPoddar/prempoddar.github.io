// Pan, zoom, rulers and strings for the homepage workbench. Only runs on wide screens;
// phones get the plain stack of cards.
import { homeView, fitScale, clampView, pan, zoomAt, wheelToZoomFactor, revealPan, keyToAction, MAX_SCALE, type View, type Rect } from '../lib/canvas/viewport';
import { deskBounds } from '../data/canvas';
import { stringPath } from '../lib/canvas/strings';

const UNIT = 24; // desk units per centimetre on the rulers
const MAJOR = UNIT * 5;
const KEY_STEP = 80;
const KEEP = 200; // the desk can be dragged until only this many pixels of it are left on screen

export function initWorkbench() {
  const root = document.querySelector<HTMLElement>('[data-workbench]');
  if (!root) return;
  const wide = matchMedia('(min-width: 900px)');
  let teardown: (() => void) | null = null;
  const sync = () => {
    teardown?.();
    teardown = wide.matches ? enable(root) : null;
  };
  wide.addEventListener('change', sync);
  sync();
}

function enable(root: HTMLElement): () => void {
  const viewport = root.querySelector<HTMLElement>('[data-viewport]')!;
  const world = root.querySelector<HTMLElement>('[data-world]')!;
  const tools = root.querySelector<HTMLElement>('[data-desk-tools]')!;
  const readout = root.querySelector<HTMLOutputElement>('[data-zoom-readout]')!;
  const rulerX = root.querySelector<HTMLCanvasElement>('[data-ruler="x"]')!;
  const rulerY = root.querySelector<HTMLCanvasElement>('[data-ruler="y"]')!;
  const svg = root.querySelector<SVGSVGElement>('[data-strings-layer]')!;
  const start: Rect = JSON.parse(root.dataset.start!);
  const links: [string, string][] = JSON.parse(root.dataset.strings!);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  tools.hidden = false;
  const zoomButtons = [...tools.querySelectorAll<HTMLButtonElement>('[data-zoom]')];
  let view: View = home();
  let frame = 0;

  function home(): View {
    const r = viewport.getBoundingClientRect();
    return homeView(start, r.width, r.height, 48);
  }

  function size() {
    const r = viewport.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  // Zooming out stops once the whole desk fits on screen.
  function minScale() {
    const { w, h } = size();
    return fitScale(deskBounds, w, h, 24);
  }

  function zoom(v: View, factor: number, px: number, py: number) {
    return zoomAt(v, factor, px, py, minScale(), MAX_SCALE);
  }

  function render() {
    frame = 0;
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    const minor = UNIT * view.scale;
    viewport.style.setProperty('--minor', `${minor}px`);
    viewport.style.setProperty('--major', `${MAJOR * view.scale}px`);
    viewport.style.setProperty('--bx', `${view.x}px`);
    viewport.style.setProperty('--by', `${view.y}px`);
    readout.value = `${Math.round(view.scale * 100)}%`;
    zoomButtons[0].disabled = view.scale <= minScale() + 0.001;
    zoomButtons[1].disabled = view.scale >= MAX_SCALE - 0.001;
    drawRuler(rulerX, 'x');
    drawRuler(rulerY, 'y');
  }

  function set(next: View, ease = false) {
    if (ease && !reduceMotion.matches) {
      world.classList.add('easing');
      window.setTimeout(() => world.classList.remove('easing'), 450);
    }
    const { w, h } = size();
    view = clampView(next, deskBounds, w, h, KEEP);
    if (!frame) frame = requestAnimationFrame(render);
  }

  function drawRuler(c: HTMLCanvasElement, axis: 'x' | 'y') {
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#56655b';
    ctx.fillStyle = '#56655b';
    ctx.font = '10px "JetBrains Mono Variable", monospace';
    const length = axis === 'x' ? w : h;
    const offset = axis === 'x' ? view.x : view.y;
    const step = UNIT * view.scale;
    const labelEvery = view.scale < 0.6 ? 10 : 5;
    const first = Math.floor(-offset / step);
    const last = Math.ceil((length - offset) / step);
    ctx.beginPath();
    for (let i = first; i <= last; i++) {
      const p = Math.round(offset + i * step) + 0.5;
      if (p < 24) continue;
      const big = i % 5 === 0;
      const size = big ? 10 : 5;
      if (axis === 'x') {
        ctx.moveTo(p, 24);
        ctx.lineTo(p, 24 - size);
        if (i % labelEvery === 0) ctx.fillText(String(i), p + 3, 11);
      } else {
        ctx.moveTo(24, p);
        ctx.lineTo(24 - size, p);
        if (i % labelEvery === 0) {
          ctx.save();
          ctx.translate(11, p + 3);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(String(i), -ctx.measureText(String(i)).width - 3, 0);
          ctx.restore();
        }
      }
    }
    ctx.stroke();
  }

  function drawStrings() {
    const ns = 'http://www.w3.org/2000/svg';
    svg.replaceChildren();
    const rect = (id: string): Rect | null => {
      const el = world.querySelector<HTMLElement>(`[data-card="${CSS.escape(id)}"]`);
      return el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null;
    };
    for (const [a, b] of links) {
      const ra = rect(a);
      const rb = rect(b);
      if (!ra || !rb) continue;
      const d = stringPath(ra, rb);
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      svg.append(path);
      const [, sx, sy] = d.match(/^M ([\d.-]+) ([\d.-]+)/)!;
      const [ex, ey] = d.split(' ').slice(-2);
      for (const [cx, cy] of [[sx, sy], [ex, ey]]) {
        const pin = document.createElementNS(ns, 'circle');
        pin.setAttribute('cx', cx);
        pin.setAttribute('cy', cy);
        pin.setAttribute('r', '3.5');
        svg.append(pin);
      }
    }
  }

  // Dragging, with two-finger pinch on touch screens
  const pointers = new Map<number, { x: number; y: number }>();
  const isControl = (t: EventTarget | null) =>
    t instanceof Element && !!t.closest('a, button, input, select, textarea, label, [data-no-pan]');

  function onDown(e: PointerEvent) {
    if (e.button !== 0 || isControl(e.target)) return;
    e.preventDefault();
    viewport.focus({ preventScroll: true });
    window.getSelection()?.removeAllRanges();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add('dragging');
  }

  function onMove(e: PointerEvent) {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const other = a === prev ? b : a;
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      const r = viewport.getBoundingClientRect();
      if (before > 0) set(zoom(view, after / before, (e.clientX + other.x) / 2 - r.left, (e.clientY + other.y) / 2 - r.top));
    } else {
      set(pan(view, e.clientX - prev.x, e.clientY - prev.y));
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function onUp(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) viewport.classList.remove('dragging');
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      set(zoom(view, wheelToZoomFactor(e.deltaY, e.ctrlKey), e.clientX - r.left, e.clientY - r.top));
    } else {
      const k = e.deltaMode === 1 ? 16 : 1;
      set(pan(view, -e.deltaX * k, -e.deltaY * k));
    }
  }

  function zoomCentre(factor: number) {
    const r = viewport.getBoundingClientRect();
    set(zoom(view, factor, r.width / 2, r.height / 2), true);
  }

  function onKey(e: KeyboardEvent) {
    if (isControl(e.target) && e.target !== viewport) return;
    const action = keyToAction(e, KEY_STEP);
    if (!action) return;
    if ('pan' in action) set(pan(view, ...action.pan), true);
    else if ('zoom' in action) zoomCentre(action.zoom);
    else set(home(), true);
    e.preventDefault();
  }

  // Keyboard focus can land on a card anywhere on the desk. Once the browser has done any
  // scrolling of its own (handled by onScroll), pan so the whole card is on screen.
  function onFocusIn(e: FocusEvent) {
    const card = (e.target as Element).closest<HTMLElement>('[data-card]');
    if (!card) return;
    window.setTimeout(() => {
      onScroll();
      const v = viewport.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      const { dx, dy } = revealPan(
        { x: c.left, y: c.top, w: c.width, h: c.height },
        { x: v.left, y: v.top + 24, w: v.width, h: v.height - 24 },
        48,
      );
      if (dx || dy) set(pan(view, dx, dy), true);
    }, 0);
  }

  // Safari sends pinches as gesture events rather than Ctrl+wheel.
  let gestureScale = 1;
  function onGestureStart(e: Event) {
    e.preventDefault();
    gestureScale = 1;
  }
  function onGestureChange(e: Event) {
    e.preventDefault();
    const g = e as Event & { scale: number; clientX: number; clientY: number };
    const r = viewport.getBoundingClientRect();
    set(zoom(view, g.scale / gestureScale, g.clientX - r.left, g.clientY - r.top));
    gestureScale = g.scale;
  }

  // Tabbing to an off-screen card makes the browser scroll the clipped viewport.
  // Turn that scroll into a pan so the transform stays the single source of truth.
  function onScroll() {
    const dx = viewport.scrollLeft;
    const dy = viewport.scrollTop;
    if (!dx && !dy) return;
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
    set(pan(view, -dx - Math.sign(dx) * 60, -dy - Math.sign(dy) * 60), true);
  }

  const tidy = tools.querySelector<HTMLButtonElement>('[data-tidy]')!;
  const onZoomButton = (e: Event) => zoomCentre((e.currentTarget as HTMLElement).dataset.zoom === 'in' ? 1.25 : 0.8);
  const onTidy = () => set(home(), true);
  const onResize = () => set(view);

  viewport.addEventListener('pointerdown', onDown);
  viewport.addEventListener('pointermove', onMove);
  viewport.addEventListener('pointerup', onUp);
  viewport.addEventListener('pointercancel', onUp);
  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('keydown', onKey);
  viewport.addEventListener('scroll', onScroll);
  viewport.addEventListener('focusin', onFocusIn);
  viewport.addEventListener('gesturestart', onGestureStart);
  viewport.addEventListener('gesturechange', onGestureChange);
  zoomButtons.forEach((b) => b.addEventListener('click', onZoomButton));
  tidy.addEventListener('click', onTidy);
  window.addEventListener('resize', onResize);

  render();
  drawStrings();
  document.fonts?.ready.then(() => {
    drawStrings();
    set(home());
  });

  return () => {
    viewport.removeEventListener('pointerdown', onDown);
    viewport.removeEventListener('pointermove', onMove);
    viewport.removeEventListener('pointerup', onUp);
    viewport.removeEventListener('pointercancel', onUp);
    viewport.removeEventListener('wheel', onWheel);
    viewport.removeEventListener('keydown', onKey);
    viewport.removeEventListener('scroll', onScroll);
    viewport.removeEventListener('focusin', onFocusIn);
    viewport.removeEventListener('gesturestart', onGestureStart);
    viewport.removeEventListener('gesturechange', onGestureChange);
    zoomButtons.forEach((b) => b.removeEventListener('click', onZoomButton));
    tidy.removeEventListener('click', onTidy);
    window.removeEventListener('resize', onResize);
    world.style.transform = '';
    tools.hidden = true;
    svg.replaceChildren();
  };
}
