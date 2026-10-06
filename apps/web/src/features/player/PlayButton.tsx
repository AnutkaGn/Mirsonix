import { Loader2, Pause, Play, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { selectCurrentTrack, usePlayerStore, type PlayerTrack } from './player.store';

interface PlayButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** The queue to play. Playing one track from a list queues the whole list, so "next" continues through it. */
  tracks: PlayerTrack[];
  index?: number;
  label?: string;
}

/** Starts a queue, or pauses and resumes when the track at `index` is the one already loaded. */
export function PlayButton({ tracks, index = 0, label, className, children, ...props }: PlayButtonProps) {
  const { t } = useTranslation();
  const target = tracks[index];
  const isCurrent = usePlayerStore((state) => target !== undefined && selectCurrentTrack(state)?.id === target.id);
  const wantsPlay = usePlayerStore((state) => state.wantsPlay);
  const phase = usePlayerStore((state) => state.phase);
  const playQueue = usePlayerStore((state) => state.playQueue);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const reload = usePlayerStore((state) => state.reload);

  const failed = isCurrent && phase === 'error';
  const playing = isCurrent && wantsPlay && !failed;
  const buffering = playing && phase === 'loading';
  const Icon = failed ? RotateCcw : buffering ? Loader2 : playing ? Pause : Play;
  const text = label ?? (failed ? t('player.retry') : playing ? t('player.pause') : t('player.play'));
  return (
    <Button
      disabled={!target}
      // A track that failed to load is tried again, not paused: pausing something that never played does nothing.
      onClick={() => (failed ? reload() : isCurrent ? togglePlay() : playQueue(tracks, index))}
      aria-label={children ? undefined : text}
      className={cn(className)}
      {...props}
    >
      <Icon className={cn('size-4', children && 'mr-2', buffering && 'animate-spin')} aria-hidden />
      {children}
    </Button>
  );
}
