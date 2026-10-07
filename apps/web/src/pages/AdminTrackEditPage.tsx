import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { AudioPreview } from '@/features/admin/AudioPreview';
import { adminErrorKey, serverMessage } from '@/features/admin/errors';
import { EMPTY_TRACK_FORM, trackToForm } from '@/features/admin/forms';
import {
  useAdminTrack,
  useArchiveTrack,
  useCreateTrack,
  usePublishTrack,
  useSetTrackPrices,
  useUpdateTrack,
} from '@/features/admin/hooks';
import { PriceEditor } from '@/features/admin/PriceEditor';
import { StatusControls } from '@/features/admin/StatusControls';
import { TrackForm } from '@/features/admin/TrackForm';
import { useTaxonomy } from '@/features/catalog/hooks';

export function AdminTrackEditPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const taxonomy = useTaxonomy();
  const track = useAdminTrack(id);
  const create = useCreateTrack();
  const update = useUpdateTrack(id ?? '');
  const publish = usePublishTrack();
  const archive = useArchiveTrack();
  const setPrices = useSetTrackPrices(id ?? '');

  if (taxonomy.isError || track.isError)
    return (
      <ErrorState
        message={t('admin.loadError')}
        onRetry={() => void (track.isError ? track.refetch() : taxonomy.refetch())}
      />
    );
  if (!taxonomy.data || (id && !track.data)) return <Skeleton className="h-96" />;

  const failure = [create, update, publish, archive].find((mutation) => mutation.isError)?.error;
  const lifecycle = { busy: publish.isPending || archive.isPending };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {track.data ? track.data.title : t('admin.tracks.new')}
        </h1>
        {track.data && (
          <StatusControls
            status={track.data.status}
            busy={lifecycle.busy}
            onPublish={() => publish.mutate(track.data.id)}
            onArchive={() => archive.mutate(track.data.id)}
          />
        )}
      </div>

      {failure !== undefined && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
          {serverMessage(failure) ?? t(`admin.errors.${adminErrorKey(failure)}`)}
        </p>
      )}

      {track.data && <AudioPreview trackId={track.data.id} />}

      <TrackForm
        key={track.data?.updatedAt ?? 'new'}
        initial={track.data ? trackToForm(track.data, taxonomy.data) : EMPTY_TRACK_FORM}
        taxonomy={taxonomy.data}
        submitLabel={track.data ? t('admin.actions.save') : t('admin.actions.create')}
        busy={create.isPending || update.isPending}
        onSubmit={(input) =>
          track.data
            ? update.mutate(input)
            : create.mutate(input, {
                onSuccess: (created) => navigate(`/admin/tracks/${created.id}`, { replace: true }),
              })
        }
      />

      {track.data && <PriceEditor prices={track.data.prices} onSave={setPrices.mutateAsync} />}
    </div>
  );
}
