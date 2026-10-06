import { FullPlayer } from './FullPlayer';
import { MiniPlayer } from './MiniPlayer';
import { PlayerEngine } from './PlayerEngine';
import { useMediaSession } from './useMediaSession';

/** Everything the player needs, mounted once for a signed-in listener. Removing it (logging out) stops the sound. */
export function PlayerHost() {
  useMediaSession();
  return (
    <>
      <PlayerEngine />
      <MiniPlayer />
      <FullPlayer />
    </>
  );
}
