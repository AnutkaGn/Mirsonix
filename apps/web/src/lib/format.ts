import { format, parseISO } from 'date-fns';

const pad = (value: number): string => String(value).padStart(2, '0');

/** A track position or length as a player shows it: `4:07`, or `1:02:07` from an hour up. */
export function formatDuration(totalSec: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}` : `${minutes}:${pad(seconds % 60)}`;
}

const unit = (value: number, name: 'hour' | 'minute'): string =>
  new Intl.NumberFormat('en', { style: 'unit', unit: name, unitDisplay: 'narrow' }).format(value);

/** A total length for a program, in words a person would say: `1h 5m`, `45m`. Rounds up so it never undersells. */
export function formatTotalDuration(totalSec: number): string {
  const totalMinutes = Math.max(1, Math.ceil(totalSec / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return unit(minutes, 'minute');
  return minutes === 0 ? unit(hours, 'hour') : `${unit(hours, 'hour')} ${unit(minutes, 'minute')}`;
}

export function formatPrice({ amountMinor, currency }: { amountMinor: number; currency: string }): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency: currency.toUpperCase() }).format(amountMinor / 100);
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy');
}
