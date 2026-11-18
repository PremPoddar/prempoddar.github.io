export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clampFocus(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function coverRect(
  imageWidth: number,
  imageHeight: number,
  outputSize: number,
  zoom: number,
  focusX: number,
  focusY: number,
): Rect {
  const scale = Math.max(outputSize / imageWidth, outputSize / imageHeight) * zoom;
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: (outputSize - width) * clampFocus(focusX) || 0,
    y: (outputSize - height) * clampFocus(focusY) || 0,
    w: width,
    h: height,
  };
}

export function containRect(imageWidth: number, imageHeight: number, outputSize: number): Rect {
  const scale = Math.min(outputSize / imageWidth, outputSize / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: (outputSize - width) / 2,
    y: (outputSize - height) / 2,
    w: width,
    h: height,
  };
}

export function panFocus(
  focusX: number,
  focusY: number,
  deltaX: number,
  deltaY: number,
  rangeX: number,
  rangeY: number,
): { x: number; y: number } {
  return {
    x: rangeX > 0 ? clampFocus(focusX - deltaX / rangeX) : clampFocus(focusX),
    y: rangeY > 0 ? clampFocus(focusY - deltaY / rangeY) : clampFocus(focusY),
  };
}
