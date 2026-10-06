export type LoopMode = 'off' | 'all' | 'one';

export const LOOP_MODES: readonly LoopMode[] = ['off', 'all', 'one'];

export const nextLoopMode = (mode: LoopMode): LoopMode => LOOP_MODES[(LOOP_MODES.indexOf(mode) + 1) % LOOP_MODES.length] as LoopMode;

/** Past this many seconds, "previous" restarts the current track instead of leaving it, as every player does. */
export const PREVIOUS_RESTART_THRESHOLD_SEC = 3;

/** Which track plays after the current one ends by itself. `null` means stop. */
export function indexAfterEnd(index: number, length: number, loop: LoopMode): number | null {
  if (length === 0) return null;
  if (loop === 'one') return index;
  if (index + 1 < length) return index + 1;
  return loop === 'all' ? 0 : null;
}

/** Which track the listener lands on by pressing "next". Repeating one track does not trap them there. `null` = no change. */
export function indexForNext(index: number, length: number, loop: LoopMode): number | null {
  if (index + 1 < length) return index + 1;
  return loop === 'all' && length > 0 ? 0 : null;
}

export function indexForPrevious(index: number, length: number, loop: LoopMode): number {
  if (index > 0) return index - 1;
  return loop === 'all' && length > 0 ? length - 1 : 0;
}
