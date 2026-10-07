import {
  createProgramSchema,
  createTrackSchema,
  type AdminProgram,
  type AdminTrack,
  type CreateProgramInput,
  type CreateTrackInput,
  type Taxonomy,
  type WaveType,
} from '@mirsonix/shared';

export type FieldError = 'required' | 'invalid';
export type FormResult<T> =
  { ok: true; input: T } | { ok: false; errors: Record<string, FieldError> };

export interface TrackFormValues {
  title: string;
  description: string;
  /** Text, so a half-typed number is not lost while editing. */
  frequencyHz: string;
  waveType: WaveType | '';
  meridianIds: string[];
  issueIds: string[];
  audioAssetId: string | null;
  coverAssetId: string | null;
}

export const EMPTY_TRACK_FORM: TrackFormValues = {
  title: '',
  description: '',
  frequencyHz: '',
  waveType: '',
  meridianIds: [],
  issueIds: [],
  audioAssetId: null,
  coverAssetId: null,
};

const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/** Reports each failing field once: empty is "required", anything else the schema refused is "invalid". */
function collectErrors(
  issues: readonly { path: PropertyKey[] }[],
  values: Record<string, unknown>,
): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '');
    if (field && !(field in errors))
      errors[field] = isBlank(values[field]) ? 'required' : 'invalid';
  }
  return errors;
}

export function toTrackInput(values: TrackFormValues): FormResult<CreateTrackInput> {
  const frequency = values.frequencyHz.trim();
  const candidate = {
    title: values.title,
    description: values.description,
    audioAssetId: values.audioAssetId,
    coverAssetId: values.coverAssetId,
    frequencyHz: frequency === '' ? null : Number(frequency),
    waveType: values.waveType === '' ? null : values.waveType,
    meridianIds: values.meridianIds,
    issueIds: values.issueIds,
  };
  const parsed = createTrackSchema.safeParse(candidate);
  return parsed.success
    ? { ok: true, input: parsed.data }
    : {
        ok: false,
        errors: collectErrors(parsed.error.issues, { ...candidate, frequencyHz: frequency }),
      };
}

/** An existing track as form values. The API reports meridians by code and issues by slug; the form works in ids. */
export function trackToForm(track: AdminTrack, taxonomy: Taxonomy): TrackFormValues {
  const meridianIdByCode = new Map(
    [...taxonomy.elements.flatMap((element) => element.meridians), ...taxonomy.vessels].map((m) => [
      m.code,
      m.id,
    ]),
  );
  const issueIdBySlug = new Map(taxonomy.issues.map((issue) => [issue.slug, issue.id]));
  return {
    title: track.title,
    description: track.description,
    frequencyHz: track.frequencyHz === null ? '' : String(track.frequencyHz),
    waveType: track.waveType ?? '',
    meridianIds: track.meridians.flatMap((m) => meridianIdByCode.get(m.code) ?? []),
    issueIds: track.issues.flatMap((i) => issueIdBySlug.get(i.slug) ?? []),
    audioAssetId: track.audioAssetId,
    coverAssetId: track.coverAssetId,
  };
}

export interface ProgramFormValues {
  title: string;
  description: string;
  posterAssetId: string | null;
}

export const EMPTY_PROGRAM_FORM: ProgramFormValues = {
  title: '',
  description: '',
  posterAssetId: null,
};

export const programToForm = (
  program: Pick<AdminProgram, 'title' | 'description' | 'posterAssetId'>,
): ProgramFormValues => ({
  title: program.title,
  description: program.description,
  posterAssetId: program.posterAssetId,
});

export function toProgramInput(values: ProgramFormValues): FormResult<CreateProgramInput> {
  const parsed = createProgramSchema.safeParse(values);
  return parsed.success
    ? { ok: true, input: parsed.data }
    : { ok: false, errors: collectErrors(parsed.error.issues, { ...values }) };
}

/** Adds or removes one id, keeping the rest in order. */
export const toggleId = (ids: readonly string[], id: string): string[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
