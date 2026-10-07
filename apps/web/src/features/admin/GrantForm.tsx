import {
  AccessGrantSource,
  createAccessGrantSchema,
  type CreateAccessGrantInput,
} from '@mirsonix/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Field } from './Field';
import { useAdminPrograms, useAdminTracks } from './hooks';
import type { FieldError } from './forms';

type Kind = 'trackId' | 'programId';

/** The one grant an admin gives by hand: one person, one item, optionally until a date. */
export function GrantForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (input: CreateAccessGrantInput) => void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState<Kind>('trackId');
  const [targetId, setTargetId] = useState('');
  const [source, setSource] = useState<AccessGrantSource>('ADMIN');
  const [expires, setExpires] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, FieldError>>({});

  const tracks = useAdminTracks({ limit: 100, status: 'PUBLISHED' });
  const programs = useAdminPrograms({ limit: 100, status: 'PUBLISHED' });
  const options = (kind === 'trackId' ? tracks.data?.items : programs.data?.items) ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = createAccessGrantSchema.safeParse({
      userEmail: email,
      [kind]: targetId || undefined,
      source,
      // The date input is a day; the grant runs to the end of it, in the admin's timezone.
      expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : undefined,
      note: note || undefined,
    });
    if (parsed.success) {
      setErrors({});
      onSubmit(parsed.data);
      return;
    }
    const failed: Record<string, FieldError> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      failed[field === 'trackId' || field === 'programId' ? 'target' : field] =
        field === 'userEmail' && email.trim() === '' ? 'required' : 'invalid';
    }
    setErrors(failed);
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid max-w-2xl gap-4 rounded-lg border bg-card p-4"
      aria-label={t('admin.grants.new')}
    >
      <Field label={t('admin.grants.email')} error={errors.userEmail}>
        {(control) => (
          <Input
            {...control}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.grants.kind')}>
          {(control) => (
            <Select
              {...control}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind);
                setTargetId('');
              }}
            >
              <option value="trackId">{t('admin.grants.track')}</option>
              <option value="programId">{t('admin.grants.program')}</option>
            </Select>
          )}
        </Field>
        <Field
          label={t('admin.grants.item')}
          error={errors.target ?? (errors.trackId || errors.programId)}
        >
          {(control) => (
            <Select {...control} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">{t('admin.grants.choose')}</option>
              {options.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.grants.source')}>
          {(control) => (
            <Select
              {...control}
              value={source}
              onChange={(e) => setSource(e.target.value as AccessGrantSource)}
            >
              {AccessGrantSource.values.map((value) => (
                <option key={value} value={value}>
                  {t(`admin.grants.sources.${value}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={t('admin.grants.expires')}
          hint={t('admin.grants.expiresHint')}
          error={errors.expiresAt}
        >
          {(control) => (
            <Input
              {...control}
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          )}
        </Field>
      </div>
      <Field label={t('admin.grants.note')} error={errors.note}>
        {(control) => (
          <Textarea
            {...control}
            className="min-h-16"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </Field>
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? t('admin.actions.saving') : t('admin.grants.give')}
        </Button>
      </div>
    </form>
  );
}
