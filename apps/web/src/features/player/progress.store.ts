import { create } from 'zustand';

interface ProgressState {
  positionSec: number;
  durationSec: number;
  bufferedSec: number;
  update: (patch: Partial<Pick<ProgressState, 'positionSec' | 'durationSec' | 'bufferedSec'>>) => void;
  reset: (durationSec?: number) => void;
}

/**
 * Where the playhead is. It changes about four times a second, so it lives apart from the player store: only the
 * progress bar and the time labels subscribe to it, and nothing else re-renders while a track plays.
 */
export const useProgressStore = create<ProgressState>((set) => ({
  positionSec: 0,
  durationSec: 0,
  bufferedSec: 0,
  update: (patch) => set(patch),
  reset: (durationSec = 0) => set({ positionSec: 0, durationSec, bufferedSec: 0 }),
}));
