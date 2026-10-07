import type { MediaAsset } from '@mirsonix/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api-client';
import { AssetUploader } from './AssetUploader';
import { InvalidFileError } from './upload';

afterEach(cleanup);

const asset: MediaAsset = {
  id: 'a1',
  kind: 'AUDIO',
  status: 'READY',
  mimeType: 'audio/mpeg',
  sizeBytes: 10,
  durationMs: 125_000,
};
const pick = (label: string) => {
  const file = new File(['x'], 'lung.mp3', { type: 'audio/mpeg' });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
  return file;
};

describe('AssetUploader', () => {
  it('uploads the chosen file, reports the asset, and shows the file name and length', async () => {
    const upload = vi.fn().mockResolvedValue(asset);
    const onChange = vi.fn();
    render(
      <AssetUploader
        kind="AUDIO"
        label="Audio file"
        assetId={null}
        onChange={onChange}
        upload={upload}
      />,
    );

    const file = pick('Audio file');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(asset));
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ kind: 'AUDIO', file }));
  });

  it('shows progress while the file travels', async () => {
    let report: (ratio: number) => void = () => {};
    const upload = vi.fn((input: { onProgress: (r: number) => void }) => {
      report = input.onProgress;
      return new Promise<MediaAsset>(() => {});
    });
    render(
      <AssetUploader
        kind="AUDIO"
        label="Audio file"
        assetId={null}
        onChange={vi.fn()}
        upload={upload}
      />,
    );

    pick('Audio file');
    await waitFor(() => expect(screen.getByRole('progressbar')).toBeInTheDocument());
    report(0.4);

    await waitFor(() => expect(screen.getByText('40%')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Choose file/ })).toBeDisabled();
  });

  it('says why a file was refused, and reports nothing', async () => {
    const onChange = vi.fn();
    render(
      <AssetUploader
        kind="AUDIO"
        label="Audio file"
        assetId={null}
        onChange={onChange}
        upload={vi.fn().mockRejectedValue(new InvalidFileError('type'))}
      />,
    );

    pick('Audio file');

    expect(await screen.findByRole('alert')).toHaveTextContent('This file type is not allowed.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('explains that storage is not configured', async () => {
    const error = new ApiRequestError(503, { statusCode: 503, error: 'x', message: 'x' });
    render(
      <AssetUploader
        kind="IMAGE"
        label="Cover"
        assetId={null}
        onChange={vi.fn()}
        upload={vi.fn().mockRejectedValue(error)}
      />,
    );

    pick('Cover');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'File storage is not configured yet',
    );
  });

  it('offers to replace a file that is already attached', () => {
    render(
      <AssetUploader
        kind="AUDIO"
        label="Audio file"
        assetId="existing"
        onChange={vi.fn()}
        upload={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Replace file' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('File attached');
  });

  it('ignores a cancelled file dialog', () => {
    const upload = vi.fn();
    render(
      <AssetUploader
        kind="AUDIO"
        label="Audio file"
        assetId={null}
        onChange={vi.fn()}
        upload={upload}
      />,
    );

    fireEvent.change(screen.getByLabelText('Audio file'), { target: { files: [] } });

    expect(upload).not.toHaveBeenCalled();
  });
});
