import {describe, expect, it} from 'vitest';
import {ADJECTIVES, ANIMALS, NOUNS, randomName, roomCode} from '../src/lib/chat/words';
import {MAX_FILE_BYTES, fileTooBig, linkTokens, parseSegments} from '../src/lib/chat/message';

describe('chat words', () => {
  it('makes three-word codes from the noun list', () => {
    const code = roomCode();
    expect(code).toMatch(/^[a-z]{3,8}-[a-z]{3,8}-[a-z]{3,8}$/);
    for (const w of code.split('-')) expect(NOUNS).toContain(w);
  });
  it('makes adjective-animal names', () => {
    const name = randomName();
    expect(name).toMatch(/^[A-Z][a-z]{2,7} [A-Z][a-z]{2,7}$/);
    const [a, b] = name.split(' ');
    expect(ADJECTIVES).toContain(a.toLowerCase());
    expect(ANIMALS).toContain(b.toLowerCase());
  });
  it('has unique, lowercase, word-shaped lists', () => {
    for (const list of [ADJECTIVES, ANIMALS, NOUNS]) {
      expect(new Set(list).size).toBe(list.length);
      for (const w of list) expect(w).toMatch(/^[a-z]{3,8}$/);
    }
  });
  it('varies codes across draws', () => {
    expect(new Set(Array.from({length: 50}, roomCode)).size).toBeGreaterThan(40);
  });
});

describe('message shaping', () => {
  it('splits fenced code from text', () => {
    const segs = parseSegments('before\n```\ncode line\n```\nafter');
    expect(segs).toEqual([
      {kind: 'text', text: 'before'},
      {kind: 'code', text: 'code line'},
      {kind: 'text', text: 'after'},
    ]);
  });
  it('keeps an unclosed fence as code', () => {
    expect(parseSegments('```\nx')).toEqual([{kind: 'code', text: 'x'}]);
  });
  it('leaves plain text untouched', () => {
    expect(parseSegments('hello')).toEqual([{kind: 'text', text: 'hello'}]);
  });
  it('tokenizes urls', () => {
    expect(linkTokens('see https://x.dev/a_b and www.foo.bar.')).toEqual([
      {kind: 'word', text: 'see '},
      {kind: 'url', text: 'https://x.dev/a_b'},
      {kind: 'word', text: ' and '},
      {kind: 'url', text: 'www.foo.bar'},
      {kind: 'word', text: '.'},
    ]);
  });
  it('does not eat sentence punctuation into urls', () => {
    expect(linkTokens('(https://a.dev/x)')).toEqual([
      {kind: 'word', text: '('},
      {kind: 'url', text: 'https://a.dev/x'},
      {kind: 'word', text: ')'},
    ]);
  });
  it('caps files at 25 MiB', () => {
    expect(fileTooBig(26214400)).toBe(false);
    expect(fileTooBig(26214401)).toBe(true);
    expect(MAX_FILE_BYTES).toBe(25 * 1024 * 1024);
  });
});
