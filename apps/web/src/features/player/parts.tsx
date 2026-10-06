import { ChevronDown, Gauge, ListMusic, Loader2, Maximize2, Moon, Pause, Play, Repeat, Repeat1, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PLAYBACK_RATES, SLEEP_MINUTES, selectCurrentTrack, usePlayerStore, type PlayerTrack } from './player.store';
import { useProgressStore } from './progress.store';

type Variant = 'mini' | 'full';
interface PlayerContext {
  track: PlayerTrack;
  variant: Variant;
}

const Context = createContext<PlayerContext | null>(null);

function usePlayerPart(): PlayerContext {
  const context = useContext(Context);
  if (!context) throw new Error('Player parts must be rendered inside <Player.Root>');
  return context;
}

/**
 * The player as parts, used as a namespace: `import * as Player from './parts'`. `Player.Root` supplies the current
 * track and the layout variant; every other part reads the store itself, so a screen assembles only what it needs
 * (`MiniPlayer` and `FullPlayer` are two such arrangements).
 */
export function Root({ variant, className, children }: { variant: Variant; className?: string; children: ReactNode }) {
  const track = usePlayerStore(selectCurrentTrack);
  if (!track) return null;
  return (
    <Context.Provider value={{ track, variant }}>
      <div className={className}>{children}</div>
    </Context.Provider>
  );
}

export function Artwork({ className }: { className?: string }) {
  const { track, variant } = usePlayerPart();
  return <CoverImage url={track.coverUrl} className={cn(variant === 'mini' ? 'size-12 rounded-md' : 'aspect-square w-full max-w-sm rounded-2xl', className)} />;
}

export function Info({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { track, variant } = usePlayerPart();
  const phase = usePlayerStore((state) => state.phase);
  return (
    <div className={cn('min-w-0', variant === 'full' && 'text-center', className)}>
      <p className={cn('truncate font-medium', variant === 'full' && 'text-xl')}>{track.title}</p>
      {phase === 'error' && (
        <p role="alert" className="text-xs text-red-500">
          {t('player.error')}
        </p>
      )}
    </div>
  );
}

export function PlayPause({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { variant } = usePlayerPart();
  const wantsPlay = usePlayerStore((state) => state.wantsPlay);
  const phase = usePlayerStore((state) => state.phase);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const reload = usePlayerStore((state) => state.reload);

  const failed = phase === 'error';
  const buffering = wantsPlay && phase === 'loading';
  const Icon = failed ? RotateCcw : buffering ? Loader2 : wantsPlay ? Pause : Play;
  return (
    <Button
      onClick={failed ? reload : togglePlay}
      aria-busy={buffering}
      aria-label={failed ? t('player.retry') : wantsPlay ? t('player.pause') : t('player.play')}
      className={cn('rounded-full', variant === 'mini' ? 'size-10 p-0' : 'size-16 p-0', className)}
    >
      <Icon className={cn(variant === 'mini' ? 'size-5' : 'size-7', buffering && 'animate-spin')} aria-hidden />
    </Button>
  );
}

export function Previous() {
  const { t } = useTranslation();
  const previous = usePlayerStore((state) => state.previous);
  return (
    // The position is read when pressed, not subscribed to: this button must not re-render four times a second.
    <Button variant="ghost" size="sm" aria-label={t('player.previous')} onClick={() => previous(useProgressStore.getState().positionSec)}>
      <SkipBack className="size-5" aria-hidden />
    </Button>
  );
}

export function Next() {
  const { t } = useTranslation();
  const next = usePlayerStore((state) => state.next);
  const isLast = usePlayerStore((state) => state.index >= state.queue.length - 1 && state.loop === 'off');
  return (
    <Button variant="ghost" size="sm" aria-label={t('player.next')} onClick={next} disabled={isLast}>
      <SkipForward className="size-5" aria-hidden />
    </Button>
  );
}

export function Progress({ className }: { className?: string }) {
  const { t } = useTranslation();
  const positionSec = useProgressStore((state) => state.positionSec);
  const durationSec = useProgressStore((state) => state.durationSec);
  const seekTo = usePlayerStore((state) => state.seekTo);
  const [dragging, setDragging] = useState<number | null>(null);

  const shown = Math.min(dragging ?? positionSec, durationSec || 0);
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{formatDuration(shown)}</span>
      <Slider
        aria-label={t('player.position')}
        min={0}
        max={Math.max(durationSec, 1)}
        step={1}
        value={[shown]}
        disabled={durationSec === 0}
        onValueChange={([value]) => setDragging(value ?? 0)}
        onValueCommit={([value]) => {
          seekTo(value ?? 0);
          setDragging(null);
        }}
      />
      <span className="w-12 text-xs tabular-nums text-muted-foreground">{formatDuration(durationSec)}</span>
    </div>
  );
}

export function Speed() {
  const { t } = useTranslation();
  const rate = usePlayerStore((state) => state.playbackRate);
  const setRate = usePlayerStore((state) => state.setPlaybackRate);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('player.speed')}>
          <Gauge className="size-4" aria-hidden />
          <span className="ml-1 text-xs tabular-nums">{rate}×</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={String(rate)} onValueChange={(value) => setRate(Number(value))}>
          {PLAYBACK_RATES.map((option) => (
            <DropdownMenuRadioItem key={option} value={String(option)}>
              {option}×
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const MINUTE_MS = 60_000;

export function SleepTimer() {
  const { t } = useTranslation();
  const timer = usePlayerStore((state) => state.sleepTimer);
  const setSleepTimer = usePlayerStore((state) => state.setSleepTimer);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (timer?.kind !== 'minutes') return;
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0); // the clock may have moved on since this component last rendered
    const interval = setInterval(update, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [timer]);

  const value = timer === null ? 'off' : timer.kind === 'end-of-track' ? 'end-of-track' : 'minutes';
  // `now` may be older than the timer itself (it was read when this component last ticked), so never count from before it began.
  const minutesLeft =
    timer?.kind === 'minutes' ? Math.max(1, Math.ceil((timer.endsAt - Math.max(now, timer.endsAt - timer.minutes * MINUTE_MS)) / MINUTE_MS)) : null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('player.sleep.label')}>
          <Moon className={cn('size-4', timer && 'text-primary')} aria-hidden />
          {minutesLeft !== null && <span className="ml-1 text-xs tabular-nums">{t('player.sleep.remaining', { count: minutesLeft })}</span>}
          {timer?.kind === 'end-of-track' && <span className="ml-1 text-xs">{t('player.sleep.endOfTrack')}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(choice) => {
            if (choice === 'off') setSleepTimer(null);
            else if (choice === 'end-of-track') setSleepTimer('end-of-track');
            else setSleepTimer({ minutes: Number(choice.replace('m', '')) });
          }}
        >
          <DropdownMenuRadioItem value="off">{t('player.sleep.off')}</DropdownMenuRadioItem>
          {SLEEP_MINUTES.map((minutes) => (
            // A running "minutes" timer has no matching item (it shows the remaining time), so these are plain choices.
            <DropdownMenuRadioItem key={minutes} value={`${minutes}m`}>
              {t('player.sleep.minutes', { count: minutes })}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuRadioItem value="end-of-track">{t('player.sleep.endOfTrack')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Loop() {
  const { t } = useTranslation();
  const loop = usePlayerStore((state) => state.loop);
  const cycleLoop = usePlayerStore((state) => state.cycleLoop);
  const Icon = loop === 'one' ? Repeat1 : Repeat;
  return (
    <Button variant="ghost" size="sm" aria-label={t(`player.loop.${loop}`)} aria-pressed={loop !== 'off'} onClick={cycleLoop}>
      <Icon className={cn('size-4', loop !== 'off' && 'text-primary')} aria-hidden />
    </Button>
  );
}

export function Queue({ className }: { className?: string }) {
  const { t } = useTranslation();
  const queue = usePlayerStore((state) => state.queue);
  const index = usePlayerStore((state) => state.index);
  const jumpTo = usePlayerStore((state) => state.jumpTo);
  if (queue.length < 2) return null;
  return (
    <section aria-label={t('player.queue')} className={className}>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <ListMusic className="size-4" aria-hidden />
        {t('player.queue')}
      </h3>
      <ol className="max-h-56 overflow-y-auto">
        {queue.map((item, position) => (
          <li key={`${item.id}-${position}`}>
            <button
              type="button"
              onClick={() => jumpTo(position)}
              aria-current={position === index ? 'true' : undefined}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
                position === index && 'bg-muted font-medium text-primary',
              )}
            >
              <span className="truncate">{item.title}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{formatDuration(item.durationSec)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Opens the full-screen player from the mini one, or closes it from the full one. */
export function Expand() {
  const { t } = useTranslation();
  const { variant } = usePlayerPart();
  const setExpanded = usePlayerStore((state) => state.setExpanded);
  const opening = variant === 'mini';
  const Icon = opening ? Maximize2 : ChevronDown;
  return (
    <Button variant="ghost" size="sm" aria-label={opening ? t('player.expand') : t('player.collapse')} onClick={() => setExpanded(opening)}>
      <Icon className="size-4" aria-hidden />
    </Button>
  );
}
