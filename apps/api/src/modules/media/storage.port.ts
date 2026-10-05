export interface UploadForm {
  url: string;
  fields: Record<string, string>;
}

export interface StoredObject {
  sizeBytes: number;
  contentType: string;
}

export interface UploadFormRequest {
  key: string;
  contentType: string;
  /** The exact size the client announced. S3 itself rejects any other size. */
  sizeBytes: number;
  expiresInSeconds: number;
}

/** Object storage as the app needs it. S3 is one adapter; tests use an in-memory one. */
export abstract class StoragePort {
  abstract isConfigured(): boolean;
  abstract bucket(): string;
  /** A presigned form the browser posts the file to directly, so audio never passes through this server. */
  abstract createUploadForm(request: UploadFormRequest): Promise<UploadForm>;
  /** Metadata of a stored object, or null when nothing was uploaded under that key. */
  abstract head(key: string): Promise<StoredObject | null>;
  abstract createDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  /** Permanent URL for a key under the public prefix, or null when no public base URL is configured. */
  abstract publicUrl(key: string): string | null;
}
