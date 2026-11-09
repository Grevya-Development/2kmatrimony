import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import type {
  FamilyDiscussionItem,
  FamilyMemberItem,
  FamilyPermission,
  FamilyRelation,
  FamilySuggestionItem,
  ProfileCard,
} from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { publicEnv } from '@/lib/env';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { getSetting } from '@/server/config';
import { errors } from '@/server/http';
import { scoreCandidates } from '@/server/matching/service';
import { notify, renderTemplate } from '@/server/notify';
import { providers } from '@/server/notify/providers';
import { loadBundle, loadBundles } from '@/server/profiles/load';
import { buildViewerContext, canView, compatibilitySummary, toCards } from '@/server/profiles/projection';

const INVITE_TTL_DAYS = 7;
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

type MemberRow = {
  id: string; profile_id: string; member_user_id: string | null; invited_contact: string; relation: string; display_name: string | null;
  permissions: string[]; status: string; accepted_at: string | null; invite_expires_at: string | null; created_at: string;
};
const MEMBER_COLS = 'id, profile_id, member_user_id, invited_contact, relation, display_name, permissions, status, accepted_at, invite_expires_at, created_at';

const toItem = (r: MemberRow): FamilyMemberItem => ({
  id: r.id,
  relation: r.relation as FamilyRelation,
  displayName: r.display_name,
  invitedContact: maskContact(r.invited_contact),
  permissions: r.permissions as FamilyPermission[],
  status: r.status as FamilyMemberItem['status'],
  acceptedAt: r.accepted_at,
  inviteExpiresAt: r.invite_expires_at,
  createdAt: r.created_at,
});

export function maskContact(c: string): string {
  if (c.includes('@')) {
    const [u, d] = c.split('@');
    return `${u!.slice(0, 2)}${'•'.repeat(Math.max(1, u!.length - 2))}@${d}`;
  }
  const digits = c.replace(/\D/g, '');
  return digits.length > 4 ? `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}` : c;
}

export function normaliseContact(raw: string): { kind: 'email' | 'phone'; value: string } {
  const v = raw.trim();
  if (v.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw errors.validation('Enter a valid email address.');
    return { kind: 'email', value: v.toLowerCase() };
  }
  const digits = v.replace(/\D/g, '');
  if (digits.length === 10) return { kind: 'phone', value: `+91${digits}` };
  if (digits.length >= 11 && digits.length <= 15) return { kind: 'phone', value: `+${digits}` };
  throw errors.validation('Enter a valid email address or mobile number.');
}

/**
 * Invites are bound to the invited contact: the accepting account must have that
 * email or phone number *verified* in Supabase Auth (a forwarded link is not enough).
 */
export async function matchesInvitedContact(userId: string, invitedContact: string): Promise<boolean> {
  const { data } = await db().auth.admin.getUserById(userId);
  const u = data.user;
  if (!u) return false;
  const invited = invitedContact.trim().toLowerCase();
  if (invited.includes('@')) return !!u.email && !!u.email_confirmed_at && u.email.toLowerCase() === invited;
  const phone = u.phone ? `+${u.phone.replace(/\D/g, '')}` : null;
  return !!phone && !!u.phone_confirmed_at && phone === `+${invited.replace(/\D/g, '')}`;
}

const inviteLink = (token: string) => `${publicEnv.appUrl}/family/accept?token=${token}`;

function requireOwner(auth: AuthContext): string {
  if (!auth.profile) throw errors.profileIncomplete();
  return auth.profile.id;
}

/** Who is the caller relative to a profile: its owner or an active family member. */
export async function familyAccess(auth: AuthContext, profileId: string): Promise<{ role: 'owner' | 'member'; permissions: FamilyPermission[]; memberId: string | null }> {
  if (auth.profile?.id === profileId) return { role: 'owner', permissions: ['view_profiles', 'suggest_matches', 'shortlist', 'discuss', 'coordinate_meetings'], memberId: null };
  const { data } = await db().from('family_members').select('id, permissions').eq('profile_id', profileId).eq('member_user_id', auth.userId).eq('status', 'active').maybeSingle();
  if (!data) throw errors.notFound('Not found.');
  return { role: 'member', permissions: data.permissions as FamilyPermission[], memberId: data.id };
}

function requirePermission(access: { permissions: FamilyPermission[] }, p: FamilyPermission) {
  if (!access.permissions.includes(p)) throw errors.forbidden('You don’t have permission to do that.');
}

// ---------------------------------------------------------------------------
// Owner management
// ---------------------------------------------------------------------------
export async function listFamily(auth: AuthContext): Promise<FamilyMemberItem[]> {
  const profileId = requireOwner(auth);
  const { data } = await db().from('family_members').select(MEMBER_COLS).eq('profile_id', profileId).neq('status', 'revoked').order('created_at');
  return (data ?? []).map(toItem);
}

async function deliverInvite(contact: { kind: 'email' | 'phone'; value: string }, vars: Record<string, unknown>): Promise<boolean> {
  const channel = contact.kind === 'email' ? 'email' : 'sms';
  const provider = providers[channel];
  if (!provider.isConfigured()) return false;
  const { data: tpl } = await db().from('notification_templates').select('subject, body, provider_template_id').eq('key', 'family_invite').eq('channel', channel).eq('locale', 'en').eq('is_active', true).maybeSingle();
  if (!tpl) return false;
  const result = await provider
    .send(
      { userId: '', email: contact.kind === 'email' ? contact.value : null, phone: contact.kind === 'phone' ? contact.value : null, pushTokens: [], locale: 'en' },
      { subject: tpl.subject ? renderTemplate(tpl.subject, vars) : null, body: renderTemplate(tpl.body, vars), templateKey: 'family_invite', providerTemplateId: tpl.provider_template_id, data: {} },
    )
    .catch(() => ({ status: 'failed' as const }));
  return result.status === 'sent';
}

export async function inviteFamily(
  auth: AuthContext,
  input: { contact: string; relation: FamilyRelation; displayName: string | null; permissions: FamilyPermission[] },
): Promise<{ member: FamilyMemberItem; inviteLink: string; delivered: boolean }> {
  const profileId = requireOwner(auth);
  const contact = normaliseContact(input.contact);
  if ((contact.kind === 'email' && contact.value === auth.email?.toLowerCase()) || (contact.kind === 'phone' && contact.value === auth.phone)) {
    throw errors.validation('You can’t invite yourself.');
  }
  const c = db();
  const { count } = await c.from('family_members').select('id', { count: 'exact', head: true }).eq('profile_id', profileId).in('status', ['invited', 'active']);
  if ((count ?? 0) >= 10) throw errors.conflict('You can have up to 10 family members.');
  const { data: dup } = await c.from('family_members').select('id').eq('profile_id', profileId).eq('invited_contact', contact.value).in('status', ['invited', 'active']).maybeSingle();
  if (dup) throw errors.conflict('This person has already been invited.');

  const token = randomBytes(32).toString('base64url');
  const { data, error } = await c
    .from('family_members')
    .insert({
      profile_id: profileId,
      invited_contact: contact.value,
      relation: input.relation,
      display_name: input.displayName,
      permissions: input.permissions,
      invite_token_hash: hashToken(token),
      invite_expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86400_000).toISOString(),
    })
    .select(MEMBER_COLS)
    .single();
  if (error || !data) throw error ?? new Error('invite failed');

  const policy = await getSetting<Record<string, string>>('policy_versions', { privacy: '2026-11-01' });
  await c.from('consent_records').insert({ user_id: auth.userId, consent_type: 'family_access', policy_version: policy.privacy ?? '2026-11-01', granted: true, source: auth.platform, ip: auth.ip, user_agent: auth.userAgent });

  const link = inviteLink(token);
  const delivered = await deliverInvite(contact, { ownerName: auth.profile?.first_name ?? 'A member', relation: input.relation, link });
  await audit(auth, { action: 'family.invite', entityType: 'family_member', entityId: data.id, after: { relation: input.relation, permissions: input.permissions } });
  return { member: toItem(data), inviteLink: link, delivered };
}

export async function updateFamilyMember(auth: AuthContext, memberId: string, input: { permissions?: FamilyPermission[]; regenerateInvite?: boolean }): Promise<{ member: FamilyMemberItem; inviteLink?: string }> {
  const profileId = requireOwner(auth);
  const c = db();
  const { data: row } = await c.from('family_members').select(MEMBER_COLS).eq('id', memberId).eq('profile_id', profileId).maybeSingle();
  if (!row || row.status === 'revoked') throw errors.notFound('Family member not found.');
  const patch: { permissions?: string[]; invite_token_hash?: string; invite_expires_at?: string } = {};
  let token: string | null = null;
  if (input.permissions) patch.permissions = input.permissions;
  if (input.regenerateInvite) {
    if (row.status !== 'invited') throw errors.conflict('This invitation has already been accepted.');
    token = randomBytes(32).toString('base64url');
    patch.invite_token_hash = hashToken(token);
    patch.invite_expires_at = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000).toISOString();
  }
  const { data } = await c.from('family_members').update(patch).eq('id', memberId).select(MEMBER_COLS).single();
  await audit(auth, { action: 'family.update', entityType: 'family_member', entityId: memberId, before: { permissions: row.permissions }, after: { permissions: data!.permissions, regenerated: !!token } });
  return { member: toItem(data!), ...(token ? { inviteLink: inviteLink(token) } : {}) };
}

export async function revokeFamilyMember(auth: AuthContext, memberId: string): Promise<void> {
  const profileId = requireOwner(auth);
  const { data } = await db()
    .from('family_members')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), invite_token_hash: null })
    .eq('id', memberId)
    .eq('profile_id', profileId)
    .neq('status', 'revoked')
    .select('id');
  if (!data?.length) throw errors.notFound('Family member not found.');
  await audit(auth, { action: 'family.revoke', entityType: 'family_member', entityId: memberId });
}

// ---------------------------------------------------------------------------
// Invitee
// ---------------------------------------------------------------------------
export async function acceptInvite(auth: AuthContext, token: string, acceptTerms: boolean): Promise<{ profileId: string; ownerName: string }> {
  const c = db();
  const { data: row } = await c.from('family_members').select(`${MEMBER_COLS}, profiles(owner_user_id, first_name)`).eq('invite_token_hash', hashToken(token)).maybeSingle();
  if (!row || row.status !== 'invited') throw errors.notFound('This invitation is invalid or has already been used.');
  if (row.invite_expires_at && new Date(row.invite_expires_at).getTime() < Date.now()) throw errors.conflict('This invitation has expired. Ask for a new link.');
  const owner = row.profiles as unknown as { owner_user_id: string; first_name: string | null } | null;
  if (!owner) throw errors.notFound('This invitation is invalid.');
  if (owner.owner_user_id === auth.userId) throw errors.validation('You can’t accept an invitation to your own profile.');
  if (!(await matchesInvitedContact(auth.userId, row.invited_contact))) {
    throw errors.forbidden('This invitation was sent to a different email or phone number. Sign in with that account to accept it.');
  }
  const { data: existing } = await c.from('family_members').select('id').eq('profile_id', row.profile_id).eq('member_user_id', auth.userId).eq('status', 'active').maybeSingle();
  if (existing) throw errors.conflict('You are already part of this family circle.');

  if (acceptTerms) {
    const policy = await getSetting<Record<string, string>>('policy_versions', { terms: '2026-11-01', privacy: '2026-11-01' });
    await c.from('consent_records').insert(
      (['terms', 'privacy'] as const).map((t) => ({ user_id: auth.userId, consent_type: t, policy_version: policy[t] ?? '2026-11-01', granted: true, source: auth.platform, ip: auth.ip, user_agent: auth.userAgent })),
    );
  }
  await c.from('family_members').update({ member_user_id: auth.userId, status: 'active', accepted_at: new Date().toISOString(), invite_token_hash: null }).eq('id', row.id);
  await audit(auth, { action: 'family.accept', entityType: 'family_member', entityId: row.id }, 'family');
  await notify({ userId: owner.owner_user_id, category: 'family', templateKey: 'family_invite_accepted', vars: { memberName: row.display_name ?? row.relation }, data: { href: '/app/family' } });
  return { profileId: row.profile_id, ownerName: owner.first_name ?? 'your family member' };
}

// ---------------------------------------------------------------------------
// Owner's-perspective cards (privacy: everything is projected for the OWNER)
// ---------------------------------------------------------------------------
async function ownerCards(ownerProfileId: string, ids: string[]): Promise<Map<string, ProfileCard>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const [owner, bundles] = await Promise.all([loadBundle(ownerProfileId), loadBundles(unique)]);
  if (!owner) return new Map();
  const [ctx, scored] = await Promise.all([buildViewerContext(ownerProfileId, unique), scoreCandidates(owner, [...bundles.values()])]);
  const extras = new Map(unique.flatMap((id) => {
    const p = scored.get(id);
    return p ? [[id, { compatibility: compatibilitySummary(p.mutual, p.confidence), sharedInterests: p.sharedInterests }] as const] : [];
  }));
  const cards = await toCards(unique.flatMap((id) => (bundles.get(id) ? [bundles.get(id)!] : [])), ctx, extras);
  return new Map(cards.map((c) => [c.id, c]));
}

export async function memberView(auth: AuthContext, ownerProfileId: string) {
  const access = await familyAccess(auth, ownerProfileId);
  if (access.role !== 'member') throw errors.notFound('Not found.');
  const c = db();
  const canSee = access.permissions.includes('view_profiles');
  const canShortlist = access.permissions.includes('shortlist');
  const [{ data: owner }, recs, shortlist, { data: sent }] = await Promise.all([
    c.from('profiles').select('first_name, profile_code').eq('id', ownerProfileId).single(),
    canSee
      ? c.from('recommendations').select('candidate_profile_id, score').eq('profile_id', ownerProfileId).order('batch_date', { ascending: false }).order('score', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as { candidate_profile_id: string; score: number }[] }),
    canSee || canShortlist
      ? c.from('shortlists').select('target_profile_id, note, added_by_user_id, created_at').eq('owner_profile_id', ownerProfileId).order('created_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as { target_profile_id: string; note: string | null; added_by_user_id: string | null; created_at: string }[] }),
    c.from('family_suggestions').select('id, target_profile_id, note, status, created_at').eq('profile_id', ownerProfileId).eq('family_member_id', access.memberId!).order('created_at', { ascending: false }),
  ]);
  const recIds = [...new Set((recs.data ?? []).map((r) => r.candidate_profile_id))];
  const slIds = (shortlist.data ?? []).map((s) => s.target_profile_id);
  // Active connections are only listed for coordinating meetings.
  const conns = access.permissions.includes('coordinate_meetings')
    ? ((await c.from('connections').select('id, profile_a, profile_b').eq('status', 'active').or(`profile_a.eq.${ownerProfileId},profile_b.eq.${ownerProfileId}`)).data ?? [])
    : [];
  const connOther = conns.map((x) => ({ id: x.id, other: x.profile_a === ownerProfileId ? x.profile_b : x.profile_a }));
  const cards = await ownerCards(ownerProfileId, [...recIds, ...slIds, ...(sent ?? []).map((s) => s.target_profile_id), ...connOther.map((x) => x.other)]);
  return {
    owner: { profileId: ownerProfileId, firstName: owner?.first_name ?? 'Member', profileCode: owner?.profile_code ?? '' },
    permissions: access.permissions,
    recommendations: recIds.flatMap((id) => (cards.get(id) ? [cards.get(id)!] : [])),
    shortlist: (shortlist.data ?? []).flatMap((s) => (cards.get(s.target_profile_id) ? [{ profile: cards.get(s.target_profile_id)!, note: s.note, addedByMe: s.added_by_user_id === auth.userId }] : [])),
    mySuggestions: (sent ?? []).map((s) => ({ id: s.id, note: s.note, status: s.status, createdAt: s.created_at, profile: cards.get(s.target_profile_id) ?? null })),
    connections: connOther.flatMap((x) => (cards.get(x.other) ? [{ id: x.id, profile: cards.get(x.other)! }] : [])),
  };
}

/** Family member must be able to see the target from the owner's perspective. */
async function assertOwnerCanSee(ownerProfileId: string, targetProfileId: string) {
  if (ownerProfileId === targetProfileId) throw errors.validation('Choose someone else’s profile.');
  const [ctx, target] = await Promise.all([buildViewerContext(ownerProfileId, [targetProfileId]), loadBundle(targetProfileId)]);
  if (!target || !canView(target, ctx)) throw errors.notFound('Profile not found.');
}

export async function familyShortlist(auth: AuthContext, ownerProfileId: string, targetProfileId: string, note: string | null): Promise<void> {
  const access = await familyAccess(auth, ownerProfileId);
  requirePermission(access, 'shortlist');
  await assertOwnerCanSee(ownerProfileId, targetProfileId);
  await db().from('shortlists').upsert({ owner_profile_id: ownerProfileId, target_profile_id: targetProfileId, note, added_by_user_id: auth.userId }, { onConflict: 'owner_profile_id,target_profile_id' });
  await audit(auth, { action: 'family.shortlist', entityType: 'shortlist', entityId: `${ownerProfileId}:${targetProfileId}` }, access.role === 'member' ? 'family' : 'user');
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------
export async function createSuggestion(auth: AuthContext, input: { profileId: string; targetProfileId: string; note: string | null }): Promise<{ id: string }> {
  const access = await familyAccess(auth, input.profileId);
  if (access.role !== 'member') throw errors.validation('Suggestions come from family members.');
  requirePermission(access, 'suggest_matches');
  await assertOwnerCanSee(input.profileId, input.targetProfileId);
  const c = db();
  const { data, error } = await c
    .from('family_suggestions')
    .upsert({ profile_id: input.profileId, family_member_id: access.memberId!, target_profile_id: input.targetProfileId, note: input.note, status: 'pending' }, { onConflict: 'profile_id,family_member_id,target_profile_id' })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('suggest failed');
  const { data: owner } = await c.from('profiles').select('owner_user_id').eq('id', input.profileId).single();
  const { data: member } = await c.from('family_members').select('display_name, relation').eq('id', access.memberId!).single();
  if (owner) await notify({ userId: owner.owner_user_id, category: 'family', templateKey: 'family_suggestion', vars: { memberName: member?.display_name ?? member?.relation ?? 'A family member' }, data: { href: '/app/family' } });
  await audit(auth, { action: 'family.suggest', entityType: 'family_suggestion', entityId: data.id }, 'family');
  return data;
}

export async function listSuggestionsForOwner(auth: AuthContext): Promise<FamilySuggestionItem[]> {
  const profileId = requireOwner(auth);
  const { data } = await db()
    .from('family_suggestions')
    .select('id, target_profile_id, note, status, created_at, family_members(id, display_name, relation)')
    .eq('profile_id', profileId)
    .in('status', ['pending', 'considering'])
    .order('created_at', { ascending: false });
  const cards = await ownerCards(profileId, (data ?? []).map((s) => s.target_profile_id));
  return (data ?? []).map((s) => {
    const fm = s.family_members as unknown as { id: string; display_name: string | null; relation: string } | null;
    return {
      id: s.id,
      note: s.note,
      status: s.status as FamilySuggestionItem['status'],
      createdAt: s.created_at,
      suggestedBy: { memberId: fm?.id ?? '', name: fm?.display_name ?? null, relation: fm?.relation ?? 'family' },
      profile: cards.get(s.target_profile_id) ?? null,
    };
  });
}

export async function updateSuggestion(auth: AuthContext, id: string, status: 'considering' | 'dismissed' | 'acted'): Promise<void> {
  const profileId = requireOwner(auth);
  const { data } = await db().from('family_suggestions').update({ status }).eq('id', id).eq('profile_id', profileId).select('id');
  if (!data?.length) throw errors.notFound('Suggestion not found.');
}

// ---------------------------------------------------------------------------
// Discussions
// ---------------------------------------------------------------------------
async function discussionAccess(auth: AuthContext, profileId: string) {
  const access = await familyAccess(auth, profileId);
  if (access.role === 'member') requirePermission(access, 'discuss');
  return access;
}

export async function listDiscussions(auth: AuthContext, profileId: string, targetProfileId: string): Promise<FamilyDiscussionItem[]> {
  await discussionAccess(auth, profileId);
  const c = db();
  const [{ data }, { data: owner }, { data: members }] = await Promise.all([
    c.from('family_discussions').select('id, body, created_at, author_user_id').eq('profile_id', profileId).eq('target_profile_id', targetProfileId).order('created_at').limit(300),
    c.from('profiles').select('owner_user_id, first_name').eq('id', profileId).single(),
    c.from('family_members').select('member_user_id, display_name, relation').eq('profile_id', profileId),
  ]);
  const names = new Map((members ?? []).filter((m) => m.member_user_id).map((m) => [m.member_user_id!, m.display_name ?? m.relation]));
  return (data ?? []).map((d) => ({
    id: d.id,
    body: d.body,
    createdAt: d.created_at,
    authorName: d.author_user_id === owner?.owner_user_id ? owner?.first_name ?? 'Profile owner' : names.get(d.author_user_id) ?? 'Family member',
    isMine: d.author_user_id === auth.userId,
    isOwner: d.author_user_id === owner?.owner_user_id,
  }));
}

export async function addDiscussion(auth: AuthContext, profileId: string, targetProfileId: string, body: string): Promise<FamilyDiscussionItem> {
  const access = await discussionAccess(auth, profileId);
  await assertOwnerCanSee(profileId, targetProfileId);
  const { data, error } = await db().from('family_discussions').insert({ profile_id: profileId, target_profile_id: targetProfileId, author_user_id: auth.userId, body }).select('id, body, created_at').single();
  if (error || !data) throw error ?? new Error('post failed');
  if (access.role === 'member') await audit(auth, { action: 'family.discuss', entityType: 'family_discussion', entityId: data.id }, 'family');
  return { id: data.id, body: data.body, createdAt: data.created_at, authorName: 'You', isMine: true, isOwner: access.role === 'owner' };
}

/** Profiles the owner has discussions about (for the owner's inbox). */
export async function discussionTargets(auth: AuthContext): Promise<{ profile: ProfileCard; lastAt: string; count: number }[]> {
  const profileId = requireOwner(auth);
  const { data } = await db().from('family_discussions').select('target_profile_id, created_at').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(500);
  const agg = new Map<string, { lastAt: string; count: number }>();
  for (const d of data ?? []) {
    const e = agg.get(d.target_profile_id);
    if (e) e.count++; else agg.set(d.target_profile_id, { lastAt: d.created_at, count: 1 });
  }
  const cards = await ownerCards(profileId, [...agg.keys()]);
  return [...agg.entries()].flatMap(([id, v]) => (cards.get(id) ? [{ profile: cards.get(id)!, ...v }] : []));
}
