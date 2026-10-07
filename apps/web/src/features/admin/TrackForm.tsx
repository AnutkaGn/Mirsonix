import { WaveType, type CreateTrackInput, type Taxonomy } from '@mirsonix/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AssetUploader } from './AssetUploader';
import { Field } from './Field';
import { toggleId, toTrackInput, type FieldError, type TrackFormValues } from './forms';

interface TrackFormProps {
  initial: TrackFormValues;
  taxonomy: Taxonomy;
  submitLabel: string;
  busy: boolean;
  onSubmit: (input: CreateTrackInput) => void;
}

function CheckboxGroup({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10"
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={selected.includes(option.id)}
              onChange={() => onToggle(option.id)}
            />
            {option.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TrackForm({ initial, taxonomy, submitLabel, busy, onSubmit }: TrackFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const set = <K extends keyof TrackFormValues>(key: K, value: TrackFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = toTrackInput(values);
    setErrors(result.ok ? {} : result.errors);
    if (result.ok) onSubmit(result.input);
  }

  const meridians = [
    ...taxonomy.elements.flatMap((element) => element.meridians),
    ...taxonomy.vessels,
  ].map((m) => ({ id: m.id, name: `${m.code} · ${m.name}` }));
  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-5" noValidate>
      <Field label={t('admin.tracks.fields.title')} error={errors.title}>
        {(control) => (
          <Input
            {...control}
            value={values.title}
            maxLength={200}
            onChange={(e) => set('title', e.target.value)}
          />
        )}
      </Field>
      <Field label={t('admin.tracks.fields.description')} error={errors.description}>
        {(control) => (
          <Textarea
            {...control}
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
          />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('admin.tracks.fields.frequency')} error={errors.frequencyHz}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={values.frequencyHz}
              onChange={(e) => set('frequencyHz', e.target.value)}
            />
          )}
        </Field>
        <Field label={t('admin.tracks.fields.wave')}>
          {(control) => (
            <Select
              {...control}
              value={values.waveType}
              onChange={(e) => set('waveType', e.target.value as TrackFormValues['waveType'])}
            >
              <option value="">{t('catalog.filters.any')}</option>
              {WaveType.values.map((wave) => (
                <option key={wave} value={wave}>
                  {t(`waves.${wave}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <CheckboxGroup
        legend={t('admin.tracks.fields.meridians')}
        options={meridians}
        selected={values.meridianIds}
        onToggle={(id) => set('meridianIds', toggleId(values.meridianIds, id))}
      />
      <CheckboxGroup
        legend={t('admin.tracks.fields.issues')}
        options={taxonomy.issues}
        selected={values.issueIds}
        onToggle={(id) => set('issueIds', toggleId(values.issueIds, id))}
      />
      <div className="grid gap-1">
        <AssetUploader
          kind="AUDIO"
          label={t('admin.tracks.fields.audio')}
          assetId={values.audioAssetId}
          onChange={(asset) => set('audioAssetId', asset?.id ?? null)}
        />
        {errors.audioAssetId && (
          <p className="text-xs text-red-500">{t(`admin.form.errors.${errors.audioAssetId}`)}</p>
        )}
      </div>
      <AssetUploader
        kind="IMAGE"
        label={t('admin.tracks.fields.cover')}
        assetId={values.coverAssetId}
        onChange={(asset) => set('coverAssetId', asset?.id ?? null)}
      />
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? t('admin.actions.saving') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
