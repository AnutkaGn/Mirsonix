import type { CheckoutRequest } from '@mirsonix/shared';

export interface PendingPurchase {
  kind: 'TRACK' | 'PROGRAM';
  id: string;
}

const KEY = 'mirsonix:pending-purchase';

export const targetOf = (request: Pick<CheckoutRequest, 'trackId' | 'programId'>): PendingPurchase =>
  request.trackId ? { kind: 'TRACK', id: request.trackId } : { kind: 'PROGRAM', id: request.programId as string };

/**
 * Remembers what was being bought across the trip to Stripe and back, so the library can tell whether *that* item
 * has arrived. Storage can be unavailable (private windows), in which case the library just waits generically.
 */
export function rememberPurchase(purchase: PendingPurchase): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(purchase));
  } catch {
    // Not remembering only means a less specific message after checkout.
  }
}

export function readPurchase(): PendingPurchase | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Partial<PendingPurchase> | null;
    return parsed && (parsed.kind === 'TRACK' || parsed.kind === 'PROGRAM') && typeof parsed.id === 'string' ? { kind: parsed.kind, id: parsed.id } : null;
  } catch {
    return null;
  }
}

export function clearPurchase(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
