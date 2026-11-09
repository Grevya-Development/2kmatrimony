import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

export type UploadKind = 'photo' | 'video' | 'verification' | 'chat';

interface UploadTicket { bucket: string; path: string; signedUrl: string; token: string }

/** Let the member pick (or capture) an image. Returns null if cancelled/denied. */
export async function pickImage(source: 'library' | 'camera', opts: { aspect?: [number, number] } = {}): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: opts.aspect });
    return r.canceled ? null : r.assets[0] ?? null;
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: opts.aspect });
  return r.canceled ? null : r.assets[0] ?? null;
}

/** Pick or record a short video. Returns null if cancelled/denied. Duration is in seconds. */
export async function pickVideo(source: 'library' | 'camera', maxSeconds: number): Promise<ImagePicker.ImagePickerAsset | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['videos'], videoMaxDuration: maxSeconds, allowsEditing: true, quality: 0.8, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium };
  if (source === 'camera') {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) return null;
    const r = await ImagePicker.launchCameraAsync({ ...opts, cameraType: ImagePicker.CameraType.front });
    return r.canceled ? null : r.assets[0] ?? null;
  }
  const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!lib.granted) return null;
  const r = await ImagePicker.launchImageLibraryAsync(opts);
  return r.canceled ? null : r.assets[0] ?? null;
}

const mimeOf = (asset: ImagePicker.ImagePickerAsset) => {
  if (asset.mimeType) return asset.mimeType === 'image/jpg' ? 'image/jpeg' : asset.mimeType;
  const ext = asset.uri.split('.').pop()?.toLowerCase();
  if (asset.type === 'video' || ext === 'mp4' || ext === 'mov' || ext === 'webm') return ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4';
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'heic' ? 'image/heic' : 'image/jpeg';
};

/**
 * Upload via the API's signed upload URL flow: POST /uploads → PUT bytes →
 * returns the storage path to confirm with the feature endpoint.
 */
export async function uploadAsset(kind: UploadKind, asset: ImagePicker.ImagePickerAsset, conversationId?: string): Promise<{ path: string; width?: number; height?: number }> {
  const blob = await (await fetch(asset.uri)).blob();
  const contentType = mimeOf(asset);
  const sizeBytes = asset.fileSize ?? blob.size;
  // Chat media has its own participant-checked endpoint; profile media uses /uploads.
  const ticket = kind === 'chat'
    ? await api.post<UploadTicket>('/chat-uploads', { conversationId, contentType, sizeBytes })
    : await api.post<UploadTicket>('/uploads', { kind, contentType, sizeBytes });
  const res = await fetch(ticket.signedUrl, { method: 'PUT', headers: { 'content-type': contentType, 'x-upsert': 'false' }, body: blob });
  if (!res.ok) throw new Error('Upload failed. Please try again.');
  return { path: ticket.path, width: asset.width || undefined, height: asset.height || undefined };
}
