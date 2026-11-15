import {describe, expect, it} from 'vitest';
import {ADJECTIVES, ANIMALS, NOUNS, randomName, roomCode} from '../src/lib/chat/words';

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
