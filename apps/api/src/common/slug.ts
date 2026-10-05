import { randomBytes } from 'node:crypto';

/** URL-safe, lower-case, ASCII. Accents are folded (é -> e); anything else collapses to a hyphen. */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return slug || 'item';
}

/** First free slug for a title: `base`, then `base-2`, `base-3`, ... and a random suffix as a last resort. */
export async function uniqueSlug(title: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(title);
  if (!(await exists(base))) return base;
  for (let attempt = 2; attempt <= 50; attempt++) {
    const candidate = `${base}-${attempt}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${randomBytes(3).toString('hex')}`;
}
