import 'server-only';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { getSetting } from '@/server/config';
import { errors } from '@/server/http';
import { assertUploaded, createUpload, removeObjects } from '@/server/media';
import { refreshProfileDerived } from '@/server/profiles/completion';
import { PROFILE_LIMITS_DEFAULT, requireProfile } from './service';
import { revokeBadge } from './badges';

const PHOTO_CHANGED = 'Your photos changed after photo verification.';

export async function requestUpload(auth: AuthContext, kind: 'photo' | 'video' | 'verification', contentType: string, sizeBytes: number) {
  const p = requireProfile(auth);
  if (kind === 'photo') {
    const limits = await getSetting('limits', PROFILE_LIMITS_DEFAULT);
    const { count } = await db().from('profile_photos').select('id', { count: 'exact', head: true }).eq('profile_id', p.id);
    if ((count ?? 0) >= limits.max_photos) throw errors.validation(`You can add up to ${limits.max_photos} photos. Remove one to add another.`);
  }
  return createUpload(kind, p.id, contentType, sizeBytes);
}

export async function confirmPhoto(auth: AuthContext, input: { path: string; width?: number; height?: number }) {
  const p = requireProfile(auth);
  const c = db();
  await assertUploaded('profile-photos', input.path, p.id);
  const limits = await getSetting('limits', PROFILE_LIMITS_DEFAULT);
  const { data: existing } = await c.from('profile_photos').select('id, sort_order, is_primary').eq('profile_id', p.id);
  if ((existing?.length ?? 0) >= limits.max_photos) {
    await removeObjects('profile-photos', [input.path]);
    throw errors.validation(`You can add up to ${limits.max_photos} photos.`);
  }
  const isPrimary = !(existing ?? []).some((x) => x.is_primary);
  const sortOrder = Math.max(-1, ...(existing ?? []).map((x) => x.sort_order)) + 1;
  const { data, error } = await c
    .from('profile_photos')
    .insert({ profile_id: p.id, storage_path: input.path, is_primary: isPrimary, sort_order: sortOrder, width: input.width ?? null, height: input.height ?? null })
    .select('id')
    .single();
  if (error) throw error.code === '23505' ? errors.conflict('This photo was already added.') : error;
  await audit(auth, { action: 'profile.photo.add', entityType: 'profile_photo', entityId: data.id });
  if (p.is_photo_verified) await revokeBadge(auth, p.id, 'photo', PHOTO_CHANGED);
  const completion = await refreshProfileDerived(p.id);
  return { id: data.id, completion };
}

export async function updatePhoto(auth: AuthContext, photoId: string, input: { isPrimary?: boolean; visibility?: 'inherit' | 'connections' | 'hidden'; sortOrder?: number }) {
  const p = requireProfile(auth);
  const c = db();
  const { data: photo } = await c.from('profile_photos').select('id, profile_id').eq('id', photoId).maybeSingle();
  if (!photo || photo.profile_id !== p.id) throw errors.notFound('Photo not found.');
  if (input.isPrimary) {
    const { data: current } = await c.from('profile_photos').select('id').eq('profile_id', p.id).eq('is_primary', true).maybeSingle();
    await c.from('profile_photos').update({ is_primary: false }).eq('profile_id', p.id).eq('is_primary', true);
    await c.from('profile_photos').update({ is_primary: true }).eq('id', photoId);
    if (p.is_photo_verified && current?.id !== photoId) await revokeBadge(auth, p.id, 'photo', PHOTO_CHANGED);
  }
  const patch: { visibility?: string; sort_order?: number } = {};
  if (input.visibility) patch.visibility = input.visibility;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (Object.keys(patch).length) {
    const { error } = await c.from('profile_photos').update(patch).eq('id', photoId);
    if (error) throw error;
  }
  return { ok: true };
}

export async function deletePhoto(auth: AuthContext, photoId: string) {
  const p = requireProfile(auth);
  const c = db();
  const { data: photo } = await c.from('profile_photos').select('id, profile_id, storage_path, is_primary').eq('id', photoId).maybeSingle();
  if (!photo || photo.profile_id !== p.id) throw errors.notFound('Photo not found.');
  await c.from('profile_photos').delete().eq('id', photoId);
  await removeObjects('profile-photos', [photo.storage_path]);
  if (photo.is_primary) {
    const { data: next } = await c.from('profile_photos').select('id').eq('profile_id', p.id).order('sort_order').limit(1).maybeSingle();
    if (next) await c.from('profile_photos').update({ is_primary: true }).eq('id', next.id);
  }
  await audit(auth, { action: 'profile.photo.delete', entityType: 'profile_photo', entityId: photoId });
  if (p.is_photo_verified) await revokeBadge(auth, p.id, 'photo', PHOTO_CHANGED);
  const completion = await refreshProfileDerived(p.id);
  return { completion };
}

export async function confirmVideo(auth: AuthContext, input: { path: string; durationSeconds: number; visibility: 'members' | 'connections' | 'hidden' }) {
  const p = requireProfile(auth);
  const limits = await getSetting('limits', PROFILE_LIMITS_DEFAULT);
  if (input.durationSeconds < limits.video_min_seconds || input.durationSeconds > limits.video_max_seconds) {
    throw errors.validation(`Introduction videos should be ${limits.video_min_seconds}–${limits.video_max_seconds} seconds long.`);
  }
  await assertUploaded('profile-videos', input.path, p.id);
  const c = db();
  const { data: old } = await c.from('profile_videos').select('id, storage_path').eq('profile_id', p.id).maybeSingle();
  if (old) {
    await c.from('profile_videos').delete().eq('id', old.id);
    await removeObjects('profile-videos', [old.storage_path]);
  }
  const { data, error } = await c
    .from('profile_videos')
    .insert({ profile_id: p.id, storage_path: input.path, duration_seconds: input.durationSeconds, visibility: input.visibility })
    .select('id')
    .single();
  if (error) throw error;
  await audit(auth, { action: 'profile.video.set', entityType: 'profile_video', entityId: data.id });
  return { id: data.id };
}

export async function deleteVideo(auth: AuthContext) {
  const p = requireProfile(auth);
  const c = db();
  const { data: old } = await c.from('profile_videos').select('id, storage_path').eq('profile_id', p.id).maybeSingle();
  if (!old) throw errors.notFound('No introduction video.');
  await c.from('profile_videos').delete().eq('id', old.id);
  await removeObjects('profile-videos', [old.storage_path]);
  await audit(auth, { action: 'profile.video.delete', entityType: 'profile_video', entityId: old.id });
  return { ok: true };
}
