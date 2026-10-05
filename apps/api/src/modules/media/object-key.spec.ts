import { describe, expect, it } from 'vitest';
import { buildObjectKey, isCoverKey } from './object-key';

describe('buildObjectKey', () => {
  it('puts audio under the private prefix and images under the cover prefix', () => {
    expect(buildObjectKey('AUDIO', 'audio/mpeg')).toMatch(/^audio\/[0-9a-f-]{36}\.mp3$/);
    expect(buildObjectKey('IMAGE', 'image/webp')).toMatch(/^covers\/[0-9a-f-]{36}\.webp$/);
  });

  it.each([
    ['audio/mp4', 'm4a'],
    ['audio/aac', 'aac'],
    ['audio/x-wav', 'wav'],
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
  ])('maps %s to .%s', (contentType, extension) => {
    const kind = contentType.startsWith('audio') ? 'AUDIO' : 'IMAGE';

    expect(buildObjectKey(kind, contentType).endsWith(`.${extension}`)).toBe(true);
  });

  it('never repeats a key', () => {
    const keys = new Set(Array.from({ length: 200 }, () => buildObjectKey('AUDIO', 'audio/mpeg')));

    expect(keys.size).toBe(200);
  });
});

describe('isCoverKey', () => {
  it('is true only under the cover prefix', () => {
    expect(isCoverKey('covers/a.png')).toBe(true);
    expect(isCoverKey('audio/a.mp3')).toBe(false);
    expect(isCoverKey('covers-evil/a.png')).toBe(false);
  });
});
