import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { adminErrorKey, serverMessage } from '@/features/admin/errors';
import { EMPTY_PROGRAM_FORM, programToForm } from '@/features/admin/forms';
import {
  useAdminProgram,
  useArchiveProgram,
  useCreateProgram,
  usePublishProgram,
  useSetProgramPrices,
  useSetProgramTracks,
  useUpdateProgram,
} from '@/features/admin/hooks';
import { PriceEditor } from '@/features/admin/PriceEditor';
import { ProgramBuilder } from '@/features/admin/ProgramBuilder';
import { ProgramForm } from '@/features/admin/ProgramForm';
import { StatusControls } from '@/features/admin/StatusControls';

export function AdminProgramEditPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const program = useAdminProgram(id);
  const create = useCreateProgram();
  const update = useUpdateProgram(id ?? '');
  const setTracks = useSetProgramTracks(id ?? '');
  const publish = usePublishProgram();
  const archive = useArchiveProgram();
  const setPrices = useSetProgramPrices(id ?? '');

  if (program.isError)
    return <ErrorState message={t('admin.loadError')} onRetry={() => void program.refetch()} />;
  if (id && !program.data) return <Skeleton className="h-96" />;

  const failure = [create, update, publish, archive].find((mutation) => mutation.isError)?.error;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {program.data ? program.data.title : t('admin.programs.new')}
        </h1>
        {program.data && (
          <StatusControls
            status={program.data.status}
            busy={publish.isPending || archive.isPending}
            onPublish={() => publish.mutate(program.data.id)}
            onArchive={() => archive.mutate(program.data.id)}
          />
        )}
      </div>

      {failure !== undefined && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
          {serverMessage(failure) ?? t(`admin.errors.${adminErrorKey(failure)}`)}
        </p>
      )}

      <ProgramForm
        key={program.data?.updatedAt ?? 'new'}
        initial={program.data ? programToForm(program.data) : EMPTY_PROGRAM_FORM}
        submitLabel={program.data ? t('admin.actions.save') : t('admin.actions.create')}
        busy={create.isPending || update.isPending}
        onSubmit={(input) =>
          program.data
            ? update.mutate(input)
            : create.mutate(input, {
                onSuccess: (created) =>
                  navigate(`/admin/programs/${created.id}`, { replace: true }),
              })
        }
      />

      {program.data && (
        <>
          <ProgramBuilder
            key={program.data.updatedAt}
            saved={program.data.tracks}
            busy={setTracks.isPending}
            onSave={setTracks.mutateAsync}
          />
          <PriceEditor prices={program.data.prices} onSave={setPrices.mutateAsync} />
        </>
      )}
    </div>
  );
}
