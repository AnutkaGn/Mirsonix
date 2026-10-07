import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COVER_ID } from '@/test/fixtures';
import { EMPTY_PROGRAM_FORM } from './forms';
import { ProgramForm } from './ProgramForm';

afterEach(cleanup);

const setup = (initial = EMPTY_PROGRAM_FORM) => {
  const onSubmit = vi.fn();
  render(<ProgramForm initial={initial} submitLabel="Create" busy={false} onSubmit={onSubmit} />);
  return onSubmit;
};

describe('ProgramForm', () => {
  it('needs a title and a description', () => {
    const onSubmit = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Description')).toHaveAttribute('aria-invalid', 'true');
  });

  it('submits what was typed, with the poster it already has', () => {
    const onSubmit = setup({ ...EMPTY_PROGRAM_FORM, posterAssetId: COVER_ID });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' Back recovery ' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Seven days.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Back recovery',
      description: 'Seven days.',
      posterAssetId: COVER_ID,
    });
  });

  it('is disabled while saving', () => {
    render(
      <ProgramForm initial={EMPTY_PROGRAM_FORM} submitLabel="Create" busy onSubmit={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });
});
