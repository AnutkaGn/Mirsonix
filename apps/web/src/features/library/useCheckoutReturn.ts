import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { clearPurchase, readPurchase, type PendingPurchase } from '@/features/billing/pending-purchase';
import type { Ownership } from './api';

export type CheckoutReturnState = 'idle' | 'pending' | 'slow' | 'done';

const POLL_MS = 2000;
const GIVE_UP_AFTER_MS = 30_000;

const owns = (ownership: Ownership, purchase: PendingPurchase): boolean =>
  (purchase.kind === 'TRACK' ? ownership.trackIds : ownership.programIds).has(purchase.id);

/**
 * Handles coming back from Stripe (`?checkout=success`). Paying and getting access are two events: the access arrives
 * when Stripe's webhook does. So the library polls briefly for the item that was bought, then stops and says so.
 */
export function useCheckoutReturn(ownership: Ownership | undefined) {
  const [params, setParams] = useSearchParams();
  const returning = params.get('checkout') === 'success';
  const [gaveUp, setGaveUp] = useState(false);

  const purchase = useMemo(() => (returning ? readPurchase() : null), [returning]);
  const arrived = purchase !== null && ownership !== undefined && owns(ownership, purchase);

  useEffect(() => {
    if (!returning || arrived) return;
    const timeout = setTimeout(() => setGaveUp(true), GIVE_UP_AFTER_MS);
    return () => clearTimeout(timeout);
  }, [returning, arrived]);

  useEffect(() => {
    if (arrived) clearPurchase();
  }, [arrived]);

  const state: CheckoutReturnState = !returning ? 'idle' : arrived ? 'done' : gaveUp ? 'slow' : 'pending';
  return {
    state,
    pollMs: state === 'pending' ? POLL_MS : (false as const),
    dismiss: () => {
      clearPurchase();
      setParams(
        (current) => {
          current.delete('checkout');
          return current;
        },
        { replace: true },
      );
    },
  };
}
