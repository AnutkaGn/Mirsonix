import { ConflictException, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../config/app-config.module';
import type { AuditService } from '../audit/audit.service';
import type { MediaAsset } from './entities/media-asset.entity';
import type { MediaRepository } from './media.repository';
import { MediaService, toMediaAssetDto } from './media.service';
import type { StoragePort } from './storage.port';

const asset = (overrides: Partial<MediaAsset> = {}): MediaAsset =>
  ({
    id: 'asset-1',
    kind: 'AUDIO',
    bucket: 'b',
    s3Key: 'audio/a.mp3',
    mimeType: 'audio/mpeg',
    sizeBytes: 1000,
    durationMs: null,
    status: 'PENDING',
    ...overrides,
  }) as MediaAsset;

describe('MediaService', () => {
  const repository = { create: vi.fn(), findById: vi.fn(), markReady: vi.fn(), markFailed: vi.fn() };
  const storage = {
    isConfigured: vi.fn(),
    bucket: vi.fn(),
    createUploadForm: vi.fn(),
    head: vi.fn(),
    createDownloadUrl: vi.fn(),
    publicUrl: vi.fn(),
  };
  const audit = { record: vi.fn() };
  const config = { get: vi.fn(() => 600) };
  let service: MediaService;

  beforeEach(() => {
    vi.resetAllMocks();
    config.get.mockReturnValue(600);
    storage.isConfigured.mockReturnValue(true);
    storage.bucket.mockReturnValue('b');
    service = new MediaService(
      repository as unknown as MediaRepository,
      storage as unknown as StoragePort,
      audit as unknown as AuditService,
      config as unknown as AppConfig,
    );
  });

  describe('createUpload', () => {
    const input = { kind: 'AUDIO', contentType: 'audio/mpeg', sizeBytes: 1000 } as const;

    it('registers a pending asset and returns the presigned form', async () => {
      repository.create.mockResolvedValue(asset());
      storage.createUploadForm.mockResolvedValue({ url: 'https://s3', fields: { key: 'audio/a.mp3' } });

      const ticket = await service.createUpload('admin-1', input);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'AUDIO', bucket: 'b', mimeType: 'audio/mpeg', sizeBytes: 1000, uploadedById: 'admin-1' }),
      );
      expect(repository.create.mock.calls[0]![0].s3Key).toMatch(/^audio\//);
      expect(ticket).toMatchObject({ assetId: 'asset-1', upload: { url: 'https://s3' }, expiresIn: 900 });
      expect(storage.createUploadForm).toHaveBeenCalledWith(expect.objectContaining({ sizeBytes: 1000, contentType: 'audio/mpeg' }));
    });

    it('is unavailable, and creates nothing, while storage is not configured', async () => {
      storage.isConfigured.mockReturnValue(false);

      await expect(service.createUpload('admin-1', input)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('confirmUpload', () => {
    it('marks the asset ready once the stored object matches, and records it', async () => {
      repository.findById.mockResolvedValue(asset());
      storage.head.mockResolvedValue({ sizeBytes: 1000, contentType: 'audio/mpeg' });

      const result = await service.confirmUpload('admin-1', 'asset-1', { durationMs: 61_000 });

      expect(repository.markReady).toHaveBeenCalledWith('asset-1', { sizeBytes: 1000, durationMs: 61_000 });
      expect(result).toMatchObject({ status: 'READY', durationMs: 61_000 });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'media.confirm', entityId: 'asset-1' }));
    });

    it('ignores a duration for an image', async () => {
      repository.findById.mockResolvedValue(asset({ kind: 'IMAGE', mimeType: 'image/png', s3Key: 'covers/a.png' }));
      storage.head.mockResolvedValue({ sizeBytes: 1000, contentType: 'image/png' });

      const result = await service.confirmUpload('admin-1', 'asset-1', { durationMs: 5000 });

      expect(result.durationMs).toBeNull();
    });

    it('is idempotent for an asset that is already ready', async () => {
      repository.findById.mockResolvedValue(asset({ status: 'READY', durationMs: 5000 }));

      await expect(service.confirmUpload('admin-1', 'asset-1', {})).resolves.toMatchObject({ status: 'READY' });
      expect(storage.head).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('is a 404 for an unknown asset', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.confirmUpload('admin-1', 'x', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to revive a failed upload', async () => {
      repository.findById.mockResolvedValue(asset({ status: 'FAILED' }));

      await expect(service.confirmUpload('admin-1', 'asset-1', { durationMs: 1000 })).rejects.toBeInstanceOf(ConflictException);
    });

    it('needs a duration for audio', async () => {
      repository.findById.mockResolvedValue(asset());

      await expect(service.confirmUpload('admin-1', 'asset-1', {})).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(storage.head).not.toHaveBeenCalled();
    });

    it('tells the admin when nothing has been uploaded yet, without failing the asset', async () => {
      repository.findById.mockResolvedValue(asset());
      storage.head.mockResolvedValue(null);

      await expect(service.confirmUpload('admin-1', 'asset-1', { durationMs: 1000 })).rejects.toBeInstanceOf(ConflictException);
      expect(repository.markFailed).not.toHaveBeenCalled();
    });

    it.each([
      ['a different size', { sizeBytes: 999, contentType: 'audio/mpeg' }],
      ['a different content type', { sizeBytes: 1000, contentType: 'application/zip' }],
    ])('fails the asset when storage holds %s', async (_label, stored) => {
      repository.findById.mockResolvedValue(asset());
      storage.head.mockResolvedValue(stored);

      await expect(service.confirmUpload('admin-1', 'asset-1', { durationMs: 1000 })).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(repository.markFailed).toHaveBeenCalledWith('asset-1');
      expect(repository.markReady).not.toHaveBeenCalled();
    });
  });

  describe('requireReadyAsset', () => {
    it('returns an asset that is ready and of the right kind', async () => {
      repository.findById.mockResolvedValue(asset({ status: 'READY' }));

      await expect(service.requireReadyAsset('asset-1', 'AUDIO')).resolves.toMatchObject({ id: 'asset-1' });
    });

    it.each([
      ['is missing', null],
      ['is of the wrong kind', asset({ status: 'READY', kind: 'IMAGE' })],
      ['is still pending', asset({ status: 'PENDING' })],
      ['has failed', asset({ status: 'FAILED' })],
    ])('rejects an asset that %s', async (_label, found) => {
      repository.findById.mockResolvedValue(found);

      await expect(service.requireReadyAsset('asset-1', 'AUDIO')).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('image URLs', () => {
    const cover = asset({ kind: 'IMAGE', s3Key: 'covers/a.png' });

    it('prefers the public URL and does not sign anything', async () => {
      storage.publicUrl.mockReturnValue('https://cdn/covers/a.png');

      await expect(service.imageUrl(cover)).resolves.toBe('https://cdn/covers/a.png');
      expect(storage.createDownloadUrl).not.toHaveBeenCalled();
    });

    it('falls back to a signed URL when there is no public base URL', async () => {
      storage.publicUrl.mockReturnValue(null);
      storage.createDownloadUrl.mockResolvedValue('https://s3/signed');

      await expect(service.imageUrl(cover)).resolves.toBe('https://s3/signed');
      expect(storage.createDownloadUrl).toHaveBeenCalledWith('covers/a.png', 3600);
    });

    it('is null when there is no image', async () => {
      await expect(service.imageUrl(null)).resolves.toBeNull();
      await expect(service.imageUrls([cover, undefined])).resolves.toHaveLength(2);
    });
  });

  describe('signedAudioUrl', () => {
    it('signs the object for the configured lifetime', async () => {
      storage.createDownloadUrl.mockResolvedValue('https://s3/audio');

      await expect(service.signedAudioUrl(asset())).resolves.toEqual({ url: 'https://s3/audio', expiresIn: 600 });
      expect(storage.createDownloadUrl).toHaveBeenCalledWith('audio/a.mp3', 600);
    });
  });

  it('exposes no storage details in the asset DTO', () => {
    expect(Object.keys(toMediaAssetDto(asset()))).toEqual(['id', 'kind', 'status', 'mimeType', 'sizeBytes', 'durationMs']);
  });
});
