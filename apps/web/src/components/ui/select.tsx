import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** The browser's own select: accessible and mobile-friendly, styled like Input. */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  );
}
