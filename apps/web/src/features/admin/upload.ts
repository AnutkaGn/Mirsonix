import {
  UPLOAD_LIMITS,
  type MediaAsset,
  type MediaKind,
  type UploadTicket,
} from '@mirsonix/shared';

export type FileProblem = 'type' | 'size';

/** The same limits the server enforces, checked first so the admin hears about a bad file before it uploads. */
export function checkFile(kind: MediaKind, file: Pick<File, 'type' | 'size'>): FileProblem | null {
  const limits = kind === 'AUDIO' ? UPLOAD_LIMITS.audio : UPLOAD_LIMITS.image;
  if (!(limits.mimeTypes as readonly string[]).includes(file.type)) return 'type';
  return file.size > limits.maxBytes ? 'size' : null;
}

export const acceptedTypes = (kind: MediaKind): string =>
  (kind === 'AUDIO' ? UPLOAD_LIMITS.audio : UPLOAD_LIMITS.image).mimeTypes.join(',');

/** Sends the presigned form straight to S3. XHR, because `fetch` cannot report upload progress. */
export function postToStorage(
  ticket: UploadTicket,
  file: File,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();
    for (const [name, value] of Object.entries(ticket.upload.fields)) form.append(name, value);
    form.append('file', file); // S3 requires the file to be the last field

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new UploadFailedError(request.status));
    request.onerror = () => reject(new UploadFailedError(0));
    request.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal?.addEventListener('abort', () => request.abort(), { once: true });

    request.open('POST', ticket.upload.url);
    request.send(form);
  });
}

export class UploadFailedError extends Error {
  constructor(public readonly status: number) {
    super(status === 0 ? 'Could not reach storage' : `Storage rejected the upload (${status})`);
  }
}

/** Reads the length from the file's own metadata, as the server expects for audio. */
export function readAudioDurationMs(
  file: File,
  createAudio: () => HTMLAudioElement = () => new Audio(),
): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = createAudio();
    const url = URL.createObjectURL(file);
    const done = () => URL.revokeObjectURL(url);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      done();
      if (Number.isFinite(audio.duration) && audio.duration > 0)
        resolve(Math.round(audio.duration * 1000));
      else reject(new Error('Unreadable audio length'));
    };
    audio.onerror = () => {
      done();
      reject(new Error('Unreadable audio file'));
    };
    audio.src = url;
  });
}

export interface UploadDeps {
  createTicket: (input: {
    kind: MediaKind;
    contentType: string;
    sizeBytes: number;
  }) => Promise<UploadTicket>;
  confirm: (assetId: string, input: { durationMs?: number }) => Promise<MediaAsset>;
  post: typeof postToStorage;
  readDuration: (file: File) => Promise<number>;
}

export class InvalidFileError extends Error {
  constructor(public readonly problem: FileProblem) {
    super(`Invalid file: ${problem}`);
  }
}

/** The whole upload: check the file, get a ticket, send it to S3, then tell the API it arrived. */
export async function uploadAsset(
  {
    kind,
    file,
    onProgress,
    signal,
  }: { kind: MediaKind; file: File; onProgress: (ratio: number) => void; signal?: AbortSignal },
  deps: UploadDeps,
): Promise<MediaAsset> {
  const problem = checkFile(kind, file);
  if (problem) throw new InvalidFileError(problem);
  const durationMs = kind === 'AUDIO' ? await deps.readDuration(file) : undefined;
  const ticket = await deps.createTicket({ kind, contentType: file.type, sizeBytes: file.size });
  await deps.post(ticket, file, onProgress, signal);
  return deps.confirm(ticket.assetId, durationMs === undefined ? {} : { durationMs });
}
