/** Follows the system light/dark setting, live. Returns a function that stops following. */
export function followSystemColorScheme(): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.classList.toggle('dark', query.matches);
  apply();
  query.addEventListener('change', apply);
  return () => query.removeEventListener('change', apply);
}
