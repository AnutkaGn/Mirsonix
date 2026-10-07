import type { AdminTrack } from '@mirsonix/shared';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTaxonomy } from '@/features/catalog/hooks';
import { formatDuration } from '@/lib/format';
import { adminErrorKey, serverMessage } from './errors';
import { EMPTY_TRACK_FORM } from './forms';
import { useAdminTracks, useCreateTrack } from './hooks';
import { appendUnique, moveItem, removeItem, sameOrder } from './program-order';
import { StatusBadge } from './StatusControls';
import { TrackForm } from './TrackForm';

interface ProgramBuilderProps {
  /** The tracks as saved, in order. */
  saved: AdminTrack[];
  busy: boolean;
  onSave: (trackIds: string[]) => Promise<unknown>;
}

/**
 * Edits the program's ordered track list locally and saves it in one request, because the API takes the full list.
 * Tracks come from the existing library, or are uploaded on the spot.
 */
export function ProgramBuilder({ saved, busy, onSave }: ProgramBuilderProps) {
  const { t } = useTranslation();
  const [known, setKnown] = useState<Record<string, AdminTrack>>(() =>
    Object.fromEntries(saved.map((track) => [track.id, track])),
  );
  const [ids, setIds] = useState(() => saved.map((track) => track.id));
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taxonomy = useTaxonomy();
  const createTrack = useCreateTrack();
  const candidates = useAdminTracks({ q: search.trim() || undefined, limit: 8 });

  const remember = (track: AdminTrack) =>
    setKnown((current) => ({ ...current, [track.id]: track }));
  const add = (track: AdminTrack) => {
    remember(track);
    setIds((current) => appendUnique(current, track.id));
  };

  async function save() {
    setError(null);
    try {
      await onSave(ids);
    } catch (failure) {
      setError(serverMessage(failure) ?? t(`admin.errors.${adminErrorKey(failure)}`));
    }
  }

  const dirty = !sameOrder(
    ids,
    saved.map((track) => track.id),
  );
  const available = (candidates.data?.items ?? []).filter(
    (track) => !ids.includes(track.id) && track.status !== 'ARCHIVED',
  );

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4" aria-labelledby="builder-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="builder-title" className="font-medium">
          {t('admin.programs.builder.title')}
        </h2>
        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 size-4" aria-hidden />
          {t('admin.programs.builder.uploadNew')}
        </Button>
      </div>

      {ids.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.programs.builder.empty')}</p>
      ) : (
        <ol className="grid gap-2">
          {ids.map((id, index) => {
            const track = known[id];
            return (
              <li key={id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <span className="w-6 text-sm text-muted-foreground">{index + 1}</span>
                <span className="flex-1 truncate text-sm font-medium">{track?.title ?? id}</span>
                {track && <StatusBadge status={track.status} />}
                {track && (
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(track.durationSec)}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('admin.actions.moveUp', { title: track?.title })}
                  disabled={index === 0}
                  onClick={() => setIds(moveItem(ids, index, -1))}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('admin.actions.moveDown', { title: track?.title })}
                  disabled={index === ids.length - 1}
                  onClick={() => setIds(moveItem(ids, index, 1))}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('admin.actions.remove', { title: track?.title })}
                  onClick={() => setIds(removeItem(ids, index))}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="grid gap-2">
        <Input
          type="search"
          aria-label={t('admin.programs.builder.search')}
          placeholder={t('admin.programs.builder.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ul className="grid gap-1.5" aria-label={t('admin.programs.builder.available')}>
          {available.map((track) => (
            <li key={track.id} className="flex items-center gap-3 text-sm">
              <span className="flex-1 truncate">{track.title}</span>
              <StatusBadge status={track.status} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={t('admin.actions.addTrack', { title: track.title })}
                onClick={() => add(track)}
              >
                {t('admin.actions.add')}
              </Button>
            </li>
          ))}
          {candidates.isSuccess && available.length === 0 && (
            <li className="text-sm text-muted-foreground">
              {t('admin.programs.builder.noMatches')}
            </li>
          )}
        </ul>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={busy || !dirty} onClick={save}>
          {busy ? t('admin.actions.saving') : t('admin.programs.builder.save')}
        </Button>
        {error && (
          <span role="alert" className="text-sm text-red-500">
            {error}
          </span>
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogTitle>{t('admin.programs.builder.uploadNew')}</DialogTitle>
          <DialogDescription>{t('admin.programs.builder.uploadNewHint')}</DialogDescription>
          <div className="mt-4">
            {taxonomy.data && (
              <TrackForm
                initial={EMPTY_TRACK_FORM}
                taxonomy={taxonomy.data}
                submitLabel={t('admin.programs.builder.createAndAdd')}
                busy={createTrack.isPending}
                onSubmit={(input) =>
                  createTrack.mutate(input, {
                    onSuccess: (track) => {
                      add(track);
                      setCreating(false);
                    },
                  })
                }
              />
            )}
            {createTrack.isError && (
              <p role="alert" className="mt-3 text-sm text-red-500">
                {serverMessage(createTrack.error) ??
                  t(`admin.errors.${adminErrorKey(createTrack.error)}`)}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
