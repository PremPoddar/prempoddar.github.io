import { describe, it, expect } from 'vitest';
import { lastmodForPage } from '../src/lib/sitemap';

describe('lastmodForPage', () => {
  it('dates a post from its last git change', () => {
    expect(lastmodForPage('/writing/caffeinatecat-lid-closed/')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('dates content pages from their content file', () => {
    expect(lastmodForPage('/apps/brewlight/')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(lastmodForPage('/work/ecg-engine/')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('dates section pages and the home page from whatever feeds them', () => {
    expect(lastmodForPage('/')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(lastmodForPage('/apps/')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(lastmodForPage('/writing/')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('dates the toolbox and the resume', () => {
    expect(lastmodForPage('/toolbox/')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(lastmodForPage('/resume/')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('accepts full urls and skips pages it cannot map', () => {
    expect(lastmodForPage('https://prempoddar.is-a.dev/writing/caffeinatecat-lid-closed/')).toMatch(/^\d{4}-/);
    expect(lastmodForPage('/nowhere/')).toBeUndefined();
  });
});
