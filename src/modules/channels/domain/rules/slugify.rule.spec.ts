import { describe, expect, it } from 'vitest';
import { slugify } from './slugify.rule';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Jane Sells Stuff')).toBe('jane-sells-stuff');
  });

  it('strips punctuation', () => {
    expect(slugify("Jane's Vintage & Co.")).toBe('jane-s-vintage-co');
  });

  it('collapses repeated separators', () => {
    expect(slugify('Jane   ---  Sells')).toBe('jane-sells');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -Jane Sells- ')).toBe('jane-sells');
  });

  it('falls back to "channel" when nothing alphanumeric survives', () => {
    expect(slugify('!!!')).toBe('channel');
    expect(slugify('')).toBe('channel');
  });
});
