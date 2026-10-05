import { randomUUID } from 'node:crypto';
import { STORAGE_PREFIX, type MediaKind } from '@mirsonix/shared';

const EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Keys are random and never derived from the user's file name, so an upload cannot overwrite another object or
 * smuggle a path. Audio lands under the private prefix, images under the cover prefix.
 */
export function buildObjectKey(kind: MediaKind, contentType: string): string {
  const prefix = kind === 'AUDIO' ? STORAGE_PREFIX.audio : STORAGE_PREFIX.cover;
  const extension = EXTENSIONS[contentType] ?? 'bin';
  return `${prefix}/${randomUUID()}.${extension}`;
}

export const isCoverKey = (key: string): boolean => key.startsWith(`${STORAGE_PREFIX.cover}/`);
