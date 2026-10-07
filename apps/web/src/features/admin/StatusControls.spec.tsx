import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusControls } from './StatusControls';

afterEach(cleanup);

const setup = (status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED', busy = false) => {
  const onPublish = vi.fn();
  const onArchive = vi.fn();
  render(
    <StatusControls status={status} busy={busy} onPublish={onPublish} onArchive={onArchive} />,
  );
  return { onPublish, onArchive };
};

describe('StatusControls', () => {
  it('offers to publish a draft, and nothing else', () => {
    const { onPublish } = setup('DRAFT');

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(onPublish).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('offers to archive what is published, and nothing else', () => {
    const { onArchive } = setup('PUBLISHED');

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    expect(onArchive).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Publish/ })).not.toBeInTheDocument();
  });

  it('offers to publish an archived item again, never a way back to draft', () => {
    setup('ARCHIVED');

    expect(screen.getByRole('button', { name: 'Publish again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /draft/i })).not.toBeInTheDocument();
  });

  it('is disabled while a change is in flight', () => {
    setup('DRAFT', true);

    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  });
});
