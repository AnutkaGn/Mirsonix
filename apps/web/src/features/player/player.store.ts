import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  PREVIOUS_RESTART_THRESHOLD_SEC,
  indexAfterEnd,
  indexForNext,
  indexForPrevious,
  nextLoopMode,
  type LoopMode,
} from './queue';

export interface PlayerTrack {
  id: string;
  slug: string;
  title: string;
  durationSec: number;
  coverUrl: string | null;
  /** Set when played from inside a program, so listening can be attributed to it. */
  programId?: string;
}

export type SleepTimer = { kind: 'minutes'; endsAt: number; minutes: number } | { kind: 'end-of-track' };
export type SleepOption = { minutes: number } | 'end-of-track';

/** What the audio engine is doing. `wantsPlay` is separate: it is what the listener asked for. */
export type Phase = 'idle' | 'loading' | 'ready' | 'error';

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
export const SLEEP_MINUTES = [15, 30, 45, 60] as const;

interface PlayerState {
  queue: PlayerTrack[];
  index: number;
  /** Bumped whenever the engine must (re)load the current track: a new track, or a retry after an error. */
  loadId: number;
  wantsPlay: boolean;
  phase: Phase;
  playbackRate: number;
  loop: LoopMode;
  sleepTimer: SleepTimer | null;
  expanded: boolean;
  /** A request for the engine to jump; `id` makes two requests for the same second distinct. */
  seekRequest: { sec: number; id: number } | null;

  playQueue: (tracks: PlayerTrack[], startIndex?: number) => void;
  togglePlay: () => void;
  pause: () => void;
  next: () => void;
  previous: (positionSec: number) => void;
  jumpTo: (index: number) => void;
  seekTo: (sec: number) => void;
  setPlaybackRate: (rate: number) => void;
  cycleLoop: () => void;
  setSleepTimer: (option: SleepOption | null, now?: number) => void;
  setExpanded: (expanded: boolean) => void;
  setPhase: (phase: Phase) => void;
  /** Loads the current track again from the start of its link, as after an error. */
  reload: () => void;
  /** The engine calls this when a track finished by itself. */
  finishTrack: () => void;
  clear: () => void;
}

const initial = {
  queue: [] as PlayerTrack[],
  index: -1,
  loadId: 0,
  wantsPlay: false,
  phase: 'idle' as Phase,
  sleepTimer: null as SleepTimer | null,
  expanded: false,
  seekRequest: null as PlayerState['seekRequest'],
};

let seekCounter = 0;
const seek = (sec: number) => ({ sec, id: ++seekCounter });

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      ...initial,
      playbackRate: 1,
      loop: 'off',

      playQueue: (tracks, startIndex = 0) => {
        if (tracks.length === 0) return;
        const index = Math.min(Math.max(startIndex, 0), tracks.length - 1);
        set((state) => ({ queue: tracks, index, loadId: state.loadId + 1, wantsPlay: true, phase: 'loading', seekRequest: null }));
      },

      togglePlay: () => {
        if (get().index < 0) return;
        set((state) => ({ wantsPlay: !state.wantsPlay }));
      },

      pause: () => set({ wantsPlay: false }),

      next: () => {
        const { index, queue, loop } = get();
        const target = indexForNext(index, queue.length, loop);
        if (target !== null) set((state) => ({ index: target, loadId: state.loadId + 1, wantsPlay: true, phase: 'loading', seekRequest: null }));
      },

      previous: (positionSec) => {
        const { index, queue, loop } = get();
        if (index < 0) return;
        if (positionSec > PREVIOUS_RESTART_THRESHOLD_SEC) {
          set({ seekRequest: seek(0) });
          return;
        }
        const target = indexForPrevious(index, queue.length, loop);
        if (target === index) set({ seekRequest: seek(0) });
        else set((state) => ({ index: target, loadId: state.loadId + 1, wantsPlay: true, phase: 'loading', seekRequest: null }));
      },

      jumpTo: (index) => {
        if (index < 0 || index >= get().queue.length) return;
        set((state) => ({ index, loadId: state.loadId + 1, wantsPlay: true, phase: 'loading', seekRequest: null }));
      },

      seekTo: (sec) => set({ seekRequest: seek(Math.max(0, sec)) }),

      setPlaybackRate: (rate) => set({ playbackRate: rate }),

      cycleLoop: () => set((state) => ({ loop: nextLoopMode(state.loop) })),

      setSleepTimer: (option, now = Date.now()) => {
        if (option === null) set({ sleepTimer: null });
        else if (option === 'end-of-track') set({ sleepTimer: { kind: 'end-of-track' } });
        else set({ sleepTimer: { kind: 'minutes', endsAt: now + option.minutes * 60_000, minutes: option.minutes } });
      },

      setExpanded: (expanded) => set({ expanded }),
      setPhase: (phase) => set({ phase }),

      reload: () => {
        if (get().index < 0) return;
        set((state) => ({ loadId: state.loadId + 1, wantsPlay: true, phase: 'loading', seekRequest: null }));
      },

      finishTrack: () => {
        const { index, queue, loop, sleepTimer } = get();
        if (sleepTimer?.kind === 'end-of-track') {
          set({ wantsPlay: false, sleepTimer: null }); // the listener asked to fall asleep after this track
          return;
        }
        const target = indexAfterEnd(index, queue.length, loop);
        if (target === null) set({ wantsPlay: false });
        else if (target === index) set({ seekRequest: seek(0), wantsPlay: true }); // repeat this track
        else set((state) => ({ index: target, loadId: state.loadId + 1, wantsPlay: true, phase: 'loading', seekRequest: null }));
      },

      clear: () => set({ ...initial }),
    }),
    {
      name: 'mirsonix-player',
      storage: createJSONStorage(() => localStorage),
      // Only preferences survive a reload. A queue would need fresh stream links and access checks anyway.
      partialize: (state) => ({ playbackRate: state.playbackRate, loop: state.loop }),
    },
  ),
);

export const selectCurrentTrack = (state: Pick<PlayerState, 'queue' | 'index'>): PlayerTrack | null => state.queue[state.index] ?? null;
