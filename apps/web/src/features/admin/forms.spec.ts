import type { AdminTrack, Taxonomy } from '@mirsonix/shared';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROGRAM_FORM,
  EMPTY_TRACK_FORM,
  programToForm,
  toProgramInput,
  toggleId,
  toTrackInput,
  trackToForm,
  type TrackFormValues,
} from './forms';

const AUDIO = '11111111-1111-4111-8111-111111111111';
const COVER = '22222222-2222-4222-8222-222222222222';
const LU = '33333333-3333-4333-8333-333333333333';
const GV = '44444444-4444-4444-8444-444444444444';
const SLEEP = '55555555-5555-4555-8555-555555555555';

const valid: TrackFormValues = {
  ...EMPTY_TRACK_FORM,
  title: ' Lung opening ',
  description: 'Slow breathing.',
  audioAssetId: AUDIO,
};

describe('toTrackInput', () => {
  it('turns blank optional fields into nulls and trims text', () => {
    const result = toTrackInput(valid);

    expect(result).toEqual({
      ok: true,
      input: {
        title: 'Lung opening',
        description: 'Slow breathing.',
        audioAssetId: AUDIO,
        coverAssetId: null,
        frequencyHz: null,
        waveType: null,
        meridianIds: [],
        issueIds: [],
      },
    });
  });

  it('reads the frequency and wave type', () => {
    const result = toTrackInput({
      ...valid,
      frequencyHz: '432.5',
      waveType: 'SINE',
      coverAssetId: COVER,
    });

    expect(result).toMatchObject({
      ok: true,
      input: { frequencyHz: 432.5, waveType: 'SINE', coverAssetId: COVER },
    });
  });

  it('calls empty fields required, including a missing audio upload', () => {
    const result = toTrackInput(EMPTY_TRACK_FORM);

    expect(result).toEqual({
      ok: false,
      errors: { title: 'required', description: 'required', audioAssetId: 'required' },
    });
  });

  it('calls a present but unusable value invalid', () => {
    expect(toTrackInput({ ...valid, frequencyHz: 'abc' })).toEqual({
      ok: false,
      errors: { frequencyHz: 'invalid' },
    });
    expect(toTrackInput({ ...valid, frequencyHz: '-5' })).toEqual({
      ok: false,
      errors: { frequencyHz: 'invalid' },
    });
    expect(toTrackInput({ ...valid, title: 'x'.repeat(201) })).toEqual({
      ok: false,
      errors: { title: 'invalid' },
    });
  });
});

describe('trackToForm', () => {
  const taxonomy: Taxonomy = {
    elements: [
      {
        code: 'METAL',
        name: 'Metal',
        meridians: [{ id: LU, code: 'LU', name: 'Lung', polarity: 'YIN' }],
      },
    ],
    vessels: [{ id: GV, code: 'GV', name: 'Governing', polarity: 'YANG' }],
    issues: [{ id: SLEEP, slug: 'sleep', name: 'Sleep' }],
  };
  const track = {
    title: 'T',
    description: 'D',
    frequencyHz: 432,
    waveType: 'SINE',
    audioAssetId: AUDIO,
    coverAssetId: null,
    meridians: [
      { code: 'LU', name: 'Lung' },
      { code: 'GV', name: 'Governing' },
      { code: 'XX', name: 'Gone' },
    ],
    issues: [{ slug: 'sleep', name: 'Sleep' }],
  } as unknown as AdminTrack;

  it('maps codes and slugs back to ids, including vessels, and skips ones no longer in the taxonomy', () => {
    expect(trackToForm(track, taxonomy)).toEqual({
      title: 'T',
      description: 'D',
      frequencyHz: '432',
      waveType: 'SINE',
      meridianIds: [LU, GV],
      issueIds: [SLEEP],
      audioAssetId: AUDIO,
      coverAssetId: null,
    });
  });

  it('shows missing optional values as empty', () => {
    expect(
      trackToForm({ ...track, frequencyHz: null, waveType: null } as AdminTrack, taxonomy),
    ).toMatchObject({ frequencyHz: '', waveType: '' });
  });
});

describe('program forms', () => {
  it('accepts a title and description without a poster', () => {
    expect(
      toProgramInput({ ...EMPTY_PROGRAM_FORM, title: 'Back', description: 'Seven days' }),
    ).toMatchObject({ ok: true, input: { title: 'Back', posterAssetId: null } });
  });

  it('requires a title and a description', () => {
    expect(toProgramInput(EMPTY_PROGRAM_FORM)).toEqual({
      ok: false,
      errors: { title: 'required', description: 'required' },
    });
  });

  it('round-trips an existing program', () => {
    expect(programToForm({ title: 'A', description: 'B', posterAssetId: COVER })).toEqual({
      title: 'A',
      description: 'B',
      posterAssetId: COVER,
    });
  });
});

describe('toggleId', () => {
  it('adds and removes', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  });
});
