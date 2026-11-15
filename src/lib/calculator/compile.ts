// Compiles a desugared expression tree into raw button presses for either
// machine. Each machine implements the same macro interface (add, sub, mul,
// div, pow, sqrt, ln, exp and the constants), so the tree walk is shared.
import type { Ast } from './engine';
import type { Press, MachineName } from './machine';

export const MAX_PRESSES = 200000;

type Prog = Press[];
type Mode = 'raw' | 'log';
type Comp = (v: Ast, mode: Mode) => Prog;

const N = (v: number): Ast => ({ t: 'num', v });
const is = (x: Ast, v: number) => x.t === 'num' && x.v === v;
const lit0 = (x: Ast) => is(x, 0);

// Presses for the literal 2, hardcoded to break the recursion
// (2 needs ln 2 inside its own construction otherwise).
const FOUR_2: Prog = ['1', '1', '1', '-', '1', '-', '-'];
// -1 = EML(ln(e-1), exp e): e-1 = EML(1, e), then ln and exp as macros below.
const TWO_NEG1: Prog = [
  '1', '1', '1', '1', '1', 'eml', 'eml', 'eml', '1', 'eml', 'eml',
  '1', '1', 'eml', '1', 'eml', 'eml',
];
// 2 = EML(ln 1, exp(-1)) = 1 - (-1)
const TWO_2: Prog = [...twoLnOf(['1']), ...TWO_NEG1, '1', 'eml', 'eml'];

// ln x = EML(1, exp(EML(1, x))), spelled out so TWO_2 can use it before the
// machine object exists.
function twoLnOf(inner: Prog): Prog {
  return ['1', '1', ...inner, 'eml', '1', 'eml', 'eml'];
}

interface Machine {
  zero: Prog;
  two: Prog;
  add(a: Ast, b: Ast): Prog;
  sub(a: Ast, b: Ast): Prog;
  mul(a: Ast, b: Ast): Prog;
  div(a: Ast, b: Ast): Prog;
  pow(a: Ast, b: Ast): Prog;
  neg(a: Ast): Prog;
  sqrt(a: Ast): Prog;
  ln(a: Ast): Prog;
  exp(a: Ast): Prog;
  pi(): Prog;
  e(): Prog;
  i(): Prog;
}

function fourMachine(comp: Comp): Machine {
  const m: Machine = {
    zero: ['1', '1', '-'],
    two: FOUR_2,
    add: (a, b) => [...comp(a, 'raw'), ...m.zero, ...comp(b, 'raw'), '-', '-'],
    sub: (a, b) => [...comp(a, 'raw'), ...comp(b, 'raw'), '-'],
    mul: (a, b) =>
      lit0(a) || lit0(b) ? [...m.zero]
      : is(a, 1) ? comp(b, 'raw') : is(b, 1) ? comp(a, 'raw')
      : [...comp(a, 'raw'), 'ln', ...m.zero, ...comp(b, 'raw'), 'ln', '-', '-', 'exp'],
    div: (a, b) => (is(a, 0) ? [...m.zero] : [...comp(a, 'raw'), 'ln', ...comp(b, 'raw'), 'ln', '-', 'exp']),
    pow: (a, b) =>
      is(b, 0) || is(a, 1) ? ['1']
      : is(b, 1) ? comp(a, 'raw')
      : [...comp(b, 'raw'), 'ln', ...m.zero, ...comp(a, 'log'), 'ln', '-', '-', 'exp', 'exp'],
    neg: (a) => [...m.zero, ...comp(a, 'raw'), '-'],
    sqrt: (a) =>
      is(a, 0) ? [...m.zero] : is(a, 1) ? ['1']
      : [...comp(a, 'log'), 'ln', ...comp(N(2), 'log'), '-', 'exp', 'exp'],
    ln: (a) => comp(a, 'log'),
    exp: (a) => [...comp(a, 'raw'), 'exp'],
    // pi = -i * ln(-1); i = sqrt(-1)
    pi: () => comp({ t: 'mul', a: { t: 'neg', a: { t: 'i' } }, b: { t: 'ln', a: { t: 'neg', a: N(1) } } }, 'raw'),
    e: () => ['1', 'exp'],
    i: () => comp({ t: 'sqrt', a: { t: 'neg', a: N(1) } }, 'raw'),
  };
  return m;
}

function twoMachine(comp: Comp): Machine {
  const m: Machine = {
    zero: ['1', '1', '1', 'eml', '1', 'eml', 'eml'],
    two: TWO_2,
    // a + b = EML(ln a, exp(-b)); the literal-1 case skips neg entirely.
    // exp(-b) underflows to 0 once b > ~709, which then fails as ln 0:
    // the two-button machine cannot add numbers past about e^709 this way.
    add: (a, b) =>
      is(a, 0) ? comp(b, 'raw')
      : is(b, 1) ? [...comp({ t: 'ln', a }, 'raw'), ...TWO_NEG1, '1', 'eml', 'eml']
      : [...comp({ t: 'ln', a }, 'raw'), ...comp({ t: 'exp', a: { t: 'neg', a: b } }, 'raw'), 'eml'],
    // a - b = EML(ln a, exp b)
    sub: (a, b) =>
      is(a, 0) ? m.neg(b)
      : [...comp({ t: 'ln', a }, 'raw'), ...comp({ t: 'exp', a: b }, 'raw'), 'eml'],
    // a×b = exp(ln a + ln b)
    mul: (a, b) =>
      lit0(a) || lit0(b) ? [...m.zero]
      : is(a, 1) ? comp(b, 'raw') : is(b, 1) ? comp(a, 'raw')
      : [...comp({ t: 'add', a: { t: 'ln', a }, b: { t: 'ln', a: b } }, 'raw'), '1', 'eml'],
    // a÷b = exp(ln a - ln b); the literal-1 case avoids ln(ln 1) = ln 0
    div: (a, b) =>
      is(a, 0) ? [...m.zero]
      : is(a, 1) ? [...comp({ t: 'neg', a: { t: 'ln', a: b } }, 'raw'), '1', 'eml']
      : [...comp({ t: 'sub', a: { t: 'ln', a }, b: { t: 'ln', a: b } }, 'raw'), '1', 'eml'],
    // a^b = exp(b × ln a)
    pow: (a, b) =>
      is(b, 0) || is(a, 1) ? ['1']
      : is(b, 1) ? comp(a, 'raw')
      : [...comp({ t: 'mul', a: b, b: { t: 'ln', a } }, 'raw'), '1', 'eml'],
    // -z = EML(0, exp(z + 1)) = 1 - (z + 1)
    neg: (a) => [...m.zero, ...comp({ t: 'add', a, b: N(1) }, 'raw'), '1', 'eml', 'eml'],
    // √z = exp(ln z × ½)
    sqrt: (a) =>
      is(a, 0) ? [...m.zero] : is(a, 1) ? ['1']
      : [...comp({ t: 'mul', a: { t: 'ln', a }, b: N(0.5) }, 'raw'), '1', 'eml'],
    // ln x = EML(1, exp(EML(1, x))) — mis-signs negative reals (branch wrap)
    ln: (a) => twoLnOf(comp(a, 'raw')),
    exp: (a) => [...comp(a, 'raw'), '1', 'eml'],
    // π = 2 × ((-i) × ln i): ln i survives where ln(-1) wraps
    pi: () => comp({ t: 'mul', a: N(2), b: { t: 'mul', a: { t: 'neg', a: { t: 'i' } }, b: { t: 'ln', a: { t: 'i' } } } }, 'raw'),
    e: () => ['1', '1', 'eml'],
    // i = √(-1): the ln identity keeps negative reals on the +iπ side in
    // float64, so the principal sqrt lands on +i directly
    i: () => comp({ t: 'sqrt', a: { t: 'neg', a: N(1) } }, 'raw'),
  };
  return m;
}

// Literal n as a sum of powers of two, each power as exp(k * ln 2).
function intFoldProg(M: number, comp: Comp): Prog {
  const bits = M.toString(2);
  let ast: Ast | null = null;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue;
    const k = bits.length - 1 - i;
    const p = k === 0 ? N(1) : { t: 'exp', a: { t: 'mul', a: N(k), b: { t: 'ln', a: N(2) } } } as Ast;
    ast = ast ? { t: 'add', a: ast, b: p } : p;
  }
  return comp(ast!, 'raw');
}

function numProg(v: { t: 'num'; v: number; s?: string }, m: Machine, comp: Comp): Prog {
  if (v.v === 0) return [...m.zero];
  const s = v.s ?? String(v.v);
  if (s === '1') return ['1'];
  if (s === '2') return [...m.two];
  const [intPart, fracPart] = s.split('.');
  if (!fracPart) return intFoldProg(Number(intPart), comp);
  const k = fracPart.length;
  return m.div(N(Number(intPart + fracPart)), { t: 'exp', a: { t: 'mul', a: N(k), b: { t: 'ln', a: N(10) } } });
}

function compRaw(v: Ast, m: Machine, comp: Comp): Prog {
  switch (v.t) {
    case 'num': return numProg(v, m, comp);
    case 'pi': return m.pi();
    case 'e': return m.e();
    case 'i': return m.i();
    case 'add': return m.add(v.a, v.b);
    case 'sub': return m.sub(v.a, v.b);
    case 'mul': return m.mul(v.a, v.b);
    case 'div': return m.div(v.a, v.b);
    case 'pow': return m.pow(v.a, v.b);
    case 'neg': return m.neg(v.a);
    case 'sqrt': return m.sqrt(v.a);
    case 'ln': return m.ln(v.a);
    case 'exp': return m.exp(v.a);
  }
}

export function compilePresses(ast: Ast, machine: MachineName): Press[] {
  let comp: Comp;
  const m = machine === 'four' ? fourMachine((v, mode) => comp(v, mode)) : twoMachine((v, mode) => comp(v, mode));
  comp = (v, mode) => {
    const prog = compRaw(v, m, comp);
    return mode === 'log' ? [...prog, 'ln' as Press] : prog;
  };
  const out = comp(ast, 'raw');
  if (out.length > MAX_PRESSES) {
    throw new Error(`This expression needs ${out.length} button presses, which is past the limit. Try a shorter one.`);
  }
  return out;
}
