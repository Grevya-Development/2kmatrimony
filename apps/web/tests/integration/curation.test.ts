import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type { MeResponse, RecommendationItem } from '@2k/shared';
import { GET as me } from '@/app/api/v1/me/route';
import { GET as recommendations } from '@/app/api/v1/recommendations/route';
import { PUT as putBasics } from '@/app/api/v1/profile/basics/route';
import { GET as screeningQueue } from '@/app/api/v1/admin/screening/route';
import { POST as screeningDecision } from '@/app/api/v1/admin/screening/[profileId]/route';
import { POST as introduce } from '@/app/api/v1/admin/introductions/route';
import { GET as introMembers } from '@/app/api/v1/admin/introductions/members/route';
import { GET as introWorkspace } from '@/app/api/v1/admin/introductions/[memberId]/route';
import { invalidateConfigCache } from '@/server/config';
import { admin, call, createTestUser, makeAdmin, request, type TestUser } from './helpers';
import { basics, cleanupCreated, completeRequired, startedUser } from './profile-helpers';
import { deleteUsers, seedMember, type SeededMember, uniqueCity } from './discovery.fixtures';

/**
 * Curation: every new profile is screened by a person; matchmakers hand-pick
 * introductions. Both are what the website promises, so both are tested here.
 */
const extra: TestUser[] = [];
const seeded: SeededMember[] = [];
afterAll(async () => {
  await cleanupCreated();
  await deleteUsers(seeded);
  for (const u of extra) {
    await admin().from('admin_users').delete().eq('user_id', u.userId);
    await admin().auth.admin.deleteUser(u.userId).catch(() => undefined);
  }
});

async function adminUser(role: string): Promise<TestUser> {
  const u = await createTestUser(`cur-${role}`);
  extra.push(u);
  await makeAdmin(u, role);
  return u;
}
const profileOf = async (userId: string) => (await admin().from('profiles').select('id, status, review_note, activated_at, review_submitted_at').eq('owner_user_id', userId).single()).data!;
const notificationTypes = async (userId: string) => ((await admin().from('notifications').select('type').eq('user_id', userId)).data ?? []).map((n) => n.type);

describe('human screening of new profiles', () => {
  it('completed profiles wait for review, cannot browse, and go live only when approved', async () => {
    const u = await startedUser('cur-scr-a');
    await completeRequired(u);
    const p = await profileOf(u.userId);
    expect(p.status).toBe('in_review');
    expect(p.review_submitted_at).not.toBeNull();
    expect(p.activated_at).toBeNull();

    const recs = await call(recommendations, request('/api/v1/recommendations', { token: u.token }));
    expect(recs.status).toBe(409); // browsing is only for live profiles
    const m = await call<MeResponse>(me, request('/api/v1/me', { token: u.token }));
    expect(m.body.data?.profile?.status).toBe('in_review');

    const moderator = await adminUser('moderator');
    const queue = await call<{ items: { profileId: string; waitingHours: number }[]; slaHours: number }>(screeningQueue, request('/api/v1/admin/screening', { token: moderator.token }));
    expect(queue.status).toBe(200);
    expect(queue.body.data?.slaHours).toBe(24);
    expect(queue.body.data?.items.some((i) => i.profileId === p.id)).toBe(true);

    const ok = await call<{ status: string }>(screeningDecision, request(`/api/v1/admin/screening/${p.id}`, { token: moderator.token, body: { action: 'approve', approvePhotos: true } }), { profileId: p.id });
    expect(ok.status).toBe(200);
    expect(ok.body.data?.status).toBe('active');
    const after = await profileOf(u.userId);
    expect(after.status).toBe('active');
    expect(after.activated_at).not.toBeNull();
    expect(await notificationTypes(u.userId)).toContain('profile_approved');
    const { count } = await admin().from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'admin.profile.screening.approve').eq('entity_id', p.id);
    expect(count).toBe(1);

    // Deciding twice is refused.
    expect((await call(screeningDecision, request(`/api/v1/admin/screening/${p.id}`, { token: moderator.token, body: { action: 'approve' } }), { profileId: p.id })).status).toBe(409);
  });

  it('requesting changes sends the profile back with a note, and editing resubmits it', async () => {
    const u = await startedUser('cur-scr-b');
    await completeRequired(u);
    const p = await profileOf(u.userId);
    const moderator = await adminUser('moderator');
    const short = await call(screeningDecision, request(`/api/v1/admin/screening/${p.id}`, { token: moderator.token, body: { action: 'request_changes', note: 'meh' } }), { profileId: p.id });
    expect(short.status).toBe(422);

    const note = 'Please add a clear photo of yourself and a few lines about your family.';
    const r = await call(screeningDecision, request(`/api/v1/admin/screening/${p.id}`, { token: moderator.token, body: { action: 'request_changes', note } }), { profileId: p.id });
    expect(r.status).toBe(200);
    const back = await profileOf(u.userId);
    expect(back.status).toBe('draft');
    expect(back.review_note).toBe(note);
    expect(await notificationTypes(u.userId)).toContain('profile_changes_requested');
    const m = await call<MeResponse>(me, request('/api/v1/me', { token: u.token }));
    expect(m.body.data?.profile?.reviewNote).toBe(note);

    // The member updates their profile → it returns to the queue, note cleared.
    const edit = await call(putBasics, request('/api/v1/profile/basics', { token: u.token, method: 'PUT', body: { ...basics, about: `${basics.about} My family runs a small bakery in Mysuru.` } }));
    expect(edit.status).toBe(200);
    const resubmitted = await profileOf(u.userId);
    expect(resubmitted.status).toBe('in_review');
    expect(resubmitted.review_note).toBeNull();
  });

  it('only reviewers can see the queue or decide', async () => {
    const member = await startedUser('cur-scr-c');
    const support = await adminUser('support'); // no profiles.moderate
    expect((await call(screeningQueue, request('/api/v1/admin/screening', { token: member.token }))).status).toBe(403);
    expect((await call(screeningQueue, request('/api/v1/admin/screening', { token: support.token }))).status).toBe(403);
    const p = await profileOf(member.userId);
    expect((await call(screeningDecision, request(`/api/v1/admin/screening/${p.id}`, { token: support.token, body: { action: 'approve' } }), { profileId: p.id })).status).toBe(403);
  });

  it('when screening is switched off, complete profiles go live immediately', async () => {
    const { data: original } = await admin().from('platform_settings').select('value').eq('key', 'curation').single();
    await admin().from('platform_settings').update({ value: { profile_screening: false, screening_sla_hours: 24 } }).eq('key', 'curation');
    invalidateConfigCache();
    try {
      const u = await startedUser('cur-scr-off');
      await completeRequired(u);
      expect((await profileOf(u.userId)).status).toBe('active');
    } finally {
      await admin().from('platform_settings').update({ value: original!.value }).eq('key', 'curation');
      invalidateConfigCache();
    }
  });
});

describe('hand-picked introductions', () => {
  it('a matchmaker introduces a candidate with a note; the member sees it first', async () => {
    const city = uniqueCity();
    const tag = randomUUID().slice(0, 5);
    const memberName = `Kavya${tag}`;
    const member = await seedMember({ label: 'cur-int-m', gender: 'female', seeking: 'male', city, firstName: memberName });
    const pick = await seedMember({ label: 'cur-int-c1', gender: 'male', seeking: 'female', city, firstName: `Arjun${tag}` });
    const other = await seedMember({ label: 'cur-int-c2', gender: 'male', seeking: 'female', city, firstName: `Rahul${tag}` });
    const sameGender = await seedMember({ label: 'cur-int-x', gender: 'female', seeking: 'male', city, firstName: `Meera${tag}` });
    seeded.push(member, pick, other, sameGender);
    const matchmaker = await adminUser('matchmaker');

    const found = await call<{ profileId: string }[]>(introMembers, request(`/api/v1/admin/introductions/members?q=${memberName}`, { token: matchmaker.token }));
    expect(found.status).toBe(200);
    expect(found.body.data?.map((x) => x.profileId)).toContain(member.profileId);

    const ws = await call<{ candidates: { profileId: string; mutual: number }[]; recent: unknown[] }>(introWorkspace, request(`/api/v1/admin/introductions/${member.profileId}`, { token: matchmaker.token }), { memberId: member.profileId });
    expect(ws.status).toBe(200);
    const ids = ws.body.data!.candidates.map((c) => c.profileId);
    expect(ids).toContain(pick.profileId);
    expect(ids).not.toContain(sameGender.profileId); // never someone outside their preferences

    const note = 'You both grew up in the same city and love classical music — I think you would enjoy talking.';
    expect((await call(introduce, request('/api/v1/admin/introductions', { token: matchmaker.token, body: { memberProfileId: member.profileId, candidateProfileId: pick.profileId, note: 'too short' } }))).status).toBe(422);
    expect((await call(introduce, request('/api/v1/admin/introductions', { token: matchmaker.token, body: { memberProfileId: member.profileId, candidateProfileId: sameGender.profileId, note } }))).status).toBe(409);
    const sent = await call<{ id: string; mutual: number }>(introduce, request('/api/v1/admin/introductions', { token: matchmaker.token, body: { memberProfileId: member.profileId, candidateProfileId: pick.profileId, note } }));
    expect(sent.status).toBe(201);
    expect(await notificationTypes(member.userId)).toContain('introduction_received');

    const recs = await call<RecommendationItem[]>(recommendations, request('/api/v1/recommendations', { token: member.token }));
    expect(recs.status).toBe(200);
    const first = recs.body.data![0]!;
    expect(first.source).toBe('matchmaker');
    expect(first.profile.id).toBe(pick.profileId);
    expect(first.reason).toBe(note);
    // Engine suggestions still arrive alongside, without duplicating the pick.
    expect(recs.body.data!.filter((r) => r.profile.id === pick.profileId)).toHaveLength(1);
    expect(recs.body.data!.some((r) => r.source === 'engine' && r.profile.id === other.profileId)).toBe(true);

    const after = await call<{ recent: { candidate: { profileId: string }; note: string }[] }>(introWorkspace, request(`/api/v1/admin/introductions/${member.profileId}`, { token: matchmaker.token }), { memberId: member.profileId });
    expect(after.body.data?.recent[0]?.candidate.profileId).toBe(pick.profileId);
  });

  it('only matchmakers can make introductions', async () => {
    const city = uniqueCity();
    const a = await seedMember({ label: 'cur-int-pa', gender: 'female', seeking: 'male', city });
    const b = await seedMember({ label: 'cur-int-pb', gender: 'male', seeking: 'female', city });
    seeded.push(a, b);
    const support = await adminUser('support');
    const body = { memberProfileId: a.profileId, candidateProfileId: b.profileId, note: 'A thoughtful note that is long enough to pass validation.' };
    expect((await call(introduce, request('/api/v1/admin/introductions', { token: a.token, body }))).status).toBe(403);
    expect((await call(introduce, request('/api/v1/admin/introductions', { token: support.token, body }))).status).toBe(403);
    expect((await call(introWorkspace, request(`/api/v1/admin/introductions/${a.profileId}`, { token: support.token }), { memberId: a.profileId })).status).toBe(403);
  });
});

describe('free platform', () => {
  it('a member without any subscription has every feature', async () => {
    const u = await createTestUser('cur-free');
    extra.push(u);
    const r = await call<MeResponse>(me, request('/api/v1/me', { token: u.token }));
    expect(r.body.data?.plan.code).toBe('free');
    expect(r.body.data?.plan.entitlements).toMatchObject({ advanced_filters: true, ai_insights: 'full', see_who_viewed: true, gap_analysis: true, before_you_meet: true, curated_introductions: true, human_matchmaker: true });
    expect(r.body.data?.featureFlags.payments).toBe(false);
  });
});
