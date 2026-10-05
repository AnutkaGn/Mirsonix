import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.module';
import { isCoverKey } from './object-key';
import { StoragePort, type StoredObject, type UploadForm, type UploadFormRequest } from './storage.port';

@Injectable()
export class S3StorageService extends StoragePort {
  private client: S3Client | null = null;

  constructor(private readonly config: AppConfig) {
    super();
  }

  isConfigured(): boolean {
    return Boolean(this.config.get('S3_BUCKET'));
  }

  bucket(): string {
    const bucket = this.config.get('S3_BUCKET');
    if (!bucket) throw new ServiceUnavailableException('Storage is not configured');
    return bucket;
  }

  async createUploadForm({ key, contentType, sizeBytes, expiresInSeconds }: UploadFormRequest): Promise<UploadForm> {
    const { url, fields } = await createPresignedPost(this.getClient(), {
      Bucket: this.bucket(),
      Key: key,
      Expires: expiresInSeconds,
      Conditions: [
        ['content-length-range', sizeBytes, sizeBytes], // exactly the announced size
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
    });
    return { url, fields };
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.getClient().send(new HeadObjectCommand({ Bucket: this.bucket(), Key: key }));
      return { sizeBytes: result.ContentLength ?? 0, contentType: result.ContentType ?? '' };
    } catch (error) {
      return interpretHeadError(error);
    }
  }

  async createDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.getClient(), new GetObjectCommand({ Bucket: this.bucket(), Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  publicUrl(key: string): string | null {
    const base = this.config.get('S3_PUBLIC_BASE_URL');
    // Only the cover prefix may ever be public; an audio key must never resolve to a permanent URL.
    return base && isCoverKey(key) ? `${base.replace(/\/+$/, '')}/${key}` : null;
  }

  private getClient(): S3Client {
    if (!this.isConfigured()) throw new ServiceUnavailableException('Storage is not configured');
    const accessKeyId = this.config.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get('AWS_SECRET_ACCESS_KEY');
    this.client ??= new S3Client({
      region: this.config.get('AWS_REGION'),
      // Without explicit keys the SDK falls back to its default chain (instance or task role).
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    });
    return this.client;
  }
}

/**
 * Maps a failed HeadObject to what it means for the app. S3 answers 403 instead of 404 for a missing object when the
 * caller lacks s3:ListBucket, so a 403 is reported as a permissions problem rather than an unexplained crash.
 */
export function interpretHeadError(error: unknown): null {
  const { name, $metadata } = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  const status = $metadata?.httpStatusCode;
  if (name === 'NotFound' || status === 404) return null;
  if (status === 403) {
    throw new ServiceUnavailableException('Storage refused the request: check the IAM permissions for this bucket (see docs/storage.md)');
  }
  throw error;
}
