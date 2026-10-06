import type { TrackSummary } from '@mirsonix/shared';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '@/lib/format';

/** `10:00 · 432 Hz · Binaural`, leaving out what the track does not have. */
export function TrackMeta({ track }: { track: Pick<TrackSummary, 'durationSec' | 'frequencyHz' | 'waveType'> }) {
  const { t } = useTranslation();
  const parts = [
    formatDuration(track.durationSec),
    track.frequencyHz !== null ? t('catalog.hertz', { value: track.frequencyHz }) : null,
    track.waveType ? t(`waves.${track.waveType}`) : null,
  ].filter((part): part is string => part !== null);
  return <p className="text-xs text-muted-foreground">{parts.join(' · ')}</p>;
}
