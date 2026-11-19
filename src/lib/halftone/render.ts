export const CELLS_PER_MODULE = 3;
export const QUIET_MODULES = 4;
export const QUIET_CELLS = QUIET_MODULES * CELLS_PER_MODULE;

export type DitherMode = 'floyd' | 'atkinson' | 'bayer4' | 'bayer8' | 'threshold';

export interface SvgOptions {
  grid: Uint8Array;
  modules: number;
  ink: string;
  paper: string;
  transparent: boolean;
  quietZone: boolean;
}

export function totalCellsFor(modules: number, quietZone: boolean): number {
  return modules * CELLS_PER_MODULE + (quietZone ? QUIET_CELLS * 2 : 0);
}

export function applyTone(input: Float32Array, brightness: number, contrast: number): Float32Array {
  const output = new Float32Array(input.length);
  const factor = contrast / 100;

  for (let i = 0; i < input.length; i += 1) {
    const value = (input[i] - 128) * factor + 128 + brightness;
    output[i] = Math.min(255, Math.max(0, value));
  }

  return output;
}

export function applyToneRgb(
  input: Uint8ClampedArray,
  brightness: number,
  contrast: number,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(input.length);
  const factor = contrast / 100;

  for (let i = 0; i < input.length; i += 4) {
    output[i] = (input[i] - 128) * factor + 128 + brightness;
    output[i + 1] = (input[i + 1] - 128) * factor + 128 + brightness;
    output[i + 2] = (input[i + 2] - 128) * factor + 128 + brightness;
    output[i + 3] = input[i + 3];
  }

  return output;
}

function bayerMatrix(size: 4 | 8): number[][] {
  let matrix = [[0, 2], [3, 1]];

  while (matrix.length < size) {
    const next: number[][] = [];
    for (let y = 0; y < matrix.length; y += 1) {
      const top: number[] = [];
      const bottom: number[] = [];
      for (let x = 0; x < matrix.length; x += 1) {
        const value = matrix[y][x] * 4;
        top.push(value, value + 2);
        bottom.push(value + 3, value + 1);
      }
      next.push(top, bottom);
    }
    matrix = next;
  }

  return matrix;
}

const BAYER_4 = bayerMatrix(4);
const BAYER_8 = bayerMatrix(8);

function orderedDither(values: Float32Array, width: number, height: number, matrix: number[][]): Uint8Array {
  const output = new Uint8Array(values.length);
  const cells = matrix.length * matrix.length;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const threshold = (matrix[y % matrix.length][x % matrix.length] + 0.5) / cells;
      output[index] = values[index] / 255 > threshold ? 0 : 1;
    }
  }

  return output;
}

function diffuse(values: Float32Array, width: number, height: number, mode: 'floyd' | 'atkinson'): Uint8Array {
  const output = new Uint8Array(values.length);
  const work = Float32Array.from(values);

  const spread = (x: number, y: number, error: number, weight: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    work[y * width + x] += error * weight;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const old = work[index];
      const next = old < 128 ? 0 : 255;
      const error = old - next;
      output[index] = next === 0 ? 1 : 0;

      if (mode === 'floyd') {
        spread(x + 1, y, error, 7 / 16);
        spread(x - 1, y + 1, error, 3 / 16);
        spread(x, y + 1, error, 5 / 16);
        spread(x + 1, y + 1, error, 1 / 16);
      } else {
        spread(x + 1, y, error, 1 / 8);
        spread(x + 2, y, error, 1 / 8);
        spread(x - 1, y + 1, error, 1 / 8);
        spread(x, y + 1, error, 1 / 8);
        spread(x + 1, y + 1, error, 1 / 8);
        spread(x, y + 2, error, 1 / 8);
      }
    }
  }

  return output;
}

export function dither(
  values: Float32Array,
  width: number,
  height: number,
  mode: DitherMode,
): Uint8Array {
  if (values.length !== width * height) {
    throw new Error('Pixel buffer does not match the given size.');
  }

  if (mode === 'floyd' || mode === 'atkinson') return diffuse(values, width, height, mode);
  if (mode === 'bayer4') return orderedDither(values, width, height, BAYER_4);
  if (mode === 'bayer8') return orderedDither(values, width, height, BAYER_8);

  const output = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i += 1) output[i] = values[i] >= 128 ? 0 : 1;
  return output;
}

export function composeGrid(
  dark: Uint8Array,
  reserved: Uint8Array,
  modules: number,
  image: Uint8Array,
): Uint8Array {
  const size = modules * CELLS_PER_MODULE;
  if (dark.length !== modules * modules || reserved.length !== modules * modules) {
    throw new Error('QR buffers do not match the module count.');
  }
  if (image.length !== size * size) {
    throw new Error('Image buffer does not match the cell grid.');
  }

  const output = new Uint8Array(size * size);

  for (let moduleRow = 0; moduleRow < modules; moduleRow += 1) {
    for (let moduleCol = 0; moduleCol < modules; moduleCol += 1) {
      const module = moduleRow * modules + moduleCol;
      for (let cellRow = 0; cellRow < CELLS_PER_MODULE; cellRow += 1) {
        for (let cellCol = 0; cellCol < CELLS_PER_MODULE; cellCol += 1) {
          const row = moduleRow * CELLS_PER_MODULE + cellRow;
          const col = moduleCol * CELLS_PER_MODULE + cellCol;
          const index = row * size + col;
          const isCentre = cellRow === 1 && cellCol === 1;

          output[index] =
            reserved[module] === 1 || isCentre ? dark[module] : image[index];
        }
      }
    }
  }

  return output;
}

export function cellSizeFor(target: number, totalCells: number): number {
  return Math.max(2, Math.round(target / totalCells));
}

export function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Not a hex colour: ${hex}`);

  const value = match[1].length === 3
    ? match[1].split('').map((character) => character + character).join('')
    : match[1];

  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

export function relativeLuminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex);
  const channel = (value: number) => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

export function buildSvg(options: SvgOptions): string {
  const { grid, modules, ink, paper, transparent, quietZone } = options;
  const size = modules * CELLS_PER_MODULE;

  if (grid.length !== size * size) {
    throw new Error('Cell grid does not match the module count.');
  }

  const total = totalCellsFor(modules, quietZone);
  const offset = quietZone ? QUIET_CELLS : 0;
  const path = pathRuns(grid, size, offset);

  const background = transparent ? '' : `<rect width="${total}" height="${total}" fill="${paper}"/>`;
  const inkPath = path ? `<path fill="${ink}" d="${path}"/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">${background}${inkPath}</svg>`;
}

function pathRuns(grid: Uint8Array, size: number, offset: number): string {
  const runs: string[] = [];

  for (let y = 0; y < size; y += 1) {
    let x = 0;
    while (x < size) {
      if (grid[y * size + x] === 0) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < size && grid[y * size + x] === 1) x += 1;
      const length = x - start;
      runs.push(`M${start + offset} ${y + offset}h${length}v1h-${length}z`);
    }
  }

  return runs.join('');
}

export interface ColourSvgOptions {
  photoHref: string;
  modules: number;
  dark: Uint8Array;
  reserved: Uint8Array;
  ink: string;
  paper: string;
  transparent: boolean;
  quietZone: boolean;
}

export function buildColourSvg(options: ColourSvgOptions): string {
  const { photoHref, modules, dark, reserved, ink, paper, transparent, quietZone } = options;
  const size = modules * CELLS_PER_MODULE;

  if (dark.length !== modules * modules || reserved.length !== modules * modules) {
    throw new Error('QR buffers do not match the module count.');
  }

  const total = totalCellsFor(modules, quietZone);
  const offset = quietZone ? QUIET_CELLS : 0;
  const inkCells = new Uint8Array(size * size);
  const paperCells = new Uint8Array(size * size);

  for (let moduleRow = 0; moduleRow < modules; moduleRow += 1) {
    for (let moduleCol = 0; moduleCol < modules; moduleCol += 1) {
      const module = moduleRow * modules + moduleCol;
      for (let cellRow = 0; cellRow < CELLS_PER_MODULE; cellRow += 1) {
        for (let cellCol = 0; cellCol < CELLS_PER_MODULE; cellCol += 1) {
          const isCentre = cellRow === 1 && cellCol === 1;
          if (reserved[module] !== 1 && !isCentre) continue;

          const row = moduleRow * CELLS_PER_MODULE + cellRow;
          const col = moduleCol * CELLS_PER_MODULE + cellCol;
          const index = row * size + col;
          if (dark[module] === 1) inkCells[index] = 1;
          else paperCells[index] = 1;
        }
      }
    }
  }

  const background = transparent ? '' : `<rect width="${total}" height="${total}" fill="${paper}"/>`;
  const photo = `<image href="${photoHref}" x="${offset}" y="${offset}" width="${size}" height="${size}" preserveAspectRatio="none" style="image-rendering:pixelated"/>`;
  const inkPath = pathRuns(inkCells, size, offset);
  const paperPath = pathRuns(paperCells, size, offset);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">${background}${photo}${paperPath ? `<path fill="${paper}" d="${paperPath}"/>` : ''}${inkPath ? `<path fill="${ink}" d="${inkPath}"/>` : ''}</svg>`;
}
