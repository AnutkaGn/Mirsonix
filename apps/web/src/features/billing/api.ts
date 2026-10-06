import { redirectUrlSchema, type CheckoutRequest } from '@mirsonix/shared';
import { apiRequest } from '@/lib/api-client';

export const billingApi = {
  checkout: (request: CheckoutRequest) => apiRequest('/billing/checkout', { method: 'POST', body: request, schema: redirectUrlSchema }),
  portal: () => apiRequest('/billing/portal', { method: 'POST', body: {}, schema: redirectUrlSchema }),
};
