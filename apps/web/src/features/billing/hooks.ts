import { useMutation, useQueryClient } from '@tanstack/react-query';
import { redirectTo } from '@/lib/navigation';
import { libraryKeys } from '@/features/library/api';
import { billingApi } from './api';
import { rememberPurchase, targetOf } from './pending-purchase';

/** Both go to a page hosted by Stripe, so success is a redirect and nothing is cached. */
export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: billingApi.checkout,
    onSuccess: ({ url }, request) => {
      rememberPurchase(targetOf(request)); // so the library can recognise this purchase when the listener comes back
      redirectTo(url);
    },
    // A 409 means the library on screen is out of date (they already subscribe), so refresh it.
    onError: () => void queryClient.invalidateQueries({ queryKey: libraryKeys.all }),
  });
}

export function usePortal() {
  return useMutation({ mutationFn: billingApi.portal, onSuccess: ({ url }) => redirectTo(url) });
}
