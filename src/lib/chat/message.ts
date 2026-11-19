// Message shaping: ``` fences, link tokenization, file size cap.

export type Segment = {kind: 'text'; text: string} | {kind: 'code'; text: string};
export type Token = {kind: 'word'; text: string} | {kind: 'url'; text: string};

export function parseSegments(raw: string): Segment[] {
  const segs: Segment[] = [];
  let mode: 'text' | 'code' = 'text';
  let lines: string[] = [];
  const flush = () => {
    const text = lines.join('\n');
    if (text) segs.push({kind: mode, text});
    lines = [];
  };
  for (const line of raw.split('\n')) {
    if (line.startsWith('```')) {
      flush();
      mode = mode === 'text' ? 'code' : 'text';
    } else {
      lines.push(line);
    }
  }
  flush();
  return segs;
}

const URL_RE = /(https?:\/\/|www\.)[^\s)>]+/g;

export const MAX_TEXT_CHARS = 100_000;

export type FileMeta = {msgId: string; name: string; mime: string; size: number};

// Wire data from a peer. Check the shape before it reaches the renderer:
// a malformed frame should be ignored, not throw inside a subscription.
export function cleanParts(raw: unknown): Segment[] | null {
  if (!Array.isArray(raw) || raw.length > 200) return null;
  const out: Segment[] = [];
  let chars = 0;
  for (const p of raw) {
    if (!p || typeof p !== 'object') return null;
    const {kind, text} = p as {kind?: unknown; text?: unknown};
    if ((kind !== 'text' && kind !== 'code') || typeof text !== 'string') return null;
    chars += text.length;
    if (chars > MAX_TEXT_CHARS) return null;
    out.push({kind, text});
  }
  return out;
}

export function cleanFileMeta(raw: unknown): FileMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.msgId !== 'string' || m.msgId.length > 100) return null;
  if (typeof m.name !== 'string' || typeof m.mime !== 'string' || m.mime.length > 200) return null;
  if (typeof m.size !== 'number' || !Number.isFinite(m.size) || m.size < 0) return null;
  return {msgId: m.msgId, name: m.name.slice(0, 200), mime: m.mime, size: m.size};
}

const TRAILING = '.,;:!?"\'';

export function linkTokens(text: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0];
    while (url.length > 4 && TRAILING.includes(url[url.length - 1])) url = url.slice(0, -1);
    if (m.index! > at) tokens.push({kind: 'word', text: text.slice(at, m.index)});
    tokens.push({kind: 'url', text: url});
    at = m.index! + url.length;
  }
  if (at < text.length) tokens.push({kind: 'word', text: text.slice(at)});
  return tokens;
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function fileTooBig(size: number): boolean {
  return size > MAX_FILE_BYTES;
}
