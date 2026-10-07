import type { CreateProgramInput } from '@mirsonix/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AssetUploader } from './AssetUploader';
import { Field } from './Field';
import { toProgramInput, type FieldError, type ProgramFormValues } from './forms';

interface ProgramFormProps {
  initial: ProgramFormValues;
  submitLabel: string;
  busy: boolean;
  onSubmit: (input: CreateProgramInput) => void;
}

export function ProgramForm({ initial, submitLabel, busy, onSubmit }: ProgramFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = toProgramInput(values);
    setErrors(result.ok ? {} : result.errors);
    if (result.ok) onSubmit(result.input);
  }

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-5" noValidate>
      <Field label={t('admin.programs.fields.title')} error={errors.title}>
        {(control) => (
          <Input
            {...control}
            value={values.title}
            maxLength={200}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
          />
        )}
      </Field>
      <Field label={t('admin.programs.fields.description')} error={errors.description}>
        {(control) => (
          <Textarea
            {...control}
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
          />
        )}
      </Field>
      <AssetUploader
        kind="IMAGE"
        label={t('admin.programs.fields.poster')}
        assetId={values.posterAssetId}
        onChange={(asset) => setValues({ ...values, posterAssetId: asset?.id ?? null })}
      />
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? t('admin.actions.saving') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
