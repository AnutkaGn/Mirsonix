import { ConflictException } from '@nestjs/common';
import type { ContentStatus } from '@mirsonix/shared';

/**
 * Published content can only be archived, never pulled back to a draft: people may already be subscribed to it.
 * Archived content can be published again.
 */
const ALLOWED: Record<ContentStatus, readonly ContentStatus[]> = {
  DRAFT: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: ['PUBLISHED'],
};

export const canTransition = (from: ContentStatus, to: ContentStatus): boolean => ALLOWED[from].includes(to);

export function assertTransition(from: ContentStatus, to: ContentStatus, subject: string): void {
  if (!canTransition(from, to)) {
    throw new ConflictException(`A ${subject} cannot go from ${from} to ${to}`);
  }
}
