// Catches copy that reads as machine written, plus private details.
const WORDS = [
  'delve', 'seamless', 'seamlessly', 'leverage', 'cutting-edge', 'passionate', 'rockstar', 'ninja',
  'elevate', 'robust', 'tapestry', 'testament', 'game-changer', 'unleash', 'empower',
];

export function lintCopy(text) {
  const issues = [];
  if (/[—–]/.test(text)) issues.push('em or en dash');
  for (const w of WORDS) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(text)) issues.push(`word: ${w}`);
  }
  if (/\bnot just\b[^.!?]{0,60}\bbut\b/i.test(text)) issues.push('"not just X, but Y"');
  if (/98674\D{0,3}70257|9867470257/.test(text)) issues.push('phone number');
  if (/yandex/i.test(text)) issues.push('yandex');
  return issues;
}
