import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '@/lib/api-client';
import { adminErrorKey, serverMessage } from './errors';
import { InvalidFileError, UploadFailedError } from './upload';

const api = (status: number, message = 'm') =>
  new ApiRequestError(status, { statusCode: status, error: 'e', message });

describe('adminErrorKey', () => {
  it.each([
    [new InvalidFileError('type'), 'upload', 'fileType'],
    [new InvalidFileError('size'), 'upload', 'fileSize'],
    [new UploadFailedError(403), 'upload', 'uploadFailed'],
    [new Error('Unreadable audio file'), 'upload', 'audioUnreadable'],
    [api(503), 'upload', 'storageDown'],
    [api(503), 'other', 'paymentsDown'],
    [api(409), 'upload', 'notStored'],
    [api(409), 'other', 'conflict'],
    [api(422), 'other', 'rejected'],
    [api(400), 'other', 'rejected'],
    [api(404), 'other', 'notFound'],
    [api(429), 'other', 'tooMany'],
    [api(500), 'other', 'generic'],
    [new Error('boom'), 'other', 'generic'],
  ] as const)('maps %# to %s', (error, context, key) => {
    expect(adminErrorKey(error, context)).toBe(key);
  });
});

describe('serverMessage', () => {
  it('passes on the explanation for a rule violation', () => {
    expect(serverMessage(api(409, 'Archive the program first'))).toBe('Archive the program first');
    expect(serverMessage(api(422, 'Needs a cover'))).toBe('Needs a cover');
  });

  it('keeps quiet for other failures', () => {
    expect(serverMessage(api(500, 'secret detail'))).toBeNull();
    expect(serverMessage(new Error('x'))).toBeNull();
  });
});
