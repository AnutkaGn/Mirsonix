import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { describeError } from './describe-error';

describe('describeError', () => {
  it('names the fields of a payload that did not parse, once each, without echoing their values', () => {
    const parsed = z.object({ customer: z.string(), items: z.object({ data: z.array(z.string()) }) }).safeParse({ customer: 42, secret: 'x' });
    if (parsed.success) throw new Error('expected a parse failure');

    const message = describeError(parsed.error);

    expect(message).toBe('Payload did not match the expected shape; check: customer, items');
    expect(message).not.toContain('42');
  });

  it('uses the message of an ordinary error', () => {
    expect(describeError(new Error('Invoice in_1 is not recorded yet'))).toBe('Invoice in_1 is not recorded yet');
  });

  it('turns anything else into text', () => {
    expect(describeError('boom')).toBe('boom');
    expect(describeError(undefined)).toBe('undefined');
  });
});
