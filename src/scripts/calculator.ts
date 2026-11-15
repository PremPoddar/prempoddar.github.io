// Live calculator and press-sequence converter for the two-button page.
// The engine does the math; this file only wires buttons, tape and playback.
import { parseExpr, desugar, evaluate, MAX_INPUT } from '../lib/calculator/engine';
import { compilePresses, MAX_PRESSES } from '../lib/calculator/compile';
import { executePresses, type Press, type MachineName } from '../lib/calculator/machine';
import type { C } from '../lib/calculator/complex';

const KEYS: Record<MachineName, { press: Press; label: string; hint: string }[]> = {
  four: [
    { press: '1', label: '1', hint: 'push 1' },
    { press: '-', label: '−', hint: 'subtract' },
    { press: 'exp', label: 'exp', hint: 'e to the x' },
    { press: 'ln', label: 'ln', hint: 'natural log' },
  ],
  two: [
    { press: '1', label: '1', hint: 'push 1' },
    { press: 'eml', label: 'EML', hint: 'e^x − ln y' },
  ],
};

const LABELS: Record<Press, string> = { '1': '1', '-': '−', exp: 'exp', ln: 'ln', eml: 'EML' };

// Format a stack value for the display: real, imaginary, or a+bi.
function fmt(z: C): string {
  const r = (x: number) => {
    if (!Number.isFinite(x)) return x > 0 ? '∞' : '-∞';
    const s = Math.abs(x) >= 1e12 || (Math.abs(x) < 1e-9 && x !== 0) ? x.toExponential(6) : x.toPrecision(10);
    return s.replace(/\.?0+($|e)/, '$1');
  };
  if (Math.abs(z.im) < 1e-9) return r(z.re);
  if (Math.abs(z.re) < 1e-9) return `${r(z.im)}i`;
  return `${r(z.re)} ${z.im < 0 ? '-' : '+'} ${r(Math.abs(z.im))}i`;
}

export function initCalculator(root: Document = document) {
  const section = root.querySelector<HTMLElement>('[data-calc]');
  if (!section) return;

  const stackOut = section.querySelector<HTMLElement>('[data-stack]')!;
  const depthOut = section.querySelector<HTMLElement>('[data-depth]')!;
  const tape = section.querySelector<HTMLElement>('[data-tape]')!;
  const keysRow = section.querySelector<HTMLElement>('[data-keys]')!;
  const errOut = section.querySelector<HTMLElement>('[data-calc-error]')!;

  let machine: MachineName = 'four';
  let presses: Press[] = [];

  function renderStack() {
    let stack: C[] = [];
    try {
      if (presses.length) {
        const seen: C[][] = [];
        executePresses(presses, machine, (_top, s) => seen.push([...s]));
        stack = seen[seen.length - 1] ?? [];
      }
      errOut.hidden = true;
    } catch (e) {
      errOut.textContent = (e as Error).message;
      errOut.hidden = false;
    }
    stackOut.textContent = stack.length ? fmt(stack[stack.length - 1]) : '0';
    depthOut.textContent = String(stack.length);
    tape.replaceChildren(
      ...presses.map((p) => {
        const li = root.createElement('li');
        li.className = 'chip';
        li.textContent = LABELS[p];
        return li;
      }),
    );
    tape.scrollLeft = tape.scrollWidth;
  }

  function press(p: Press) {
    presses.push(p);
    renderStack();
  }

  function buildKeys() {
    keysRow.replaceChildren(
      ...KEYS[machine].map((k) => {
        const b = root.createElement('button');
        b.type = 'button';
        b.className = 'key';
        b.dataset.press = k.press;
        b.innerHTML = `<span>${k.label}</span><small>${k.hint}</small>`;
        return b;
      }),
      (() => {
        const back = root.createElement('button');
        back.type = 'button';
        back.className = 'key wide';
        back.dataset.back = '';
        back.innerHTML = '<span>Back</span><small>undo one press</small>';
        return back;
      })(),
      (() => {
        const reset = root.createElement('button');
        reset.type = 'button';
        reset.className = 'key wide';
        reset.dataset.reset = '';
        reset.innerHTML = '<span>Reset</span><small>clear the stack</small>';
        return reset;
      })(),
    );
  }

  section.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-press], [data-back], [data-reset], [data-machine]');
    if (!el) return;
    if (el.dataset.press) press(el.dataset.press as Press);
    else if ('back' in el.dataset) {
      presses = presses.slice(0, -1);
      renderStack();
    } else if ('reset' in el.dataset) {
      presses = [];
      renderStack();
    } else if (el.dataset.machine) {
      machine = el.dataset.machine as MachineName;
      for (const t of section.querySelectorAll<HTMLElement>('[data-machine]')) {
        t.setAttribute('aria-pressed', String(t.dataset.machine === machine));
      }
      presses = [];
      buildKeys();
      renderStack();
    }
  });

  section.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    const map: Record<string, Press> = { '1': '1', '-': '-', e: 'exp', l: 'ln', enter: 'eml' };
    if (k === 'backspace') {
      presses = presses.slice(0, -1);
      renderStack();
      e.preventDefault();
    } else if (map[k] && (machine === 'four' ? map[k] !== 'eml' : k === '1' || k === 'enter')) {
      press(map[k]);
      e.preventDefault();
    }
  });

  buildKeys();
  renderStack();

  // Converter: expression in, press sequence out, with step playback.
  const form = root.querySelector<HTMLFormElement>('[data-convert]')!;
  const input = form.querySelector<HTMLInputElement>('[data-expr]')!;
  const degBox = form.querySelector<HTMLInputElement>('[data-deg]')!;
  const target = form.querySelector<HTMLSelectElement>('[data-target]')!;
  const seqOut = root.querySelector<HTMLElement>('[data-seq]')!;
  const seqTape = seqOut.querySelector<HTMLElement>('[data-seq-tape]')!;
  const seqInfo = seqOut.querySelector<HTMLElement>('[data-seq-info]')!;
  const playBtn = seqOut.querySelector<HTMLButtonElement>('[data-play]')!;
  const resultOut = seqOut.querySelector<HTMLElement>('[data-seq-result]')!;
  const convErr = form.querySelector<HTMLElement>('[data-conv-error]')!;

  let steps: { press: Press; stack: C[] }[] = [];
  let frame = 0;

  for (const b of form.querySelectorAll<HTMLElement>('[data-ins]')) {
    b.addEventListener('click', () => {
      const at = input.selectionStart ?? input.value.length;
      input.value = input.value.slice(0, at) + b.dataset.ins + input.value.slice(input.selectionEnd ?? at);
      input.focus();
      input.setSelectionRange(at + b.dataset.ins.length, at + b.dataset.ins.length);
    });
  }

  function stopPlayback() {
    cancelAnimationFrame(frame);
    frame = 0;
    playBtn.textContent = 'Play';
  }

  function paint(n: number) {
    seqTape.dataset.at = String(n);
    for (let i = 0; i < seqTape.children.length; i++) {
      seqTape.children[i].classList.toggle('now', i < n);
    }
    const s = n > 0 ? steps[n - 1].stack : [];
    resultOut.textContent = s.length ? fmt(s[s.length - 1]) : '0';
  }

  function step() {
    if (!frame) return;
    const n = Number(seqTape.dataset.at ?? 0) + 1;
    if (n > steps.length) {
      paint(steps.length);
      stopPlayback();
      return;
    }
    paint(n);
    frame = requestAnimationFrame(step);
  }

  playBtn.addEventListener('click', () => {
    if (frame) {
      stopPlayback();
      return;
    }
    if (!steps.length) return;
    if (Number(seqTape.dataset.at ?? 0) >= steps.length) paint(0);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paint(steps.length);
      return;
    }
    playBtn.textContent = 'Pause';
    frame = requestAnimationFrame(step);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    cancelAnimationFrame(frame);
    frame = 0;
    playBtn.textContent = 'Play';
    convErr.hidden = true;
    convErr.textContent = '';
    seqOut.hidden = true;
    resultOut.textContent = '';
    const src = input.value.trim();
    try {
      const ast = desugar(parseExpr(src), degBox.checked);
      const result = evaluate(ast);
      const compiled = compilePresses(ast, target.value as MachineName);
      const snaps: C[][] = [];
      executePresses(compiled, target.value as MachineName, (_top, stack) => snaps.push([...stack]));
      steps = compiled.map((press, i) => ({ press, stack: snaps[i] }));
      seqTape.replaceChildren(
        ...compiled.map((p) => {
          const li = root.createElement('li');
          li.className = 'chip';
          li.textContent = LABELS[p];
          return li;
        }),
      );
      seqInfo.textContent = `${compiled.length} presses on the ${target.value === 'four' ? 'four-button' : 'two-button'} machine: ${fmt(result)}`;
      resultOut.textContent = fmt(result);
      seqOut.hidden = false;
    } catch (err) {
      convErr.textContent = (err as Error).message;
      convErr.hidden = false;
      steps = [];
    }
  });
}
