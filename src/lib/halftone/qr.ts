import qrcode from 'qrcode-generator';

export type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export interface QrResult {
  version: number;
  modules: number;
  dark: Uint8Array;
  reserved: Uint8Array;
}

export class QrTooLongError extends Error {
  constructor(message = 'This text does not fit the selected version and error correction level.') {
    super(message);
    this.name = 'QrTooLongError';
  }
}

// qrcode-generator defaults to Latin-1. QR codes carry bytes, so encode UTF-8.
qrcode.stringToBytes = (text: string) => Array.from(new TextEncoder().encode(text));

export function alignmentCenters(version: number): number[] {
  if (version === 1) return [];

  const size = version * 4 + 17;
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((size - 13) / (count * 2 - 2)) * 2;
  const centers = [6];

  for (let position = size - 7; centers.length < count; position -= step) {
    centers.splice(1, 0, position);
  }

  return centers;
}

export function reservedMask(version: number): Uint8Array {
  const size = version * 4 + 17;
  const mask = new Uint8Array(size * size);

  const rect = (top: number, left: number, height: number, width: number) => {
    for (let y = top; y < top + height; y += 1) {
      for (let x = left; x < left + width; x += 1) {
        mask[y * size + x] = 1;
      }
    }
  };

  // Finder patterns, separators and format information.
  rect(0, 0, 9, 9);
  rect(0, size - 8, 9, 8);
  rect(size - 8, 0, 8, 9);

  // Timing patterns. The corners are already covered above.
  for (let i = 9; i < size - 8; i += 1) {
    mask[6 * size + i] = 1;
    mask[i * size + 6] = 1;
  }

  // Alignment patterns, except where they would sit on the finder corners.
  const centers = alignmentCenters(version);
  const last = centers.length - 1;
  for (let row = 0; row < centers.length; row += 1) {
    for (let col = 0; col < centers.length; col += 1) {
      const overlapsFinder =
        (row === 0 && col === 0) ||
        (row === 0 && col === last) ||
        (row === last && col === 0);
      if (!overlapsFinder) rect(centers[row] - 2, centers[col] - 2, 5, 5);
    }
  }

  // Version information, from version 7.
  if (version >= 7) {
    rect(0, size - 11, 6, 3);
    rect(size - 11, 0, 3, 6);
  }

  return mask;
}

export function makeQr(text: string, errorCorrection: ErrorCorrection, version = 0): QrResult {
  if (!Number.isInteger(version) || version < 0 || version > 40) {
    throw new RangeError('Version must be a whole number from 0 to 40.');
  }

  const qr = qrcode(version as Parameters<typeof qrcode>[0], errorCorrection);
  qr.addData(text);

  try {
    qr.make();
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new QrTooLongError();
  }

  const modules = qr.getModuleCount();
  const actualVersion = (modules - 17) / 4;
  const dark = new Uint8Array(modules * modules);

  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      dark[row * modules + col] = qr.isDark(row, col) ? 1 : 0;
    }
  }

  return {
    version: actualVersion,
    modules,
    dark,
    reserved: reservedMask(actualVersion),
  };
}
