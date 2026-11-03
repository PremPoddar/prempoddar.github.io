// Pan, zoom, rulers and strings for the homepage workbench. Only runs on wide screens;
// phones get the plain stack of cards.
import { fitView, pan, zoomAt, wheelToZoomFactor, type View, type Rect } from '../lib/canvas/viewport';
import { stringPath } from '../lib/canvas/strings';

const UNIT = 24; // desk units per centimetre on the rulers
const MAJOR = UNIT * 5;
const KEY_STEP = 80;

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
  let view: View = home();
  let frame = 0;

  function home(): View {
    const r = viewport.getBoundingClientRect();
    return fitView(start, r.width, r.height, 48);
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
    drawRuler(rulerX, 'x');
    drawRuler(rulerY, 'y');
  }

  function set(next: View, ease = false) {
    if (ease && !reduceMotion.matches) {
      world.classList.add('easing');
      window.setTimeout(() => world.classList.remove('easing'), 450);
    }
    view = next;
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
      if (before > 0) set(zoomAt(view, after / before, (e.clientX + other.x) / 2 - r.left, (e.clientY + other.y) / 2 - r.top));
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
      set(zoomAt(view, wheelToZoomFactor(e.deltaY, e.ctrlKey), e.clientX - r.left, e.clientY - r.top));
    } else {
      const k = e.deltaMode === 1 ? 16 : 1;
      set(pan(view, -e.deltaX * k, -e.deltaY * k));
    }
  }

  function zoomCentre(factor: number) {
    const r = viewport.getBoundingClientRect();
    set(zoomAt(view, factor, r.width / 2, r.height / 2), true);
  }

  function onKey(e: KeyboardEvent) {
    if (isControl(e.target) && e.target !== viewport) return;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_STEP, 0], ArrowRight: [-KEY_STEP, 0], ArrowUp: [0, KEY_STEP], ArrowDown: [0, -KEY_STEP],
    };
    if (moves[e.key]) set(pan(view, ...moves[e.key]), true);
    else if (e.key === '+' || e.key === '=') zoomCentre(1.25);
    else if (e.key === '-' || e.key === '_') zoomCentre(0.8);
    else if (e.key === '0') set(home(), true);
    else return;
    e.preventDefault();
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

  const zoomButtons = [...tools.querySelectorAll<HTMLButtonElement>('[data-zoom]')];
  const tidy = tools.querySelector<HTMLButtonElement>('[data-tidy]')!;
  const onZoomButton = (e: Event) => zoomCentre((e.currentTarget as HTMLElement).dataset.zoom === 'in' ? 1.25 : 0.8);
  const onTidy = () => set(home(), true);
  const onResize = () => render();

  viewport.addEventListener('pointerdown', onDown);
  viewport.addEventListener('pointermove', onMove);
  viewport.addEventListener('pointerup', onUp);
  viewport.addEventListener('pointercancel', onUp);
  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('keydown', onKey);
  viewport.addEventListener('scroll', onScroll);
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
    zoomButtons.forEach((b) => b.removeEventListener('click', onZoomButton));
    tidy.removeEventListener('click', onTidy);
    window.removeEventListener('resize', onResize);
    world.style.transform = '';
    tools.hidden = true;
    svg.replaceChildren();
  };
}
