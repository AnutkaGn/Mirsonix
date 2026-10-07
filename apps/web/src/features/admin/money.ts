import { MAX_PRICE_MINOR, MIN_PRICE_MINOR } from '@mirsonix/shared';

export type PriceInput = { ok: true; minor: number | null } | { ok: false };

const DECIMAL_AMOUNT = /^\d+(?:[.,]\d{1,2})?$/;

/** A dollar amount typed by an admin, as minor units. Blank means "not on sale"; anything unusable is rejected. */
export function parsePriceInput(raw: string): PriceInput {
  const text = raw.trim();
  if (text === '') return { ok: true, minor: null };
  if (!DECIMAL_AMOUNT.test(text)) return { ok: false };
  const minor = Math.round(Number(text.replace(',', '.')) * 100);
  return minor >= MIN_PRICE_MINOR && minor <= MAX_PRICE_MINOR ? { ok: true, minor } : { ok: false };
}

/** The text an input shows for a stored price: `9.99`, `10`, or empty when not on sale. */
export function priceToInput(minor: number | null): string {
  if (minor === null) return '';
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}
