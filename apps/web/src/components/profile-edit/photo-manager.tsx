'use client';
import * as React from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2, Video } from 'lucide-react';
import { toast } from 'sonner';
import type { OwnPhoto, OwnProfileResponse } from '@2k/shared';
import { api, ApiClientError, uploadToSignedUrl } from '@/lib/api';
import { Badge, Button, NativeSelect, Notice, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic';

async function imageSize(file: File): Promise<{ width?: number; height?: number }> {
  try {
    const bmp = await createImageBitmap(file);
    const s = { width: bmp.width, height: bmp.height };
    bmp.close();
    return s;
  } catch {
    return {};
  }
}

export function PhotoManager({ photos, maxPhotos, onChange }: { photos: OwnPhoto[]; maxPhotos: number; onChange: () => Promise<void> | void }) {
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const sorted = [...photos].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = maxPhotos - photos.length;
    const list = [...files].slice(0, room);
    if (files.length > room) toast.message(`Only ${room} more photo${room === 1 ? '' : 's'} can be added.`);
    setBusy('upload');
    try {
      for (const file of list) {
        const up = await api<{ path: string; signedUrl: string }>('/uploads', { body: { kind: 'photo', contentType: file.type, sizeBytes: file.size } });
        await uploadToSignedUrl(up.signedUrl, file);
        await api('/profile/photos', { body: { path: up.path, ...(await imageSize(file)) } });
      }
      toast.success(list.length > 1 ? 'Photos added — they’ll appear once reviewed.' : 'Photo added — it’ll appear once reviewed.');
      await onChange();
    } catch (e) {
      toast.error((e as ApiClientError).message);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try { await fn(); await onChange(); } catch (e) { toast.error((e as ApiClientError).message); } finally { setBusy(null); }
  };
  const move = (i: number, dir: -1 | 1) => {
    const a = sorted[i]!, b = sorted[i + dir]!;
    return act(a.id, async () => {
      await api(`/profile/photos/${a.id}`, { method: 'PATCH', body: { sortOrder: b.sortOrder } });
      await api(`/profile/photos/${b.id}`, { method: 'PATCH', body: { sortOrder: a.sortOrder } });
    });
  };

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3" aria-label="Your photos">
        {sorted.map((p, i) => (
          <li key={p.id} className={cn('group relative overflow-hidden rounded-2xl border bg-surface-2', p.isPrimary ? 'border-burgundy-500' : 'border-line')}>
            <div className="aspect-[4/5]">
              {p.url ? <img src={p.url} alt={p.isPrimary ? 'Primary photo' : `Photo ${i + 1}`} className={cn('h-full w-full object-cover', p.moderationStatus === 'rejected' && 'opacity-40')} /> : <div className="flex h-full items-center justify-center"><Spinner /></div>}
            </div>
            <div className="absolute left-2 top-2 flex flex-wrap gap-1">
              {p.isPrimary && <Badge tone="burgundy"><Star />Primary</Badge>}
              {p.moderationStatus === 'pending' && <Badge tone="warning">Under review</Badge>}
              {p.moderationStatus === 'rejected' && <Badge tone="danger" title={p.moderationReason ?? undefined}>Not approved</Badge>}
            </div>
            <div className="space-y-2 border-t border-line bg-surface p-2">
              <NativeSelect aria-label="Who can see this photo" className="h-9 text-xs" value={p.visibility} disabled={busy === p.id}
                onChange={(e) => act(p.id, () => api(`/profile/photos/${p.id}`, { method: 'PATCH', body: { visibility: e.target.value } }))}>
                <option value="inherit">Follows profile setting</option>
                <option value="connections">Connections only</option>
                <option value="hidden">Hidden</option>
              </NativeSelect>
              <div className="flex items-center justify-between">
                <div className="flex">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0 || busy !== null} onClick={() => move(i, -1)} aria-label="Move earlier"><ArrowLeft /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={i === sorted.length - 1 || busy !== null} onClick={() => move(i, 1)} aria-label="Move later"><ArrowRight /></Button>
                </div>
                <div className="flex">
                  {!p.isPrimary && <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={busy !== null} onClick={() => act(p.id, () => api(`/profile/photos/${p.id}`, { method: 'PATCH', body: { isPrimary: true } }))} aria-label="Make primary photo"><Star /></Button>}
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-danger" disabled={busy !== null} onClick={() => { if (confirm('Remove this photo?')) void act(p.id, () => api(`/profile/photos/${p.id}`, { method: 'DELETE' })); }} aria-label="Remove photo"><Trash2 /></Button>
                </div>
              </div>
            </div>
          </li>
        ))}
        {photos.length < maxPhotos && (
          <li>
            <button type="button" onClick={() => input.current?.click()} disabled={busy === 'upload'}
              className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface text-sm text-muted transition-colors hover:border-ink-2 hover:text-ink">
              {busy === 'upload' ? <Spinner /> : <ImagePlus className="h-6 w-6" />}
              {busy === 'upload' ? 'Uploading…' : 'Add photos'}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => upload(e.target.files)} aria-label="Choose photos to upload" />
      <p className="text-xs text-muted">Up to {maxPhotos} photos, 10 MB each. Clear, recent photos of yourself work best. Every photo is reviewed before members can see it.</p>
    </div>
  );
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => { URL.revokeObjectURL(el.src); resolve(Math.round(el.duration)); };
    el.onerror = () => reject(new Error('Could not read this video. Try MP4 or MOV.'));
    el.src = URL.createObjectURL(file);
  });
}

export function VideoManager({ video, limits, onChange }: { video: OwnProfileResponse['video']; limits: OwnProfileResponse['limits']; onChange: () => Promise<void> | void }) {
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [visibility, setVisibility] = React.useState<'members' | 'connections' | 'hidden'>(video?.visibility ?? 'members');

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const seconds = await readDuration(file);
      if (seconds < limits.videoMinSeconds || seconds > limits.videoMaxSeconds) throw new ApiClientError(422, 'validation_failed', `Please choose a video between ${limits.videoMinSeconds} and ${limits.videoMaxSeconds} seconds (this one is ${seconds}s).`);
      const up = await api<{ path: string; signedUrl: string }>('/uploads', { body: { kind: 'video', contentType: file.type, sizeBytes: file.size } });
      await uploadToSignedUrl(up.signedUrl, file);
      await api('/profile/video', { body: { path: up.path, durationSeconds: seconds, visibility } });
      toast.success('Video added — it will be visible once reviewed.');
      await onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {video ? (
        <div className="space-y-3">
          {video.url && <video src={video.url} controls className="aspect-video w-full rounded-2xl bg-ink" aria-label="Your introduction video" />}
          <div className="flex flex-wrap items-center gap-2">
            {video.moderationStatus === 'pending' && <Badge tone="warning">Under review</Badge>}
            {video.moderationStatus === 'approved' && <Badge tone="success">Approved</Badge>}
            {video.moderationStatus === 'rejected' && <Badge tone="danger">Not approved</Badge>}
            <span className="text-sm text-muted">{video.durationSeconds}s · visible to {video.visibility === 'members' ? 'members' : video.visibility === 'connections' ? 'connections' : 'nobody'}</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()} loading={busy}>Replace</Button>
            <Button type="button" variant="ghost" size="sm" className="text-danger" disabled={busy}
              onClick={async () => { if (!confirm('Remove your introduction video?')) return; try { await api('/profile/video', { method: 'DELETE' }); await onChange(); } catch (e) { toast.error((e as Error).message); } }}>Remove</Button>
          </div>
        </div>
      ) : (
        <Notice>An optional {limits.videoMinSeconds}–{limits.videoMaxSeconds} second introduction helps others hear your voice. You can skip this anytime.</Notice>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <NativeSelect aria-label="Who can watch your video" value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} className="sm:max-w-xs">
          <option value="members">All members can watch</option>
          <option value="connections">Only connections</option>
          <option value="hidden">Only me</option>
        </NativeSelect>
        {!video && <Button type="button" variant="secondary" onClick={() => input.current?.click()} loading={busy}><Video />Record or upload a video</Button>}
      </div>
      <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm" capture="user" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} aria-label="Choose an introduction video" />
    </div>
  );
}
