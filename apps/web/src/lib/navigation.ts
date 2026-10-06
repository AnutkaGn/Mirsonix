/** Leaves the app for another site (Stripe). Wrapped so tests can observe it, since jsdom cannot navigate. */
export function redirectTo(url: string): void {
  window.location.assign(url);
}
