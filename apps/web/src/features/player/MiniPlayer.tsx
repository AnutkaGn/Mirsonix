import * as Player from './parts';

/** The pinned bar at the bottom of every page. */
export function MiniPlayer() {
  return (
    <Player.Root variant="mini" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2">
        <Player.Artwork />
        <Player.Info className="w-40 sm:w-56" />
        <div className="flex items-center gap-1">
          <Player.Previous />
          <Player.PlayPause />
          <Player.Next />
        </div>
        <Player.Progress className="hidden flex-1 md:flex" />
        <div className="ml-auto hidden items-center sm:flex">
          <Player.Speed />
          <Player.SleepTimer />
        </div>
        <Player.Expand />
      </div>
    </Player.Root>
  );
}
