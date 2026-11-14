// The two physical machines from the Numberphile video.
// four: buttons 1, -, exp, ln. two: buttons 1, EML where EML(x, y) = e^x - ln y.
import { type C, c, CSub, CExp, CLn } from './complex';

export type Press = '1' | '-' | 'exp' | 'ln' | 'eml';
export type MachineName = 'four' | 'two';

export function executePresses(presses: Press[], machine: MachineName, onStep?: (top: C, stack: C[]) => void): C {
  const stack: C[] = [];
  const two = () => {
    if (stack.length < 2) throw new Error('That button needs two values on the stack first.');
    return stack.pop()!;
  };
  for (const p of presses) {
    switch (p) {
      case '1':
        stack.push(c(1, 0));
        break;
      case '-': {
        const y = two();
        const x = stack.pop()!;
        stack.push(CSub(x, y));
        break;
      }
      case 'exp':
        if (!stack.length) throw new Error('exp needs a value on the stack first.');
        stack.push(CExp(stack.pop()!));
        break;
      case 'ln':
        if (!stack.length) throw new Error('ln needs a value on the stack first.');
        stack.push(CLn(stack.pop()!));
        break;
      case 'eml': {
        const y = two();
        const x = stack.pop()!;
        stack.push(CSub(CExp(x), CLn(y)));
        break;
      }
    }
    onStep?.(stack[stack.length - 1], stack);
  }
  if (!stack.length) throw new Error('Nothing was pressed.');
  return stack[stack.length - 1];
}
