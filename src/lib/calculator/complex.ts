// Complex numbers on float64. Everything the calculator does runs through
// these, so trig, constants and negatives all share one code path.
// shortcut: float64 only; upgrade to arbitrary precision if users ever see
// visibly wrong digits through deep press chains.

export type C = { re: number; im: number };

export const c = (re: number, im: number): C => ({ re, im });

export const CAdd = (a: C, b: C): C => c(a.re + b.re, a.im + b.im);
export const CSub = (a: C, b: C): C => c(a.re - b.re, a.im - b.im);
export const CMul = (a: C, b: C): C => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);

export function CDiv(a: C, b: C): C {
  if (b.re === 0 && b.im === 0) throw new Error('division by zero');
  const d = b.re * b.re + b.im * b.im;
  return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
}

// e^z = e^re (cos im + i sin im)
export function CExp(z: C): C {
  const m = Math.exp(z.re);
  return c(m * Math.cos(z.im), m * Math.sin(z.im));
}

// Principal branch: ln z = ln|z| + i arg z, arg in (-pi, pi].
export function CLn(z: C): C {
  if (z.re === 0 && z.im === 0) throw new Error('log of zero');
  return c(Math.log(Math.hypot(z.re, z.im)), Math.atan2(z.im, z.re));
}

export function closeTo(a: C, b: C, tol = 1e-9): boolean {
  const ok = (x: number, y: number) => Math.abs(x - y) <= tol * Math.max(1, Math.abs(y));
  return ok(a.re, b.re) && ok(a.im, b.im);
}
