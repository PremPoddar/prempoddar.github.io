// Degrees clockwise from straight up, in screen coordinates (y grows downward).
export function arrowAngle(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const deg = (Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI;
  return (deg + 360) % 360;
}
