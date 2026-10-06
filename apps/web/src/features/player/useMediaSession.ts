import { useEffect } from 'react';
import { selectCurrentTrack, usePlayerStore } from './player.store';
import { useProgressStore } from './progress.store';

/** Hooks the player into the operating system: lock screen, headphone buttons and media keys. */
export function useMediaSession(): void {
  const track = usePlayerStore(selectCurrentTrack);
  const wantsPlay = usePlayerStore((state) => state.wantsPlay);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = track
      ? new MediaMetadata({ title: track.title, artist: 'Mirsonix', ...(track.coverUrl && { artwork: [{ src: track.coverUrl }] }) })
      : null;
  }, [track]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = track ? (wantsPlay ? 'playing' : 'paused') : 'none';
  }, [track, wantsPlay]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const store = usePlayerStore.getState;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => !store().wantsPlay && store().togglePlay()],
      ['pause', () => store().pause()],
      ['previoustrack', () => store().previous(useProgressStore.getState().positionSec)],
      ['nexttrack', () => store().next()],
      ['seekto', (details) => details.seekTime !== undefined && store().seekTo(details.seekTime)],
    ];
    for (const [action, handler] of handlers) navigator.mediaSession.setActionHandler(action, handler);
    return () => {
      for (const [action] of handlers) navigator.mediaSession.setActionHandler(action, null);
    };
  }, []);
}
