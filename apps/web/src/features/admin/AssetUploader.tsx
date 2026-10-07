import type { MediaAsset, MediaKind } from '@mirsonix/shared';
import { CheckCircle2, Loader2, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/format';
import { adminApi } from './api';
import { adminErrorKey } from './errors';
import { acceptedTypes } from './upload';

type Upload = (input: {
  kind: MediaKind;
  file: File;
  onProgress: (ratio: number) => void;
}) => Promise<MediaAsset>;

interface AssetUploaderProps {
  kind: MediaKind;
  label: string;
  /** The asset already attached (an existing track's audio, say), or null. */
  assetId: string | null;
  onChange: (asset: MediaAsset | null) => void;
  /** Replaceable in tests; the real one goes browser → S3. */
  upload?: Upload;
  id?: string;
}

type Phase =
  | { name: 'idle' }
  | { name: 'uploading'; ratio: number; file: string }
  | { name: 'failed'; key: ReturnType<typeof adminErrorKey> };

export function AssetUploader({
  kind,
  label,
  assetId,
  onChange,
  upload = adminApi.uploadFile,
  id,
}: AssetUploaderProps) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [uploaded, setUploaded] = useState<{ name: string; durationMs: number | null } | null>(
    null,
  );

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // so choosing the same file again still fires
    if (!file) return;
    setPhase({ name: 'uploading', ratio: 0, file: file.name });
    try {
      const asset = await upload({
        kind,
        file,
        onProgress: (ratio) => setPhase({ name: 'uploading', ratio, file: file.name }),
      });
      setUploaded({ name: file.name, durationMs: asset.durationMs });
      setPhase({ name: 'idle' });
      onChange(asset);
    } catch (error) {
      setPhase({ name: 'failed', key: adminErrorKey(error, 'upload') });
    }
  }

  const uploading = phase.name === 'uploading';
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium" id={id ? `${id}-label` : undefined}>
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
        <input
          ref={input}
          id={id}
          type="file"
          accept={acceptedTypes(kind)}
          className="sr-only"
          onChange={onFile}
          disabled={uploading}
          aria-label={label}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="mr-2 size-4" aria-hidden />
          )}
          {assetId ? t('admin.upload.replace') : t('admin.upload.choose')}
        </Button>
        {uploading && (
          <div className="flex min-w-40 flex-1 items-center gap-2 text-xs text-muted-foreground">
            <progress
              className="h-1.5 flex-1"
              max={1}
              value={phase.ratio}
              aria-label={t('admin.upload.progress', { file: phase.file })}
            />
            <span>{Math.round(phase.ratio * 100)}%</span>
          </div>
        )}
        {!uploading && assetId && (
          <span role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-green-500" aria-hidden />
            {uploaded ? uploaded.name : t('admin.upload.attached')}
            {uploaded?.durationMs ? ` · ${formatDuration(uploaded.durationMs / 1000)}` : ''}
          </span>
        )}
      </div>
      {phase.name === 'failed' && (
        <p role="alert" className="text-xs text-red-500">
          {t(`admin.errors.${phase.key}`)}
        </p>
      )}
    </div>
  );
}
