// Parse, desugar and evaluate expressions for the two-button calculator.
// Trig and log10 are desugared into plain arithmetic, exp and ln here, so the
// evaluator and the button-machine compiler consume the same reduced tree.
import { type C, c, CAdd, CSub, CMul, CDiv, CExp, CLn } from './complex';

export const MAX_INPUT = 500;

export type Ast =
  | { t: 'num'; v: number; s?: string }
  | { t: 'pi' }
  | { t: 'e' }
  | { t: 'i' }
  | { t: 'add' | 'sub' | 'mul' | 'div'; a: Ast; b: Ast }
  | { t: 'neg'; a: Ast }
  | { t: 'pow'; a: Ast; b: Ast }
  | { t: 'sqrt' | 'ln' | 'exp'; a: Ast }
  | { t: 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan' | 'sinh' | 'cosh' | 'tanh' | 'log'; a: Ast };

const FUNCS = ['asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'sqrt', 'sin', 'cos', 'tan', 'exp', 'log', 'ln'];
const NAMES = [...FUNCS, 'pi', 'e', 'i'];

type Tok = { k: 'num'; v: number; s: string } | { k: 'name'; v: string } | { k: string; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let pos = 0;
  while (pos < src.length) {
    const ch = src[pos];
    if (/\s/.test(ch)) {
      pos++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(pos));
      if (!m) throw new Error(`Unexpected character "${ch}"`);
      const digits = m[0].replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
      if (digits.length > 15) throw new Error('That number has too many digits. Keep numbers to 15 significant digits.');
      out.push({ k: 'num', v: Number(m[0]), s: m[0] });
      pos += m[0].length;
      continue;
    }
    if (/[a-z]/i.test(ch)) {
      const word = /^[a-z]+/i.exec(src.slice(pos))![0].toLowerCase();
      if (!NAMES.includes(word)) {
        const near = NAMES.filter((n) => n.length > 1 && (n.includes(word) || word.includes(n))).sort((a, b) => a.length - b.length)[0];
        throw new Error(`Unknown name "${word}"${near ? `. Did you mean ${near}?` : ''}`);
      }
      out.push({ k: word === 'pi' ? 'pi' : word === 'e' ? 'e' : word === 'i' ? 'i' : 'name', v: word });
      pos += word.length;
      continue;
    }
    const map: Record<string, string> = { '×': '*', '÷': '/', '−': '-', '–': '-', '—': '-', 'π': 'pi', '·': '*', '√': '√' };
    if (map[ch] || '+-*/^()'.includes(ch)) {
      out.push({ k: map[ch] ?? ch, v: ch });
      pos++;
      continue;
    }
    throw new Error(`Unexpected character "${ch}"`);
  }
  return out;
}

export function parseExpr(src: string): Ast {
  if (src.length > MAX_INPUT) throw new Error(`Expression is too long. Keep it under ${MAX_INPUT} characters.`);
  const toks = tokenize(src);
  let at = 0;
  const peek = () => toks[at];
  const next = () => toks[at++];

  function expr(): Ast {
    let left = term();
    while (peek()?.k === '+' || peek()?.k === '-') {
      const op = next().k === '+' ? 'add' : 'sub';
      left = { t: op, a: left, b: term() };
    }
    return left;
  }

  function term(): Ast {
    let left = unary();
    for (;;) {
      const t = peek();
      if (t?.k === '*' || t?.k === '/') {
        next();
        left = { t: t.k === '*' ? 'mul' : 'div', a: left, b: unary() };
      } else if (t && (t.k === 'num' || t.k === 'pi' || t.k === 'e' || t.k === 'i' || t.k === 'name' || t.k === '(' || t.k === '√')) {
        left = { t: 'mul', a: left, b: unary() };
      } else return left;
    }
  }

  function unary(): Ast {
    if (peek()?.k === '-') {
      next();
      return { t: 'neg', a: unary() };
    }
    return power();
  }

  function power(): Ast {
    const base = atom();
    if (peek()?.k === '^') {
      next();
      return { t: 'pow', a: base, b: unary() };
    }
    return base;
  }

  function atom(): Ast {
    const t = next();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.k === 'num') return { t: 'num', v: t.v, s: t.s };
    if (t.k === 'pi') return { t: 'pi' };
    if (t.k === 'e') return { t: 'e' };
    if (t.k === 'i') return { t: 'i' };
    if (t.k === '(') {
      const inner = expr();
      if (next()?.k !== ')') throw new Error('Missing a closing bracket');
      return inner;
    }
    if (t.k === '√') return { t: 'sqrt', a: power() };
    if (t.k === 'name') {
      if (next()?.k !== '(') throw new Error(`${t.v} needs its argument in brackets, like ${t.v}(1)`);
      const arg = expr();
      if (next()?.k !== ')') throw new Error('Missing a closing bracket');
      return { t: t.v as never, a: arg };
    }
    throw new Error(`Unexpected "${t.v}"`);
  }

  const out = expr();
  if (at < toks.length) throw new Error(`Unexpected "${toks[at].v}"`);
  return out;
}

const num = (v: number): Ast => ({ t: 'num', v });
const add = (a: Ast, b: Ast): Ast => ({ t: 'add', a, b });
const sub = (a: Ast, b: Ast): Ast => ({ t: 'sub', a, b });
const mul = (a: Ast, b: Ast): Ast => ({ t: 'mul', a, b });
const div = (a: Ast, b: Ast): Ast => ({ t: 'div', a, b });
const neg = (a: Ast): Ast => ({ t: 'neg', a });
const expOf = (a: Ast): Ast => ({ t: 'exp', a });
const lnOf = (a: Ast): Ast => ({ t: 'ln', a });

// sin x = (e^ix - e^-ix) / 2i, with x already in radians
const sinOf = (x: Ast): Ast => div(sub(expOf(mul({ t: 'i' }, x)), expOf(mul(neg({ t: 'i' }), x))), mul(num(2), { t: 'i' }));
const cosOf = (x: Ast): Ast => div(add(expOf(mul({ t: 'i' }, x)), expOf(mul(neg({ t: 'i' }), x))), num(2));
const sinhOf = (x: Ast): Ast => div(sub(expOf(x), expOf(neg(x))), num(2));
const coshOf = (x: Ast): Ast => div(add(expOf(x), expOf(neg(x))), num(2));
const acosOf = (x: Ast): Ast => neg(mul({ t: 'i' }, lnOf(add(x, mul({ t: 'i' }, { t: 'sqrt', a: sub(num(1), mul(x, x)) })))));
const degShift = mul({ t: 'pi' }, div(num(1), num(180)));
const degBack = div(num(180), { t: 'pi' });
const halfPi = div({ t: 'pi' }, num(2));

// Rewrites every function into arithmetic, exp, ln and constants. deg=true
// treats trig arguments as degrees and returns inverse trig in degrees.
export function desugar(node: Ast, deg: boolean): Ast {
  const walk = (n: Ast): Ast => {
    switch (n.t) {
      case 'add': case 'sub': case 'mul': case 'div': case 'pow':
        return { t: n.t, a: walk(n.a), b: walk(n.b) };
      case 'neg': case 'sqrt': case 'ln': case 'exp':
        return { t: n.t, a: walk(n.a) };
      case 'num': case 'pi': case 'e': case 'i':
        return n;
      case 'log':
        return div(lnOf(walk(n.a)), lnOf(num(10)));
      case 'sin': return sinOf(deg ? mul(walk(n.a), degShift) : walk(n.a));
      case 'cos': return cosOf(deg ? mul(walk(n.a), degShift) : walk(n.a));
      case 'tan': {
        const x = deg ? mul(walk(n.a), degShift) : walk(n.a);
        return div(sinOf(x), cosOf(x));
      }
      case 'asin': {
        const r = sub(halfPi, acosOf(walk(n.a)));
        return deg ? mul(r, degBack) : r;
      }
      case 'acos': {
        const r = acosOf(walk(n.a));
        return deg ? mul(r, degBack) : r;
      }
      case 'atan': {
        const r = mul(div({ t: 'i' }, num(2)), lnOf(div(add({ t: 'i' }, walk(n.a)), sub({ t: 'i' }, walk(n.a)))));
        return deg ? mul(r, degBack) : r;
      }
      case 'sinh': return sinhOf(walk(n.a));
      case 'cosh': return coshOf(walk(n.a));
      case 'tanh': return div(sinhOf(walk(n.a)), coshOf(walk(n.a)));
    }
  };
  return walk(node);
}

export function evaluate(node: Ast): C {
  switch (node.t) {
    case 'num': return c(node.v, 0);
    case 'pi': return c(Math.PI, 0);
    case 'e': return c(Math.E, 0);
    case 'i': return c(0, 1);
    case 'add': return CAdd(evaluate(node.a), evaluate(node.b));
    case 'sub': return CSub(evaluate(node.a), evaluate(node.b));
    case 'mul': return CMul(evaluate(node.a), evaluate(node.b));
    case 'div': return CDiv(evaluate(node.a), evaluate(node.b));
    case 'neg': {
      const z = evaluate(node.a);
      return c(-z.re, -z.im);
    }
    case 'pow': return CExp(CMul(evaluate(node.b), CLn(evaluate(node.a))));
    case 'sqrt': {
      const z = evaluate(node.a);
      if (z.re === 0 && z.im === 0) return c(0, 0);
      return CExp(CMul(c(0.5, 0), CLn(z)));
    }
    case 'ln': return CLn(evaluate(node.a));
    case 'exp': return CExp(evaluate(node.a));
  }
}

export function evaluateText(src: string, deg = false): C {
  return evaluate(desugar(parseExpr(src), deg));
}
