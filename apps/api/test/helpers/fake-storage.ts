import {
  StoragePort,
  type StoredObject,
  type UploadForm,
  type UploadFormRequest,
} from '../../src/modules/media/storage.port';

/** In-memory object storage: tests "upload" a file by registering it, no network and no AWS account needed. */
export class FakeStorage extends StoragePort {
  configured = true;
  publicBaseUrl: string | null = null;
  readonly objects = new Map<string, StoredObject>();

  isConfigured = () => this.configured;
  bucket = () => 'test-bucket';

  async createUploadForm({ key, contentType, sizeBytes }: UploadFormRequest): Promise<UploadForm> {
    return { url: 'https://fake-s3.test/test-bucket', fields: { key, 'Content-Type': contentType, 'x-expected-size': String(sizeBytes) } };
  }

  async head(key: string): Promise<StoredObject | null> {
    return this.objects.get(key) ?? null;
  }

  async createDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return `https://fake-s3.test/${key}?signed=1&ttl=${expiresInSeconds}`;
  }

  publicUrl(key: string): string | null {
    return this.publicBaseUrl && key.startsWith('covers/') ? `${this.publicBaseUrl}/${key}` : null;
  }

  simulateUpload(key: string, sizeBytes: number, contentType: string): void {
    this.objects.set(key, { sizeBytes, contentType });
  }

  reset(): void {
    this.configured = true;
    this.publicBaseUrl = null;
    this.objects.clear();
  }
}
