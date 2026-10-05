import type { ValueTransformer } from 'typeorm';

/** pg returns numeric/bigint as strings; the domain wants numbers. Safe for our ranges (Hz, bytes). */
export const numberTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : Number(value)),
};
