import { shortlistSchema, type ShortlistItem } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { errors, parseJson, route } from '@/server/http';
import { buildCards, viewerBundle } from '@/server/discovery/cards';

export const GET = route({ profile: 'required' }, async ({ auth }): Promise<ShortlistItem[]> => {
  const me = auth.profile!;
  const { data } = await db().from('shortlists').select('target_profile_id, note, created_at, added_by_user_id').eq('owner_profile_id', me.id).order('created_at', { ascending: false }).limit(200);
  const cards = await buildCards(await viewerBundle(me.id), (data ?? []).map((r) => r.target_profile_id));
  return (data ?? []).flatMap((r) => {
    const card = cards.get(r.target_profile_id);
    return card ? [{ note: r.note, createdAt: r.created_at, addedByFamily: !!r.added_by_user_id && r.added_by_user_id !== auth.userId, profile: card }] : [];
  });
});

export const POST = route({ profile: 'active' }, async ({ req, auth }) => {
  const body = await parseJson(req, shortlistSchema);
  const me = auth.profile!;
  if (body.targetProfileId === me.id) throw errors.validation('You cannot shortlist yourself.');
  const cards = await buildCards(await viewerBundle(me.id), [body.targetProfileId]);
  if (!cards.has(body.targetProfileId)) throw errors.notFound('This profile is not available.');
  const { error } = await db().from('shortlists').upsert(
    { owner_profile_id: me.id, target_profile_id: body.targetProfileId, note: body.note, added_by_user_id: auth.userId },
    { onConflict: 'owner_profile_id,target_profile_id' },
  );
  if (error) throw error;
  await db().from('recommendations').update({ status: 'shortlisted' }).eq('profile_id', me.id).eq('candidate_profile_id', body.targetProfileId).in('status', ['new', 'viewed']);
  return { shortlisted: true };
});
