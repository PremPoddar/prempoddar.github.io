import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { filterTools, groupByCategory, type Tool } from '../src/lib/toolbox';

const tools: Tool[] = parse(readFileSync('src/content/toolbox.yaml', 'utf8'));

describe('filterTools', () => {
  it('matches names case-insensitively', () => {
    expect(filterTools(tools, 'GHIDRA', null, null).map((t) => t.id)).toEqual(['ghidra']);
  });

  it('matches the host and the why line', () => {
    expect(filterTools(tools, 'telegra.ph', null, null).map((t) => t.id)).toEqual(['telegraph']);
    expect(filterTools(tools, 'game theory', null, null).map((t) => t.id)).toEqual(['evolution-of-trust']);
  });

  it('treats regex characters as plain text', () => {
    expect(() => filterTools(tools, '(', null, null)).not.toThrow();
    expect(filterTools(tools, 'c++', null, null)).toEqual([]);
  });

  it('filters by category', () => {
    expect(filterTools(tools, '', 'Android', null).map((t) => t.id).sort()).toEqual(['f-droid', 'morphe']);
  });

  it('filters by tag', () => {
    const open = filterTools(tools, '', null, 'open source');
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((t) => t.tags.includes('open source'))).toBe(true);
  });

  it('returns everything for an empty query', () => {
    expect(filterTools(tools, '  ', null, null)).toHaveLength(tools.length);
  });
});

describe('groupByCategory', () => {
  it('follows the given order and skips empty categories', () => {
    const groups = groupByCategory(filterTools(tools, '', 'Reading', null), ['Android', 'Reading']);
    expect(groups.map((g) => g.category)).toEqual(['Reading']);
    expect(groups[0].tools.map((t) => t.id)).toEqual(['z-library']);
  });
});
