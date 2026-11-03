// Scans the built site for things that must never be published.
// Usage: node scripts/check-dist.mjs dist
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RESERVED = ['librechat', 'duet', 'oaf', 'loadstone', 'campfire', 'caffeinatecat', 'brewlight'];
const SCANNED = new Set(['.html', '.xml', '.txt', '.json']);
const ALLOWED_NOXDROP = 'noxdrop.com/caffeinatecat.html';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function visibleText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
}

export function checkDist(distDir) {
  const problems = [];

  const cname = join(distDir, 'CNAME');
  if (!existsSync(cname) || readFileSync(cname, 'utf8').trim() !== 'prempoddar.is-a.dev') {
    problems.push('CNAME is missing or does not contain prempoddar.is-a.dev');
  }

  for (const name of readdirSync(distDir)) {
    if (RESERVED.includes(name.toLowerCase())) {
      problems.push(`${name}/ would clash with the existing app page at /${name}/`);
    }
  }

  for (const file of walk(distDir)) {
    if (!SCANNED.has(extname(file))) continue;
    const rel = relative(distDir, file);
    const raw = readFileSync(file, 'utf8');
    const text = extname(file) === '.html' ? visibleText(raw) : raw;

    if (/9867\D{0,3}4\D{0,3}7\D{0,3}0257|98674\D{0,3}70257/.test(raw)) problems.push(`${rel}: phone number`);
    if (/yandex/i.test(raw)) problems.push(`${rel}: yandex`);
    if (/[—–]/.test(text)) problems.push(`${rel}: em or en dash in page text`);

    const inToolbox = rel.split(sep)[0] === 'toolbox';
    const nox = raw.toLowerCase().split(ALLOWED_NOXDROP).join('');
    if (!inToolbox && nox.includes('noxdrop')) problems.push(`${rel}: NoxDrop mentioned outside the toolbox`);
  }

  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkDist(process.argv[2] ?? 'dist');
  if (problems.length) {
    console.error('Output check failed:\n' + problems.map((p) => '  ' + p).join('\n'));
    process.exit(1);
  }
  console.log('Output check passed.');
}
