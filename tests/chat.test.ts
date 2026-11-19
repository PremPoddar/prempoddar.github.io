import {describe, expect, it} from 'vitest';
import {ADJECTIVES, ANIMALS, NOUNS, randomName, roomCode} from '../src/lib/chat/words';
import {MAX_FILE_BYTES, MAX_TEXT_CHARS, cleanFileMeta, cleanParts, fileTooBig, linkTokens, parseSegments} from '../src/lib/chat/message';
import {
  type RoomState,
  type Roster,
  nextOwnerAfterLeave,
  reduceRoom,
  roleOf,
} from '../src/lib/chat/room-model';
import {applyRead, emptySocial} from '../src/lib/chat/social';

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
  it('keeps well-shaped peer parts and drops the rest', () => {
    expect(cleanParts([{kind: 'text', text: 'hi'}])).toEqual([{kind: 'text', text: 'hi'}]);
    expect(cleanParts([])).toEqual([]);
    expect(cleanParts('hello')).toBeNull();
    expect(cleanParts([{kind: 'script', text: 'hi'}])).toBeNull();
    expect(cleanParts([{kind: 'text', text: 3}])).toBeNull();
    expect(cleanParts([{kind: 'text', text: 'x'.repeat(MAX_TEXT_CHARS + 1)}])).toBeNull();
  });
  it('keeps well-shaped file metadata and drops the rest', () => {
    expect(cleanFileMeta({msgId: 'a', name: 'x.png', mime: 'image/png', size: 10})).toEqual({
      msgId: 'a',
      name: 'x.png',
      mime: 'image/png',
      size: 10,
    });
    expect(cleanFileMeta({msgId: 'a', name: 'x'.repeat(500), mime: 'text/plain', size: 1})?.name).toHaveLength(200);
    expect(cleanFileMeta(null)).toBeNull();
    expect(cleanFileMeta({name: 'x', mime: 'text/plain', size: 1})).toBeNull();
    expect(cleanFileMeta({msgId: 'a', name: 'x', mime: null, size: 1})).toBeNull();
    expect(cleanFileMeta({msgId: 'a', name: 'x', mime: 'text/plain', size: -1})).toBeNull();
  });
});

describe('room roster', () => {
  const base: RoomState = {roster: null, pending: [], connected: [], declined: false};
  const mk = (owner: string, rest: string[] = []): Roster => ({
    ownerId: owner,
    members: [owner, ...rest].map((id, i) => ({userId: id, name: 'N' + id.slice(2), order: i + 1})),
  });

  it('first roster wins', () => {
    const s = reduceRoom(base, {type: 'roster', roster: mk('u-a'), from: 'u-a'});
    expect(s.roster).toEqual(mk('u-a'));
  });
  it('rejects a roster from a non-owner', () => {
    const s1 = reduceRoom(base, {type: 'roster', roster: mk('u-a', ['u-b']), from: 'u-a'});
    const s2 = reduceRoom(s1, {type: 'roster', roster: mk('u-c'), from: 'u-c'});
    expect(s2.roster).toEqual(s1.roster);
  });
  it('rejects unordered or duplicate rosters', () => {
    const bad: Roster = {
      ownerId: 'u-a',
      members: [{userId: 'u-a', name: 'A', order: 2}, {userId: 'u-b', name: 'B', order: 1}],
    };
    expect(reduceRoom(base, {type: 'roster', roster: bad, from: 'u-a'}).roster).toBeNull();
    const dup: Roster = {
      ownerId: 'u-a',
      members: [{userId: 'u-a', name: 'A', order: 1}, {userId: 'u-a', name: 'A2', order: 2}],
    };
    expect(reduceRoom(base, {type: 'roster', roster: dup, from: 'u-a'}).roster).toBeNull();
  });
  it('accept flow: stranger pends, roster admits them', () => {
    const owner = reduceRoom(base, {type: 'peer-joined', userId: 'u-x', name: 'X Ray'});
    expect(owner.pending).toEqual([{userId: 'u-x', name: 'X Ray'}]);
    const s2 = reduceRoom(owner, {type: 'roster', roster: mk('u-a', ['u-x']), from: 'u-a'});
    expect(s2.pending).toEqual([]);
    expect(roleOf(s2, 'u-a')).toBe('owner');
    const j = reduceRoom(
      reduceRoom(base, {type: 'peer-joined', userId: 'u-a', name: 'A'}),
      {type: 'roster', roster: mk('u-a', ['u-me']), from: 'u-a'},
    );
    expect(roleOf(j, 'u-me')).toBe('member');
  });
  it('decline clears pending on departure and marks the joiner declined', () => {
    const owner = reduceRoom(base, {type: 'peer-joined', userId: 'u-x', name: 'X'});
    const withRoster = reduceRoom(owner, {type: 'roster', roster: mk('u-a'), from: 'u-a'});
    const gone = reduceRoom(withRoster, {type: 'peer-left', userId: 'u-x'});
    expect(gone.pending).toEqual([]);
    expect(roleOf(reduceRoom(base, {type: 'declined-self'}), 'u-me')).toBe('declined');
  });
  it('owner leaving promotes the first remaining member', () => {
    let s = reduceRoom(base, {type: 'roster', roster: mk('u-a', ['u-b', 'u-me']), from: 'u-a'});
    s = reduceRoom(s, {type: 'peer-left', userId: 'u-a'});
    expect(s.roster!.ownerId).toBe('u-b');
    expect(s.roster!.members.map((m) => m.userId)).toEqual(['u-b', 'u-me']);
    expect(reduceRoom(s, {type: 'roster', roster: mk('u-b', ['u-me']), from: 'u-b'}).roster!.ownerId).toBe('u-b');
    expect(reduceRoom(s, {type: 'roster', roster: mk('u-a'), from: 'u-a'}).roster).toEqual(s.roster);
    expect(nextOwnerAfterLeave(mk('u-a', ['u-b', 'u-me']), 'u-a').ownerId).toBe('u-b');
  });
  it('a regular member dropping out stays in the roster (refresh)', () => {
    let s = reduceRoom(base, {type: 'roster', roster: mk('u-a', ['u-me', 'u-b']), from: 'u-a'});
    s = reduceRoom(s, {type: 'peer-left', userId: 'u-me'});
    expect(s.roster!.members.map((m) => m.userId)).toEqual(['u-a', 'u-me', 'u-b']);
    s = reduceRoom(s, {type: 'peer-joined', userId: 'u-me', name: 'Nme'});
    expect(roleOf(s, 'u-me')).toBe('member');
  });
  it('rename updates roster and pending names', () => {
    let s = reduceRoom(base, {type: 'roster', roster: mk('u-a', ['u-b']), from: 'u-a'});
    s = reduceRoom(s, {type: 'rename', userId: 'u-b', name: 'New Name'});
    expect(s.roster!.members[1].name).toBe('New Name');
    const p = reduceRoom(
      reduceRoom(base, {type: 'peer-joined', userId: 'u-x', name: 'X'}),
      {type: 'rename', userId: 'u-x', name: 'X2'},
    );
    expect(p.pending[0].name).toBe('X2');
  });
  it('roleOf covers waiting, pending, owner, member, declined', () => {
    expect(roleOf(base, 'u-me')).toBe('waiting');
    expect(roleOf(reduceRoom(base, {type: 'peer-joined', userId: 'u-a', name: 'A'}), 'u-me')).toBe('pending');
    const r = reduceRoom(base, {type: 'roster', roster: mk('u-a', ['u-me']), from: 'u-a'});
    expect(roleOf(r, 'u-a')).toBe('owner');
    expect(roleOf(r, 'u-me')).toBe('member');
    expect(roleOf(reduceRoom(base, {type: 'declined-self'}), 'u-me')).toBe('declined');
  });
});

describe('social', () => {
  it('accumulates readers once, in order', () => {
    let s = emptySocial();
    s = applyRead(s, 'Amber', ['m1']);
    s = applyRead(s, 'Devi', ['m1', 'm2']);
    s = applyRead(s, 'Amber', ['m1']);
    expect(s.seen.m1).toEqual(['Amber', 'Devi']);
    expect(s.seen.m2).toEqual(['Devi']);
  });
});
