/** Moves the item at `index` by `delta` places. Out-of-range moves leave the list as it is. */
export function moveItem<T>(items: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved as T);
  return next;
}

export const removeItem = <T>(items: readonly T[], index: number): T[] =>
  items.filter((_, i) => i !== index);

/** A track can be in a program only once, so a second add of the same id changes nothing. */
export const appendUnique = (ids: readonly string[], id: string): string[] =>
  ids.includes(id) ? [...ids] : [...ids, id];

export const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);
