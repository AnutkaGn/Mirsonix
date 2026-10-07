import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { adminErrorKey } from './errors';
import { useAudioPreview } from './hooks';

/** Lets an admin hear the stored file before publishing. The signed link is fetched on demand, never kept. */
export function AudioPreview({ trackId }: { trackId: string }) {
  const { t } = useTranslation();
  const preview = useAudioPreview();
  if (preview.data)
    return (
      <audio
        controls
        autoPlay
        src={preview.data.url}
        aria-label={t('admin.tracks.preview')}
        className="w-full max-w-md"
      />
    );
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={preview.isPending}
        onClick={() => preview.mutate(trackId)}
      >
        {t('admin.tracks.preview')}
      </Button>
      {preview.isError && (
        <span role="alert" className="text-sm text-red-500">
          {t(`admin.errors.${adminErrorKey(preview.error, 'upload')}`)}
        </span>
      )}
    </div>
  );
}
