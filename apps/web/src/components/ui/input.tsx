import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  );
}
