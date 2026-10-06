type Value = string | number | boolean | null | undefined;

/** `?a=1&b=x`, leaving out anything unset or blank so a URL only carries what the user actually chose. */
export function toQueryString(params: Record<string, Value>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
