import { describe, expect, it, vi } from 'vitest';
import { slugify, uniqueSlug } from './slug';

describe('slugify', () => {
  it.each([
    ['Lung Meridian Opening', 'lung-meridian-opening'],
    ['  Back   pain!!  ', 'back-pain'],
    ['Café Résumé', 'cafe-resume'],
    ['432 Hz / Deep Sleep', '432-hz-deep-sleep'],
    ['---edges---', 'edges'],
  ])('turns %j into %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('falls back to a placeholder when nothing usable is left', () => {
    expect(slugify('!!!')).toBe('item');
    expect(slugify('Тиша')).toBe('item'); // non-Latin text has no ASCII form yet
  });

  it('caps the length and never ends on a hyphen', () => {
    const slug = slugify(`${'a'.repeat(79)} b`);

    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('uniqueSlug', () => {
  it('returns the plain slug when it is free', async () => {
    await expect(uniqueSlug('Deep Sleep', async () => false)).resolves.toBe('deep-sleep');
  });

  it('numbers the slug until it finds a free one', async () => {
    const taken = new Set(['deep-sleep', 'deep-sleep-2']);

    await expect(uniqueSlug('Deep Sleep', async (s) => taken.has(s))).resolves.toBe('deep-sleep-3');
  });

  it('falls back to a random suffix instead of looping forever', async () => {
    const exists = vi.fn(async (slug: string) => /^deep-sleep(-\d+)?$/.test(slug));

    const slug = await uniqueSlug('Deep Sleep', exists);

    expect(slug).toMatch(/^deep-sleep-[0-9a-f]{6}$/);
    expect(exists).toHaveBeenCalledTimes(50); // base + 49 numbered attempts
  });
});
