import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition } from './content-status';

describe('content status transitions', () => {
  it.each([
    ['DRAFT', 'PUBLISHED'],
    ['DRAFT', 'ARCHIVED'],
    ['PUBLISHED', 'ARCHIVED'],
    ['ARCHIVED', 'PUBLISHED'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['PUBLISHED', 'DRAFT'], // subscribers may already exist, so published content is never pulled back
    ['ARCHIVED', 'DRAFT'],
    ['PUBLISHED', 'PUBLISHED'],
    ['DRAFT', 'DRAFT'],
    ['ARCHIVED', 'ARCHIVED'],
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('explains the refused change in a 409', () => {
    expect(() => assertTransition('PUBLISHED', 'DRAFT', 'track')).toThrow(ConflictException);
    expect(() => assertTransition('PUBLISHED', 'DRAFT', 'track')).toThrow('A track cannot go from PUBLISHED to DRAFT');
    expect(() => assertTransition('DRAFT', 'PUBLISHED', 'track')).not.toThrow();
  });
});
