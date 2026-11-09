import 'server-only';
import { randomUUID } from 'node:crypto';
import { PHOTO_MIME, VIDEO_MIME } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { errors } from './http';

export type Bucket = 'profile-photos' | 'profile-videos' | 'verification-docs' | 'chat-media' | 'data-exports';

const SIGNED_URL_TTL = 60 * 60; // 1 hour

/** Batch signed read URLs. Missing objects are skipped. */
export async function signedUrls(bucket: Bucket, paths: string[], ttlSeconds = SIGNED_URL_TTL): Promise<Map<string, string>> {
  const unique = [...new Set(paths)].filter(Boolean);
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const { data, error } = await db().storage.from(bucket).createSignedUrls(unique, ttlSeconds);
  if (error) {
    console.error('[media] signed urls failed', bucket, error.message);
    return out;
  }
  for (const row of data ?? []) if (row.signedUrl && row.path) out.set(row.path, row.signedUrl);
  return out;
}

const RULES = {
  photo: { bucket: 'profile-photos' as const, mime: PHOTO_MIME as readonly string[], maxBytes: 10 * 1024 * 1024 },
  video: { bucket: 'profile-videos' as const, mime: VIDEO_MIME as readonly string[], maxBytes: 100 * 1024 * 1024 },
  verification: { bucket: 'verification-docs' as const, mime: [...PHOTO_MIME, 'application/pdf'] as readonly string[], maxBytes: 10 * 1024 * 1024 },
  chat: { bucket: 'chat-media' as const, mime: PHOTO_MIME as readonly string[], maxBytes: 10 * 1024 * 1024 },
};
export type UploadKind = keyof typeof RULES;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'application/pdf': 'pdf',
};

/**
 * Issue a one-time signed upload URL. Objects are namespaced under the owner's
 * profile (or conversation) id so ownership can be verified on confirmation.
 */
export async function createUpload(kind: UploadKind, ownerPrefix: string, contentType: string, sizeBytes: number) {
  const rule = RULES[kind];
  if (!rule.mime.includes(contentType)) throw errors.validation(`Unsupported file type ${contentType}.`);
  if (sizeBytes > rule.maxBytes) throw errors.validation(`File is too large (max ${Math.round(rule.maxBytes / 1024 / 1024)} MB).`);
  const path = `${ownerPrefix}/${randomUUID()}.${EXT[contentType] ?? 'bin'}`;
  const { data, error } = await db().storage.from(rule.bucket).createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error('Could not create upload URL');
  return { bucket: rule.bucket, path, token: data.token, signedUrl: data.signedUrl };
}

/** Ensure an uploaded path belongs to the expected prefix and the object exists. */
export async function assertUploaded(bucket: Bucket, path: string, ownerPrefix: string): Promise<void> {
  if (!path.startsWith(`${ownerPrefix}/`) || path.includes('..')) throw errors.forbidden('Invalid upload path.');
  const dir = path.slice(0, path.lastIndexOf('/'));
  const name = path.slice(path.lastIndexOf('/') + 1);
  const { data, error } = await db().storage.from(bucket).list(dir, { search: name, limit: 1 });
  if (error || !data?.some((o) => o.name === name)) throw errors.validation('Upload not found. Please try uploading again.');
}

export async function removeObjects(bucket: Bucket, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await db().storage.from(bucket).remove(paths);
  if (error) console.error('[media] remove failed', bucket, error.message);
}
