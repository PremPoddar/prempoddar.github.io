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
