import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { filterResources, groupByCategory, type Resource } from '../src/lib/resources';

const resources: Resource[] = parse(readFileSync('src/content/resources.yaml', 'utf8'));

describe('filterResources', () => {
  it('matches names case-insensitively', () => {
    expect(filterResources(resources, 'GHIDRA', null, null).map((r) => r.id)).toEqual(['ghidra']);
  });

  it('matches the host and the why line', () => {
    expect(filterResources(resources, 'telegra.ph', null, null).map((r) => r.id)).toEqual(['telegraph']);
    expect(filterResources(resources, 'game theory', null, null).map((r) => r.id)).toEqual(['evolution-of-trust']);
  });

  it('treats regex characters as plain text', () => {
    expect(() => filterResources(resources, '(', null, null)).not.toThrow();
    expect(filterResources(resources, 'c++', null, null)).toEqual([]);
  });

  it('filters by category', () => {
    expect(filterResources(resources, '', 'Android', null).map((r) => r.id).sort()).toEqual(['f-droid', 'morphe']);
  });

  it('filters by tag', () => {
    const open = filterResources(resources, '', null, 'open source');
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((r) => r.tags.includes('open source'))).toBe(true);
  });

  it('returns everything for an empty query', () => {
    expect(filterResources(resources, '  ', null, null)).toHaveLength(resources.length);
  });
});

describe('groupByCategory', () => {
  it('follows the given order and skips empty categories', () => {
    const groups = groupByCategory(filterResources(resources, '', 'Reading', null), ['Android', 'Reading']);
    expect(groups.map((g) => g.category)).toEqual(['Reading']);
    expect(groups[0].resources.map((r) => r.id)).toEqual(['z-library']);
  });
});
