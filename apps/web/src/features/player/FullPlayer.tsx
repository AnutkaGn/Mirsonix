import { Dialog as DialogPrimitive, VisuallyHidden } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import * as Player from './parts';
import { selectCurrentTrack, usePlayerStore } from './player.store';

/** The expanded, full-screen player. A dialog, so focus stays inside it and Escape closes it. */
export function FullPlayer() {
  const { t } = useTranslation();
  const expanded = usePlayerStore((state) => state.expanded);
  const hasTrack = usePlayerStore((state) => selectCurrentTrack(state) !== null);
  const setExpanded = usePlayerStore((state) => state.setExpanded);

  return (
    <DialogPrimitive.Root open={expanded && hasTrack} onOpenChange={setExpanded}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-0 z-50 overflow-y-auto bg-background p-6">
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>{t('player.nowPlaying')}</DialogPrimitive.Title>
            <DialogPrimitive.Description>{t('player.fullDescription')}</DialogPrimitive.Description>
          </VisuallyHidden.Root>
          <Player.Root variant="full" className="mx-auto flex max-w-md flex-col items-center gap-6 pt-4">
            <div className="flex w-full justify-end">
              <Player.Expand />
            </div>
            <Player.Artwork />
            <Player.Info className="w-full" />
            <Player.Progress className="w-full" />
            <div className="flex items-center gap-4">
              <Player.Previous />
              <Player.PlayPause />
              <Player.Next />
            </div>
            <div className="flex items-center gap-2">
              <Player.Loop />
              <Player.Speed />
              <Player.SleepTimer />
            </div>
            <Player.Queue className="w-full" />
          </Player.Root>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
