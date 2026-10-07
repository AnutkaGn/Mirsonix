import { MAX_PRICE_MINOR, MIN_PRICE_MINOR } from '@mirsonix/shared';
import { describe, expect, it } from 'vitest';
import { parsePriceInput, priceToInput } from './money';

describe('parsePriceInput', () => {
  it.each([
    ['9.99', 999],
    ['10', 1000],
    ['9,99', 999],
    ['0.5', 50],
    ['  12.30 ', 1230],
  ])('reads %s as %i minor units', (raw, minor) => {
    expect(parsePriceInput(raw)).toEqual({ ok: true, minor });
  });

  it('treats a blank field as off sale', () => {
    expect(parsePriceInput('   ')).toEqual({ ok: true, minor: null });
  });

  it('avoids floating point drift', () => {
    expect(parsePriceInput('19.99')).toEqual({ ok: true, minor: 1999 });
    expect(parsePriceInput('1.15')).toEqual({ ok: true, minor: 115 });
  });

  it('accepts exactly the minimum and maximum', () => {
    expect(parsePriceInput(String(MIN_PRICE_MINOR / 100))).toEqual({
      ok: true,
      minor: MIN_PRICE_MINOR,
    });
    expect(parsePriceInput(String(MAX_PRICE_MINOR / 100))).toEqual({
      ok: true,
      minor: MAX_PRICE_MINOR,
    });
  });

  it.each([['0'], [String((MIN_PRICE_MINOR - 1) / 100)], [String((MAX_PRICE_MINOR + 1) / 100)]])(
    'rejects %s as out of range',
    (raw) => {
      expect(parsePriceInput(raw)).toEqual({ ok: false });
    },
  );

  it.each([['abc'], ['-5'], ['1.234'], ['1e3'], ['$5'], ['5.']])(
    'rejects %s as malformed',
    (raw) => {
      expect(parsePriceInput(raw)).toEqual({ ok: false });
    },
  );
});

describe('priceToInput', () => {
  it.each([
    [null, ''],
    [999, '9.99'],
    [1000, '10'],
    [50, '0.50'],
  ])('shows %s as "%s"', (minor, text) => {
    expect(priceToInput(minor)).toBe(text);
  });

  it('round-trips through the parser', () => {
    for (const minor of [50, 999, 1000, 12_345])
      expect(parsePriceInput(priceToInput(minor))).toEqual({ ok: true, minor });
  });
});
