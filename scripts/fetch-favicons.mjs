// Downloads a 64px PNG icon for every toolbox entry that doesn't have one yet.
// Run by hand after adding entries: node scripts/fetch-favicons.mjs
// Needs macOS (uses sips to convert and resize).
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';

const OUT = 'public/toolbox';
const tools = parse(readFileSync('src/content/toolbox.yaml', 'utf8'));
mkdirSync(OUT, { recursive: true });

async function candidates(url) {
  const origin = new URL(url).origin;
  const found = [];
  try {
    const html = await (await fetch(url, { redirect: 'follow' })).text();
    for (const m of html.matchAll(/<link[^>]+>/gi)) {
      const tag = m[0];
      if (!/rel=["'][^"']*(icon|apple-touch-icon)[^"']*["']/i.test(tag)) continue;
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
      if (href && !href.endsWith('.svg')) found.push(new URL(href, url).href);
    }
  } catch {}
  found.sort((a, b) => Number(/apple-touch/.test(b)) - Number(/apple-touch/.test(a)));
  found.push(`${origin}/apple-touch-icon.png`, `${origin}/favicon.ico`);
  return found;
}

for (const tool of tools) {
  const dest = `${OUT}/${tool.id}.png`;
  if (existsSync(dest)) continue;
  let saved = false;
  for (const src of await candidates(tool.url)) {
    try {
      const res = await fetch(src);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 100) continue;
      const tmp = `${OUT}/.tmp-${tool.id}`;
      writeFileSync(tmp, buf);
      execFileSync('sips', ['-s', 'format', 'png', '-z', '64', '64', tmp, '--out', dest], { stdio: 'ignore' });
      rmSync(tmp);
      saved = true;
      console.log(`${tool.id}: ${src}`);
      break;
    } catch {}
  }
  if (!saved) console.log(`${tool.id}: no icon found, the page will show a letter instead`);
}
