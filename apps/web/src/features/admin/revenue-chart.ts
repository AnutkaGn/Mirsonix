import type { RevenueSeries } from '@mirsonix/shared';

export interface Bar {
  date: string;
  netMinor: number;
  /** Height as a percentage of the tallest bar. A day with revenue is never thinner than 2% so it stays visible. */
  heightPercent: number;
}

export function toBars(items: RevenueSeries['items']): Bar[] {
  const max = Math.max(0, ...items.map((item) => item.netMinor));
  return items.map(({ date, netMinor }) => ({
    date,
    netMinor,
    heightPercent: max === 0 || netMinor <= 0 ? 0 : Math.max(2, Math.round((netMinor / max) * 100)),
  }));
}
