import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_ID, makeTaxonomy } from '@/test/fixtures';
import { EMPTY_TRACK_FORM } from './forms';
import { TrackForm } from './TrackForm';

afterEach(cleanup);

const LUNG = makeTaxonomy().elements[1]!.meridians[0]!.id;
const SLEEP = makeTaxonomy().issues[0]!.id;

const setup = (initial = EMPTY_TRACK_FORM) => {
  const onSubmit = vi.fn();
  render(
    <TrackForm
      initial={initial}
      taxonomy={makeTaxonomy()}
      submitLabel="Create"
      busy={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
};

describe('TrackForm', () => {
  it('shows what is missing next to each field and does not submit', () => {
    const onSubmit = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Description')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText('This field is required.').length).toBeGreaterThanOrEqual(3); // title, description, audio
  });

  it('submits the typed values with the chosen meridians and issues as ids', () => {
    const onSubmit = setup({ ...EMPTY_TRACK_FORM, audioAssetId: AUDIO_ID });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Lung opening' } });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Slow breathing.' },
    });
    fireEvent.change(screen.getByLabelText('Frequency (Hz)'), { target: { value: '432' } });
    fireEvent.change(screen.getByLabelText('Wave type'), { target: { value: 'SINE' } });
    fireEvent.click(screen.getByLabelText('LU · Lung'));
    fireEvent.click(screen.getByLabelText('Sleep'));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Lung opening',
        frequencyHz: 432,
        waveType: 'SINE',
        meridianIds: [LUNG],
        issueIds: [SLEEP],
        audioAssetId: AUDIO_ID,
      }),
    );
  });

  it('lets a chosen meridian be unchosen', () => {
    const onSubmit = setup({
      ...EMPTY_TRACK_FORM,
      title: 'T',
      description: 'D',
      audioAssetId: AUDIO_ID,
    });

    fireEvent.click(screen.getByLabelText('LU · Lung'));
    fireEvent.click(screen.getByLabelText('LU · Lung'));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ meridianIds: [] }));
  });

  it('rejects a frequency that is not a positive number', () => {
    const onSubmit = setup({
      ...EMPTY_TRACK_FORM,
      title: 'T',
      description: 'D',
      audioAssetId: AUDIO_ID,
    });

    fireEvent.change(screen.getByLabelText('Frequency (Hz)'), { target: { value: 'loud' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('This value is not valid.')).toBeInTheDocument();
  });
});
