import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  COVER_URL_TTL_SECONDS,
  UPLOAD_LIMITS,
  UPLOAD_URL_TTL_SECONDS,
  type ConfirmUploadInput,
  type CreateUploadInput,
  type MediaAsset as MediaAssetDto,
  type MediaKind,
  type UploadTicket,
} from '@mirsonix/shared';
import { AppConfig } from '../../config/app-config.module';
import { AuditService } from '../audit/audit.service';
import type { MediaAsset } from './entities/media-asset.entity';
import { MediaRepository } from './media.repository';
import { buildObjectKey } from './object-key';
import { StoragePort } from './storage.port';

export const toMediaAssetDto = (asset: MediaAsset): MediaAssetDto => ({
  id: asset.id,
  kind: asset.kind,
  status: asset.status,
  mimeType: asset.mimeType,
  sizeBytes: asset.sizeBytes,
  durationMs: asset.durationMs,
});

@Injectable()
export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: StoragePort,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  /** Step 1 of an upload: register the file and hand the browser a presigned form to send it to S3 directly. */
  async createUpload(adminId: string, input: CreateUploadInput): Promise<UploadTicket> {
    if (!this.storage.isConfigured()) throw new ServiceUnavailableException('Storage is not configured');

    const asset = await this.repository.create({
      kind: input.kind,
      bucket: this.storage.bucket(),
      s3Key: buildObjectKey(input.kind, input.contentType),
      mimeType: input.contentType,
      sizeBytes: input.sizeBytes,
      uploadedById: adminId,
    });
    const upload = await this.storage.createUploadForm({
      key: asset.s3Key,
      contentType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });
    const limits = input.kind === 'AUDIO' ? UPLOAD_LIMITS.audio : UPLOAD_LIMITS.image;
    return { assetId: asset.id, upload, expiresIn: UPLOAD_URL_TTL_SECONDS, maxBytes: limits.maxBytes };
  }

  /**
   * Step 2: after the browser finished uploading, verify what actually landed in storage before trusting it.
   * Idempotent: confirming a ready asset again just returns it.
   */
  async confirmUpload(adminId: string, assetId: string, input: ConfirmUploadInput): Promise<MediaAsset> {
    const asset = await this.repository.findById(assetId);
    if (!asset) throw new NotFoundException('Media asset not found');
    if (asset.status === 'READY') return asset;
    if (asset.status === 'FAILED') throw new ConflictException('This upload failed; start a new one');

    if (asset.kind === 'AUDIO' && !input.durationMs) {
      throw new UnprocessableEntityException('durationMs is required for audio');
    }
    const stored = await this.storage.head(asset.s3Key);
    if (!stored) throw new ConflictException('The file has not been uploaded yet');
    if (stored.sizeBytes !== asset.sizeBytes || stored.contentType !== asset.mimeType) {
      await this.repository.markFailed(asset.id);
      throw new UnprocessableEntityException('The uploaded file does not match what was announced');
    }

    const durationMs = asset.kind === 'AUDIO' ? (input.durationMs ?? null) : null;
    await this.repository.markReady(asset.id, { sizeBytes: stored.sizeBytes, durationMs });
    await this.audit.record({
      adminId,
      action: 'media.confirm',
      entityType: 'media_asset',
      entityId: asset.id,
      metadata: { kind: asset.kind, sizeBytes: stored.sizeBytes },
    });
    return { ...asset, status: 'READY', durationMs };
  }

  /** An asset another entity may reference: it exists, finished uploading, and is of the expected kind. */
  async requireReadyAsset(id: string, kind: MediaKind): Promise<MediaAsset> {
    const asset = await this.repository.findById(id);
    if (!asset) throw new UnprocessableEntityException(`${kind === 'AUDIO' ? 'Audio' : 'Image'} asset ${id} does not exist`);
    if (asset.kind !== kind) throw new UnprocessableEntityException(`Asset ${id} is not ${kind === 'AUDIO' ? 'audio' : 'an image'}`);
    if (asset.status !== 'READY') throw new UnprocessableEntityException(`Asset ${id} has not finished uploading`);
    return asset;
  }

  /**
   * Public URL when covers are served from a public base URL, otherwise a signed one. Null when there is no image,
   * and also when storage is not configured: browsing the catalog must not depend on it, covers just show a placeholder.
   */
  async imageUrl(asset: MediaAsset | null | undefined): Promise<string | null> {
    if (!asset || !this.storage.isConfigured()) return null;
    return this.storage.publicUrl(asset.s3Key) ?? this.storage.createDownloadUrl(asset.s3Key, COVER_URL_TTL_SECONDS);
  }

  imageUrls(assets: (MediaAsset | null | undefined)[]): Promise<(string | null)[]> {
    return Promise.all(assets.map((asset) => this.imageUrl(asset)));
  }

  /** Short-lived signed URL for an audio object. The caller is responsible for the access check. */
  async signedAudioUrl(asset: MediaAsset): Promise<{ url: string; expiresIn: number }> {
    const expiresIn = this.config.get('S3_SIGNED_URL_TTL_SECONDS');
    return { url: await this.storage.createDownloadUrl(asset.s3Key, expiresIn), expiresIn };
  }
}
