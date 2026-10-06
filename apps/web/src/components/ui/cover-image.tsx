import { Music } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A cover or poster, or a calm gradient while there is none or it cannot be loaded (an expired link, a removed file).
 * The title beside it names it, so the image itself is decorative.
 */
export function CoverImage({ url, className }: { url: string | null; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) {
    return (
      <div
        aria-hidden
        className={cn('flex items-center justify-center bg-gradient-to-br from-primary/30 via-primary/10 to-muted text-primary/60', className)}
      >
        <Music className="size-1/3" />
      </div>
    );
  }
  return <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(url)} className={cn('object-cover', className)} />;
}
