import { makeQr, QrTooLongError, type ErrorCorrection, type QrResult } from '../lib/halftone/qr';
import {
  applyTone,
  buildSvg,
  cellSizeFor,
  composeGrid,
  contrastRatio,
  dither,
  hexToRgb,
  relativeLuminance,
  totalCellsFor,
  CELLS_PER_MODULE,
  QUIET_CELLS,
  type DitherMode,
} from '../lib/halftone/render';
import { containRect, coverRect, panFocus } from '../lib/halftone/crop';

const PREVIEW_SIZE = 720;
const FRAME_SIZE = 240;
const MAX_BYTES = 1200;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

type Fit = 'cover' | 'contain';

interface State {
  text: string;
  ec: ErrorCorrection;
  version: number;
  quiet: boolean;
  transparent: boolean;
  dither: DitherMode;
  ink: string;
  paper: string;
  brightness: number;
  contrast: number;
  fit: Fit;
  zoom: number;
  focusX: number;
  focusY: number;
  source: CanvasImageSource | null;
  sourceWidth: number;
  sourceHeight: number;
  qr: QrResult | null;
  cells: Uint8Array | null;
  totalCells: number;
  cellSize: number;
}

function query<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');
  return ctx;
}

function makeSample(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  const ctx = context(canvas);

  ctx.fillStyle = '#ece7d8';
  ctx.fillRect(0, 0, 1200, 900);

  ctx.fillStyle = '#fffdf4';
  ctx.beginPath();
  ctx.arc(880, 250, 150, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#b0bcac';
  ctx.beginPath();
  ctx.moveTo(0, 600);
  ctx.lineTo(180, 505);
  ctx.lineTo(360, 570);
  ctx.lineTo(560, 455);
  ctx.lineTo(780, 555);
  ctx.lineTo(960, 490);
  ctx.lineTo(1200, 560);
  ctx.lineTo(1200, 900);
  ctx.lineTo(0, 900);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#556c59';
  ctx.beginPath();
  ctx.moveTo(0, 690);
  ctx.lineTo(220, 615);
  ctx.lineTo(430, 665);
  ctx.lineTo(640, 590);
  ctx.lineTo(860, 655);
  ctx.lineTo(1040, 610);
  ctx.lineTo(1200, 650);
  ctx.lineTo(1200, 900);
  ctx.lineTo(0, 900);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#18261c';
  ctx.beginPath();
  ctx.moveTo(0, 790);
  ctx.lineTo(200, 745);
  ctx.lineTo(420, 780);
  ctx.lineTo(640, 805);
  ctx.lineTo(860, 760);
  ctx.lineTo(1080, 800);
  ctx.lineTo(1200, 780);
  ctx.lineTo(1200, 900);
  ctx.lineTo(0, 900);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f7f1de';
  ctx.beginPath();
  ctx.moveTo(700, 640);
  ctx.quadraticCurveTo(660, 760, 600, 900);
  ctx.lineTo(830, 900);
  ctx.quadraticCurveTo(760, 760, 745, 640);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#101d16';
  ctx.fillRect(248, 600, 26, 190);
  for (const [x, y, r] of [[261, 585, 92], [205, 625, 66], [320, 625, 62]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

export function initHalftoneQr(): void {
  const stage = query<HTMLElement>('[data-stage]');
  const preview = query<HTMLCanvasElement>('[data-preview]');
  const previewCtx = context(preview);
  const frame = query<HTMLCanvasElement>('[data-frame]');
  const frameCtx = context(frame);
  const frameRow = query<HTMLElement>('[data-frame-row]');
  const meta = query<HTMLElement>('[data-meta]');
  const textEl = query<HTMLTextAreaElement>('[data-text]');
  const countEl = query<HTMLOutputElement>('[data-count]');
  const textError = query<HTMLElement>('[data-text-error]');
  const ecEl = query<HTMLSelectElement>('[data-ec]');
  const versionEl = query<HTMLSelectElement>('[data-version]');
  const ditherEl = query<HTMLSelectElement>('[data-dither]');
  const quietEl = query<HTMLInputElement>('[data-quiet]');
  const transparentEl = query<HTMLInputElement>('[data-transparent]');
  const inkEl = query<HTMLInputElement>('[data-ink]');
  const paperEl = query<HTMLInputElement>('input[data-paper]');
  const brightEl = query<HTMLInputElement>('[data-brightness]');
  const contrastEl = query<HTMLInputElement>('[data-contrast]');
  const brightOut = query<HTMLOutputElement>('[data-bright-out]');
  const contrastOut = query<HTMLOutputElement>('[data-contrast-out]');
  const zoomEl = query<HTMLInputElement>('[data-zoom]');
  const zoomOut = query<HTMLOutputElement>('[data-zoom-out]');
  const fitEl = query<HTMLSelectElement>('[data-fit]');
  const resetCrop = query<HTMLButtonElement>('[data-reset-crop]');
  const sizeEl = query<HTMLSelectElement>('[data-size]');
  const sizeNote = query<HTMLElement>('[data-size-note]');
  const contrastNote = query<HTMLElement>('[data-contrast-note]');
  const fileEl = query<HTMLInputElement>('[data-file]');
  const dropEl = query<HTMLElement>('[data-drop]');
  const fileError = query<HTMLElement>('[data-file-error]');
  const sampleButton = query<HTMLButtonElement>('[data-sample]');
  const statusEl = query<HTMLElement>('[data-status]');
  const pngButton = query<HTMLButtonElement>('[data-download-png]');
  const svgButton = query<HTMLButtonElement>('[data-download-svg]');
  const copyButton = query<HTMLButtonElement>('[data-copy]');
  const scanButton = query<HTMLButtonElement>('[data-scan]');
  const presetButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-preset]'));

  const state: State = {
    text: textEl.value,
    ec: 'H',
    version: 0,
    quiet: true,
    transparent: false,
    dither: 'floyd',
    ink: '#15201a',
    paper: '#fdfdfb',
    brightness: 0,
    contrast: 100,
    fit: 'cover',
    zoom: 1,
    focusX: 0.5,
    focusY: 0.5,
    source: null,
    sourceWidth: 0,
    sourceHeight: 0,
    qr: null,
    cells: null,
    totalCells: 0,
    cellSize: 0,
  };

  let queued = false;

  function scheduleRender(): void {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }

  function setError(node: HTMLElement, message: string): void {
    node.textContent = message;
    node.hidden = message === '';
  }

  function setStatus(message: string, tone: 'ok' | 'bad' | '' = ''): void {
    statusEl.textContent = message;
    statusEl.className = tone ? `status ${tone}` : 'status';
  }

  function setEnabled(enabled: boolean): void {
    for (const button of [pngButton, svgButton, copyButton, scanButton]) button.disabled = !enabled;
  }

  function drawSource(ctx: CanvasRenderingContext2D, outputSize: number): void {
    if (!state.source) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (state.fit === 'contain') {
      const rect = containRect(state.sourceWidth, state.sourceHeight, outputSize);
      ctx.drawImage(state.source, rect.x, rect.y, rect.w, rect.h);
      return;
    }

    const rect = coverRect(
      state.sourceWidth,
      state.sourceHeight,
      outputSize,
      state.zoom,
      state.focusX,
      state.focusY,
    );
    ctx.drawImage(state.source, rect.x, rect.y, rect.w, rect.h);
  }

  function drawFrame(): void {
    frameCtx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);
    frameCtx.fillStyle = '#ffffff';
    frameCtx.fillRect(0, 0, FRAME_SIZE, FRAME_SIZE);

    if (!state.source) {
      frameCtx.fillStyle = '#56655b';
      frameCtx.font = '13px ui-monospace, monospace';
      frameCtx.textAlign = 'center';
      frameCtx.fillText('No image', FRAME_SIZE / 2, FRAME_SIZE / 2);
      return;
    }

    drawSource(frameCtx, FRAME_SIZE);
  }

  function paintCells(): HTMLCanvasElement {
    const qr = state.qr;
    const cells = state.cells;
    if (!qr || !cells) throw new Error('No code to paint.');

    const total = state.totalCells;
    const size = qr.modules * CELLS_PER_MODULE;
    const offset = state.quiet ? QUIET_CELLS : 0;
    const ink = hexToRgb(state.ink);
    const paper = hexToRgb(state.paper);
    const canvas = document.createElement('canvas');
    canvas.width = total;
    canvas.height = total;
    const ctx = context(canvas);
    const image = ctx.createImageData(total, total);

    for (let y = 0; y < total; y += 1) {
      for (let x = 0; x < total; x += 1) {
        const inside = x >= offset && x < offset + size && y >= offset && y < offset + size;
        const dark = inside ? cells[(y - offset) * size + (x - offset)] === 1 : false;
        const index = (y * total + x) * 4;

        if (dark) {
          image.data[index] = ink[0];
          image.data[index + 1] = ink[1];
          image.data[index + 2] = ink[2];
          image.data[index + 3] = 255;
        } else if (!state.transparent) {
          image.data[index] = paper[0];
          image.data[index + 1] = paper[1];
          image.data[index + 2] = paper[2];
          image.data[index + 3] = 255;
        }
      }
    }

    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  function drawPreview(): void {
    stage.classList.toggle('is-transparent', state.transparent);
    previewCtx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    previewCtx.imageSmoothingEnabled = false;
    previewCtx.drawImage(paintCells(), 0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  }

  function sampledImage(cellSize: number): Uint8Array {
    const canvas = document.createElement('canvas');
    canvas.width = cellSize;
    canvas.height = cellSize;
    const ctx = context(canvas);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cellSize, cellSize);
    drawSource(ctx, cellSize);

    const { data } = ctx.getImageData(0, 0, cellSize, cellSize);
    const luma = new Float32Array(cellSize * cellSize);
    for (let i = 0; i < luma.length; i += 1) {
      const index = i * 4;
      luma[i] = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    }

    return dither(
      applyTone(luma, state.brightness, state.contrast),
      cellSize,
      cellSize,
      state.dither,
    );
  }

  function updateContrastNote(): void {
    const ratio = contrastRatio(state.ink, state.paper);
    const inverted = relativeLuminance(state.ink) >= relativeLuminance(state.paper);

    if (inverted) {
      contrastNote.textContent = 'Ink is lighter than paper. Inverted codes often fail to scan.';
    } else if (ratio < 4.5) {
      contrastNote.textContent = `Contrast is ${ratio.toFixed(1)}:1. Codes usually need at least 4.5:1.`;
    } else {
      contrastNote.textContent = '';
    }
  }

  function updatePresets(): void {
    for (const button of presetButtons) {
      const match = button.dataset.preset === state.ink && button.dataset.presetPaper === state.paper;
      button.setAttribute('aria-pressed', String(match));
    }
  }

  function updateFitState(): void {
    const contain = fitEl.value === 'contain';
    state.fit = contain ? 'contain' : 'cover';
    zoomEl.disabled = contain;
    resetCrop.disabled = contain;
    frameRow.classList.toggle('is-contain', contain);
    frame.setAttribute('aria-disabled', String(contain));
  }

  function invalidate(): void {
    state.qr = null;
    state.cells = null;
    state.totalCells = 0;
    state.cellSize = 0;
    previewCtx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    previewCtx.fillStyle = '#fdfdfb';
    previewCtx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    preview.setAttribute('aria-label', 'No QR code yet');
    meta.textContent = 'No code yet';
    sizeNote.textContent = 'Choose a size to see the exact pixels.';
    setEnabled(false);
    stage.classList.toggle('is-transparent', state.transparent);
    drawFrame();
  }

  function render(): void {
    state.text = textEl.value;
    state.ec = ecEl.value as ErrorCorrection;
    state.version = Number(versionEl.value);
    state.quiet = quietEl.checked;
    state.transparent = transparentEl.checked;
    state.dither = ditherEl.value as DitherMode;
    state.ink = inkEl.value;
    state.paper = paperEl.value;
    state.brightness = Number(brightEl.value);
    state.contrast = Number(contrastEl.value);
    state.fit = fitEl.value as Fit;
    state.zoom = Number(zoomEl.value) / 100;

    brightOut.textContent = String(state.brightness);
    contrastOut.textContent = `${state.contrast}%`;
    zoomOut.textContent = `${Math.round(state.zoom * 100)}%`;
    updatePresets();
    updateContrastNote();

    const bytes = new TextEncoder().encode(state.text).length;
    countEl.textContent = `${bytes} / ${MAX_BYTES} bytes`;
    countEl.classList.toggle('over', bytes > MAX_BYTES);

    if (!state.text.trim()) {
      setError(textError, 'Add a link or some text.');
      invalidate();
      return;
    }

    if (bytes > MAX_BYTES) {
      setError(textError, `That is ${bytes} bytes. Keep the text under ${MAX_BYTES}.`);
      invalidate();
      return;
    }

    try {
      state.qr = makeQr(state.text, state.ec, state.version);
    } catch (error) {
      if (error instanceof QrTooLongError) {
        setError(
          textError,
          state.version
            ? `The text does not fit version ${state.version} at level ${state.ec}. Pick Auto or a higher version.`
            : 'The text is too long for this error correction level.',
        );
      } else {
        setError(textError, 'Could not build the code. Try a shorter link.');
      }
      invalidate();
      return;
    }

    setError(textError, '');

    const size = state.qr.modules * CELLS_PER_MODULE;
    state.cells = composeGrid(
      state.qr.dark,
      state.qr.reserved,
      state.qr.modules,
      sampledImage(size),
    );
    state.totalCells = totalCellsFor(state.qr.modules, state.quiet);
    state.cellSize = cellSizeFor(Number(sizeEl.value), state.totalCells);

    drawPreview();
    setEnabled(true);
    drawFrame();

    meta.textContent = `v${state.qr.version} · ${state.qr.modules} × ${state.qr.modules} modules · ${state.totalCells} cells · ${state.ec}`;
    preview.setAttribute(
      'aria-label',
      `Halftone QR code, version ${state.qr.version}, ${state.qr.modules} by ${state.qr.modules} modules, ${state.totalCells} cells in total.`,
    );

    const pixels = state.cellSize * state.totalCells;
    sizeNote.textContent = `PNG will be ${pixels} × ${pixels} px, with ${state.cellSize} px per cell.`;
    setStatus('');
  }

  function exportCanvas(target: number): HTMLCanvasElement {
    const total = state.totalCells;
    const cell = cellSizeFor(target, total);
    const canvas = document.createElement('canvas');
    canvas.width = cell * total;
    canvas.height = cell * total;
    const ctx = context(canvas);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(paintCells(), 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not make the image.'));
      }, 'image/png');
    });
  }

  function download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function baseName(): string {
    return `halftone-qr-v${state.qr?.version ?? 0}`;
  }

  function useSource(source: CanvasImageSource, width: number, height: number): void {
    if (typeof ImageBitmap !== 'undefined' && state.source instanceof ImageBitmap) {
      state.source.close();
    }
    state.source = source;
    state.sourceWidth = width;
    state.sourceHeight = height;
    state.zoom = 1;
    state.focusX = 0.5;
    state.focusY = 0.5;
    zoomEl.value = '100';
    updateFitState();
    scheduleRender();
  }

  async function loadFile(file: File): Promise<void> {
    const looksLikeImage =
      file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name);

    if (!looksLikeImage) {
      setError(fileError, 'That file is not an image.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(fileError, 'Keep the image under 25 MB.');
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      setError(fileError, '');
      useSource(bitmap, bitmap.width, bitmap.height);
    } catch {
      setError(fileError, 'This browser could not read that image. Try a PNG or JPEG.');
    }
  }

  textEl.addEventListener('input', scheduleRender);
  ecEl.addEventListener('change', scheduleRender);
  versionEl.addEventListener('change', scheduleRender);
  ditherEl.addEventListener('change', scheduleRender);
  quietEl.addEventListener('change', scheduleRender);
  transparentEl.addEventListener('change', scheduleRender);
  sizeEl.addEventListener('change', scheduleRender);
  brightEl.addEventListener('input', scheduleRender);
  contrastEl.addEventListener('input', scheduleRender);
  zoomEl.addEventListener('input', scheduleRender);
  inkEl.addEventListener('input', scheduleRender);
  paperEl.addEventListener('input', scheduleRender);

  fitEl.addEventListener('change', () => {
    updateFitState();
    scheduleRender();
  });

  for (const button of presetButtons) {
    button.addEventListener('click', () => {
      const ink = button.dataset.preset;
      const paper = button.dataset.presetPaper;
      if (!ink || !paper) return;
      inkEl.value = ink;
      paperEl.value = paper;
      scheduleRender();
    });
  }

  resetCrop.addEventListener('click', () => {
    zoomEl.value = '100';
    state.focusX = 0.5;
    state.focusY = 0.5;
    scheduleRender();
  });

  sampleButton.addEventListener('click', () => {
    const sample = makeSample();
    useSource(sample, sample.width, sample.height);
  });

  fileEl.addEventListener('change', () => {
    const file = fileEl.files?.[0];
    if (file) void loadFile(file);
    fileEl.value = '';
  });

  let dragDepth = 0;
  dropEl.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth += 1;
    dropEl.classList.add('over');
  });
  dropEl.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
  });
  dropEl.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropEl.classList.remove('over');
  });
  dropEl.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    dropEl.classList.remove('over');
    const file = event.dataTransfer?.files[0];
    if (file) void loadFile(file);
  });

  window.addEventListener('dragover', (event) => {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  });
  window.addEventListener('drop', (event) => {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  });

  document.addEventListener('paste', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
      entry.type.startsWith('image/'),
    );
    const file = item?.getAsFile();
    if (!file) return;
    event.preventDefault();
    void loadFile(file);
  });

  let pointer: number | null = null;
  let lastX = 0;
  let lastY = 0;

  frame.addEventListener('pointerdown', (event) => {
    if (state.fit !== 'cover') return;
    pointer = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    frame.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  frame.addEventListener('pointermove', (event) => {
    if (pointer !== event.pointerId) return;
    const bounds = frame.getBoundingClientRect();
    const scale = FRAME_SIZE / bounds.width;
    const dx = (event.clientX - lastX) * scale;
    const dy = (event.clientY - lastY) * scale;
    lastX = event.clientX;
    lastY = event.clientY;

    const drawn = coverRect(
      state.sourceWidth,
      state.sourceHeight,
      FRAME_SIZE,
      state.zoom,
      state.focusX,
      state.focusY,
    );
    const next = panFocus(
      state.focusX,
      state.focusY,
      dx,
      dy,
      drawn.w - FRAME_SIZE,
      drawn.h - FRAME_SIZE,
    );
    state.focusX = next.x;
    state.focusY = next.y;
    scheduleRender();
  });

  function endDrag(): void {
    if (pointer !== null && frame.hasPointerCapture(pointer)) frame.releasePointerCapture(pointer);
    pointer = null;
  }

  frame.addEventListener('pointerup', endDrag);
  frame.addEventListener('pointercancel', endDrag);
  frame.addEventListener('lostpointercapture', () => {
    pointer = null;
  });

  frame.addEventListener('keydown', (event) => {
    if (state.fit !== 'cover') return;
    const step = event.shiftKey ? 0.12 : 0.04;
    let dx = 0;
    let dy = 0;

    if (event.key === 'ArrowLeft') dx = -step;
    else if (event.key === 'ArrowRight') dx = step;
    else if (event.key === 'ArrowUp') dy = -step;
    else if (event.key === 'ArrowDown') dy = step;
    else return;

    event.preventDefault();
    const next = panFocus(state.focusX, state.focusY, dx, dy, 1, 1);
    state.focusX = next.x;
    state.focusY = next.y;
    scheduleRender();
  });

  pngButton.addEventListener('click', async () => {
    if (!state.qr) return;
    pngButton.disabled = true;
    try {
      const canvas = exportCanvas(Number(sizeEl.value));
      const blob = await canvasBlob(canvas);
      download(blob, `${baseName()}-${canvas.width}.png`);
      setStatus(`Downloaded a ${canvas.width} × ${canvas.height} px PNG.`, 'ok');
    } catch {
      setStatus('Could not make the PNG. Try another size.', 'bad');
    } finally {
      if (state.qr) pngButton.disabled = false;
    }
  });

  svgButton.addEventListener('click', () => {
    const qr = state.qr;
    const cells = state.cells;
    if (!qr || !cells) return;
    const svg = buildSvg({
      grid: cells,
      modules: qr.modules,
      ink: state.ink,
      paper: state.paper,
      transparent: state.transparent,
      quietZone: state.quiet,
    });
    download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${baseName()}.svg`);
    setStatus('Downloaded the SVG.', 'ok');
  });

  copyButton.addEventListener('click', async () => {
    if (!state.qr) return;
    const ClipboardItemCtor = window.ClipboardItem;
    if (!navigator.clipboard?.write || !ClipboardItemCtor) {
      setStatus('This browser does not allow copying images. Use Download PNG instead.', 'bad');
      return;
    }
    try {
      copyButton.disabled = true;
      const blob = await canvasBlob(exportCanvas(1024));
      await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
      setStatus('Image copied to the clipboard.', 'ok');
    } catch {
      setStatus('Could not copy the image. Use Download PNG instead.', 'bad');
    } finally {
      if (state.qr) copyButton.disabled = false;
    }
  });

  scanButton.addEventListener('click', async () => {
    if (!state.qr) return;
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
        };
      }
    ).BarcodeDetector;

    if (!Detector) {
      setStatus(
        'This browser has no built-in QR scanner. Open the PNG on a phone and use the camera.',
        '',
      );
      return;
    }

    try {
      scanButton.disabled = true;
      const detector = new Detector({ formats: ['qr_code'] });
      const found = await detector.detect(exportCanvas(Math.max(1024, Number(sizeEl.value))));
      if (found.length === 0) {
        setStatus('No code found. Try more contrast, a larger size, or error correction H.', 'bad');
        return;
      }
      const value = found[0].rawValue ?? '';
      if (value === state.text) {
        setStatus(`Scanned: ${value}`, 'ok');
      } else {
        setStatus(`Scanned a different value: ${value}`, 'bad');
      }
    } catch {
      setStatus('The scan check failed in this browser. Try the PNG on a phone camera.', 'bad');
    } finally {
      if (state.qr) scanButton.disabled = false;
    }
  });

  updateFitState();
  state.source = makeSample();
  state.sourceWidth = 1200;
  state.sourceHeight = 900;
  drawFrame();
  render();
}
