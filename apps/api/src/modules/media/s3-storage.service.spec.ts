import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../../config/app-config.module';
import { interpretHeadError, S3StorageService } from './s3-storage.service';

const credentials = { AWS_ACCESS_KEY_ID: 'AKIATESTTESTTESTTEST', AWS_SECRET_ACCESS_KEY: 'test-secret-key-test-secret-key-0000', AWS_REGION: 'eu-west-1' };
const configured = { S3_BUCKET: 'mirsonix-test', ...credentials };

const make = (values: Record<string, string | undefined> = configured) =>
  new S3StorageService({ get: (key: string) => values[key] } as unknown as AppConfig);

// Presigning is pure computation, so these tests exercise the real AWS signer without any network access.
describe('S3StorageService', () => {
  describe('configuration', () => {
    it('is configured once a bucket is set', () => {
      expect(make().isConfigured()).toBe(true);
      expect(make({ ...credentials }).isConfigured()).toBe(false);
    });

    it('refuses to do anything without a bucket', async () => {
      const storage = make({});

      expect(() => storage.bucket()).toThrow(ServiceUnavailableException);
      await expect(storage.createDownloadUrl('audio/a.mp3', 60)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('createUploadForm', () => {
    const request = { key: 'audio/abc.mp3', contentType: 'audio/mpeg', sizeBytes: 1234, expiresInSeconds: 900 };

    it('targets the bucket and pins the key and content type', async () => {
      const { url, fields } = await make().createUploadForm(request);

      expect(url).toContain('mirsonix-test');
      expect(fields).toMatchObject({ key: 'audio/abc.mp3', 'Content-Type': 'audio/mpeg' });
      expect(fields['X-Amz-Signature']).toBeTruthy();
    });

    it('lets S3 itself reject any size other than the announced one', async () => {
      const { fields } = await make().createUploadForm(request);
      const policy = JSON.parse(Buffer.from(fields.Policy!, 'base64').toString('utf8')) as { conditions: unknown[] };

      expect(policy.conditions).toContainEqual(['content-length-range', 1234, 1234]);
      expect(policy.conditions).toContainEqual(['eq', '$Content-Type', 'audio/mpeg']);
    });

    it('expires when the ticket does', async () => {
      const before = Date.now();
      const { fields } = await make().createUploadForm(request);
      const { expiration } = JSON.parse(Buffer.from(fields.Policy!, 'base64').toString('utf8')) as { expiration: string };
      const seconds = (new Date(expiration).getTime() - before) / 1000;

      expect(seconds).toBeGreaterThan(890);
      expect(seconds).toBeLessThanOrEqual(901);
    });
  });

  describe('createDownloadUrl', () => {
    it('signs a short-lived URL for exactly that object', async () => {
      const url = new URL(await make().createDownloadUrl('audio/abc.mp3', 600));

      expect(url.pathname).toContain('audio/abc.mp3');
      expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
      expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
    });
  });

  describe('publicUrl', () => {
    const withBase = make({ ...configured, S3_PUBLIC_BASE_URL: 'https://cdn.example.com/' });

    it('builds a permanent URL for a cover and tolerates a trailing slash', () => {
      expect(withBase.publicUrl('covers/a.png')).toBe('https://cdn.example.com/covers/a.png');
    });

    it('never exposes an audio key, even when a public base URL is set', () => {
      expect(withBase.publicUrl('audio/a.mp3')).toBeNull();
    });

    it('is null when no public base URL is configured', () => {
      expect(make().publicUrl('covers/a.png')).toBeNull();
    });
  });
});

describe('interpretHeadError', () => {
  it.each([
    ['a NotFound error', { name: 'NotFound' }],
    ['an HTTP 404', { $metadata: { httpStatusCode: 404 } }],
  ])('treats %s as "nothing uploaded yet"', (_label, error) => {
    expect(interpretHeadError(error)).toBeNull();
  });

  it('reports an HTTP 403 as a permissions problem, since S3 hides missing objects behind it without s3:ListBucket', () => {
    expect(() => interpretHeadError({ name: 'Forbidden', $metadata: { httpStatusCode: 403 } })).toThrow(ServiceUnavailableException);
    expect(() => interpretHeadError({ $metadata: { httpStatusCode: 403 } })).toThrow(/IAM permissions/);
  });

  it('lets any other failure through untouched', () => {
    const outage = Object.assign(new Error('socket hang up'), { $metadata: { httpStatusCode: 500 } });

    expect(() => interpretHeadError(outage)).toThrow(outage);
  });
});
