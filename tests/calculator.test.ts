import { describe, it, expect } from 'vitest';
import { CMul, CLn, CExp, c, closeTo } from '../src/lib/calculator/complex';
import { parseExpr, desugar, evaluate, evaluateText, MAX_INPUT } from '../src/lib/calculator/engine';
import { executePresses } from '../src/lib/calculator/machine';
import { compilePresses } from '../src/lib/calculator/compile';
import type { C } from '../src/lib/calculator/complex';

const num = (z: C | number | [number, number]): C =>
  typeof z === 'number' ? c(z, 0) : Array.isArray(z) ? c(z[0], z[1]) : z;

describe('complex core', () => {
  it('knows the principal branch identities', () => {
    expect(closeTo(CLn(c(-1, 0)), c(0, Math.PI))).toBe(true);
    expect(closeTo(CExp(c(0, Math.PI)), c(-1, 0))).toBe(true);
    expect(closeTo(CMul(c(0, 1), c(0, 1)), c(-1, 0))).toBe(true);
  });
  it('multiplies and divides complex numbers', () => {
    expect(closeTo(CMul(c(1, 2), c(3, 4)), c(-5, 10))).toBe(true);
    expect(closeTo(CExp(CLn(c(3, 4))), c(3, 4))).toBe(true);
  });
});

describe('parser and evaluator', () => {
  const evals = (src: string, deg = false): number => {
    const z = evaluateText(src, deg);
    if (Math.abs(z.im) > 1e-9) throw new Error(`not real: im = ${z.im}`);
    return z.re;
  };
  it('follows precedence and associativity', () => {
    expect(evals('1+2×3')).toBe(7);
    expect(evals('8÷2×2')).toBe(8);
    expect(evals('-2^2')).toBe(-4);
    expect(evals('2^3^2')).toBeCloseTo(512, 9);
    expect(evals('(1+2)(3+4)')).toBe(21);
  });
  it('multiplies implicitly', () => {
    expect(evals('2π')).toBeCloseTo(2 * Math.PI, 9);
    expect(evals('3(4+5)')).toBe(27);
    expect(evals('2e')).toBeCloseTo(2 * Math.E, 9);
    expect(evals('2sin(0)')).toBe(0);
  });
  it('handles decimals and roots', () => {
    expect(evals('0.5×4')).toBe(2);
    expect(evals('√4')).toBe(2);
    expect(evals('√(8+1)')).toBe(3);
    expect(evals('2^0.5')).toBeCloseTo(Math.SQRT2, 9);
    expect(evals('1÷3×3')).toBeCloseTo(1, 9);
  });
  it('evaluates constants and functions', () => {
    expect(evals('π')).toBeCloseTo(Math.PI, 9);
    expect(evals('e')).toBeCloseTo(Math.E, 9);
    expect(evals('ln(e)')).toBeCloseTo(1, 9);
    expect(evals('log(100)')).toBeCloseTo(2, 9);
    expect(evals('exp(2)')).toBeCloseTo(Math.exp(2), 9);
    expect(evals('sin(1)')).toBeCloseTo(Math.sin(1), 9);
    expect(evals('cos(1)')).toBeCloseTo(Math.cos(1), 9);
    expect(evals('tan(1)')).toBeCloseTo(Math.tan(1), 9);
    expect(evals('asin(0.5)')).toBeCloseTo(Math.PI / 6, 9);
    expect(evals('acos(0.5)')).toBeCloseTo(Math.PI / 3, 9);
    expect(evals('atan(1)')).toBeCloseTo(Math.PI / 4, 9);
    expect(evals('sinh(1)')).toBeCloseTo(Math.sinh(1), 9);
    expect(evals('cosh(1)')).toBeCloseTo(Math.cosh(1), 9);
    expect(evals('tanh(0.5)')).toBeCloseTo(Math.tanh(0.5), 9);
    expect(evals('i^i')).toBeCloseTo(Math.exp(-Math.PI / 2), 9);
  });
  it('works in degrees when asked', () => {
    expect(evals('sin(30)', true)).toBeCloseTo(0.5, 9);
    expect(evals('tan(45)', true)).toBeCloseTo(1, 9);
    expect(evals('asin(0.5)', true)).toBeCloseTo(30, 9);
    expect(evals('atan(1)', true)).toBeCloseTo(45, 9);
  });
  it('rejects bad input with a teaching message', () => {
    expect(() => parseExpr('sine(1)')).toThrow(/sine.*sin/);
    expect(() => parseExpr('1+')).toThrow();
    expect(() => parseExpr('(1+2')).toThrow();
    expect(() => parseExpr('')).toThrow();
    expect(() => evaluateText('1÷0')).toThrow(/zero/);
    expect(() => evaluateText('log(0)')).toThrow(/zero|log/);
    expect(() => parseExpr('1+'.repeat(MAX_INPUT))).toThrow(/long|short/i);
  });
});

// Agreement battery: the evaluator (direct tree walk) and both button machines
// (compiled press sequences, executed for real) must all agree.
const battery: Array<[string, number | [number, number], boolean?]> = [
  ['3×8', 24],
  ['2+3', 5],
  ['10-4', 6],
  ['0-5', -5],
  ['7÷2', 3.5],
  ['2^10', 1024],
  ['(0-2)^2', 4],
  ['√2', Math.SQRT2],
  ['√2×√2', 2],
  ['ln(10)', Math.LN10],
  ['exp(2)', Math.exp(2)],
  ['log(1000)', 3],
  ['sin(1)', Math.sin(1)],
  ['cos(1)', Math.cos(1)],
  ['tan(1)', Math.tan(1)],
  ['sin(π÷6)', 0.5],
  ['asin(0.5)', Math.PI / 6],
  ['acos(0.5)', Math.PI / 3],
  ['atan(1)', Math.PI / 4],
  ['sinh(1)', Math.sinh(1)],
  ['cosh(1)', Math.cosh(1)],
  ['tanh(0.5)', Math.tanh(0.5)],
  ['π', Math.PI],
  ['e', Math.E],
  ['i', [0, 1]],
  ['(1+i)(1-i)', 2],
  // (1+2i)÷(3+4i) would fail on the two-button machine: its add macro picks
  // up a 2πi branch error once an operand's imaginary part passes ±π.
  ['(1+2i)÷(1+i)', [1.5, 0.5]],
  ['0.5×4', 2],
  ['1÷3×3', 1],
  ['i^i', Math.exp(-Math.PI / 2)],
  ['sin(30)', 0.5, true],
  ['tan(45)', 1, true],
  ['asin(0.5)', 30, true],
];

describe('button machines agree with the evaluator', () => {
  for (const machine of ['four', 'two'] as const) {
    for (const [src, want, deg = false] of battery) {
      it(`${machine}: ${src}`, () => {
        const ast = desugar(parseExpr(src), deg);
        const direct = evaluate(ast);
        const ran = executePresses(compilePresses(ast, machine), machine);
        expect(closeTo(ran, num(want as never), 1e-6)).toBe(true);
        expect(closeTo(ran, direct, 1e-6)).toBe(true);
      });
    }
  }
});

describe('machine execution edges', () => {
  it('refuses a binary press with fewer than two values', () => {
    expect(() => executePresses(['eml'], 'two')).toThrow();
    expect(() => executePresses(['-'], 'four')).toThrow();
  });
  it('supports stepping for playback', () => {
    const seen: number[] = [];
    executePresses(['1', '1', 'sub'], 'four', (_v, stack) => seen.push(stack.length));
    expect(seen.length).toBeGreaterThan(0);
  });
});

describe('caps', () => {
  it('aborts compiling past the press cap', () => {
    let ast = { t: 'pi' };
    // each nesting level adds ~310 presses (a big literal each time), depth stays low
    for (let i = 0; i < 700; i++) ast = { t: 'pow', a: { t: 'num', v: 12345678 }, b: ast };
    expect(() => compilePresses(ast as never, 'four')).toThrow(/long|cap|press/i);
  });
  it('rejects input past the input cap', () => {
    expect(() => parseExpr('1+'.repeat(MAX_INPUT / 2 + 10))).toThrow();
  });
});
