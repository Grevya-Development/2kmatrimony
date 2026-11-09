import { afterAll, describe, expect, it } from 'vitest';
import type { BeforeYouMeetBriefing, ConnectionOverview, GapAnalysis, InsightEnvelope, JournalEntry, MeetingPlan, VisionItem, VisionThemes } from '@2k/shared';
import { GET as overview } from '@/app/api/v1/connections/[id]/route';
import { GET as getInsight, POST as genInsight } from '@/app/api/v1/connections/[id]/insights/route';
import { GET as listVision, POST as addVision } from '@/app/api/v1/connections/[id]/vision/route';
import { DELETE as delVision, PATCH as patchVision } from '@/app/api/v1/connections/[id]/vision/[itemId]/route';
import { POST as themes } from '@/app/api/v1/connections/[id]/vision/themes/route';
import { GET as listJournal, POST as addJournal } from '@/app/api/v1/connections/[id]/journal/route';
import { DELETE as delJournal, PATCH as patchJournal } from '@/app/api/v1/connections/[id]/journal/[entryId]/route';
import { GET as listMeetings, POST as propose } from '@/app/api/v1/connections/[id]/meetings/route';
import { PATCH as patchMeeting } from '@/app/api/v1/connections/[id]/meetings/[meetingId]/route';
import { GET as famView } from '@/app/api/v1/family/of/[profileId]/route';
import { admin, call, createTestUser, request } from './helpers';
import { cleanupCreated, connect, createMember, givePlan, trackUser } from './ai-fixtures';

afterAll(cleanupCreated);

async function setup() {
  const a = await createMember({ label: 'cia', gender: 'female', seeking: 'male', settle: 'abroad', interests: ['Travel', 'Reading'] });
  const b = await createMember({ label: 'cib', gender: 'male', seeking: 'female', settle: 'current_city', interests: ['Reading', 'Cricket'] });
  const { connectionId, conversationId } = await connect(a, b);
  return { a, b, connectionId, conversationId };
}

describe('connection overview', () => {
  it('members see the other person, compatibility and feature availability; strangers get 404', async () => {
    const { a, b, connectionId, conversationId } = await setup();
    const r = await call<ConnectionOverview>(overview, request(`/api/v1/connections/${connectionId}`, { token: a.user.token }), { id: connectionId });
    expect(r.status).toBe(200);
    expect(r.body.data?.other.id).toBe(b.profileId);
    expect(r.body.data?.conversationId).toBe(conversationId);
    expect(r.body.data?.explanation?.dimensions).toHaveLength(9);
    expect(r.body.data?.features).toMatchObject({ gapAnalysis: true, beforeYouMeet: true, visionBoard: true, journal: true, aiAvailable: false }); // everything is free
    const stranger = await createMember({ label: 'cis', gender: 'male', seeking: 'female' });
    expect((await call(overview, request(`/api/v1/connections/${connectionId}`, { token: stranger.user.token }), { id: connectionId })).status).toBe(404);
  });
});

describe('gap analysis & before you meet', () => {
  it('is free for every member and generates an engine insight visible to both members', async () => {
    const { a, b, connectionId } = await setup();
    const url = (k: string) => `/api/v1/connections/${connectionId}/insights?kind=${k}`;
    const g = await call<InsightEnvelope<GapAnalysis>>(genInsight, request(url('gap_analysis'), { method: 'POST', token: a.user.token }), { id: connectionId });
    expect(g.status).toBe(200);
    expect(g.body.data?.generator).toBe('engine');
    expect(g.body.data?.content.differences.map((d) => d.topic)).toContain('Where to settle');
    expect(g.body.data?.content.alignments.length).toBeGreaterThan(0);
    const seen = await call<InsightEnvelope<GapAnalysis>>(getInsight, request(url('gap_analysis'), { token: b.user.token }), { id: connectionId });
    expect(seen.body.data?.id).toBe(g.body.data?.id);

    const bym = await call<InsightEnvelope<BeforeYouMeetBriefing>>(genInsight, request(url('before_you_meet'), { method: 'POST', token: a.user.token }), { id: connectionId });
    expect(bym.status).toBe(200);
    expect(bym.body.data?.content.sharedInterests).toEqual(['Reading']);
    expect(bym.body.data?.content.conversationStarters).toHaveLength(5);
    expect((await call(getInsight, request(url('bogus'), { token: a.user.token }), { id: connectionId })).status).toBe(422);
  });

  it('closed connections cannot generate new insights', async () => {
    const { a, connectionId } = await setup();
    await givePlan(a, 'premium');
    await admin().from('connections').update({ status: 'closed' }).eq('id', connectionId);
    expect((await call(genInsight, request(`/api/v1/connections/${connectionId}/insights?kind=gap_analysis`, { method: 'POST', token: a.user.token }), { id: connectionId })).status).toBe(409);
  });
});

describe('vision board', () => {
  it('items are private until shared; only authors edit; themes use shared items', async () => {
    const { a, b, connectionId } = await setup();
    const add = await call<VisionItem>(addVision, request(`/api/v1/connections/${connectionId}/vision`, { token: a.user.token, body: { category: 'travel', content: 'See the northern lights', isShared: false } }), { id: connectionId });
    expect(add.status).toBe(200);
    const itemId = add.body.data!.id;
    const bList = await call<{ items: VisionItem[] }>(listVision, request(`/api/v1/connections/${connectionId}/vision`, { token: b.user.token }), { id: connectionId });
    expect(bList.body.data?.items).toEqual([]);
    expect((await call(patchVision, request(`/api/v1/connections/${connectionId}/vision/${itemId}`, { method: 'PATCH', token: b.user.token, body: { isShared: true } }), { id: connectionId, itemId })).status).toBe(404);
    await call(patchVision, request(`/api/v1/connections/${connectionId}/vision/${itemId}`, { method: 'PATCH', token: a.user.token, body: { isShared: true } }), { id: connectionId, itemId });
    await call(addVision, request(`/api/v1/connections/${connectionId}/vision`, { token: b.user.token, body: { category: 'travel', content: 'A month in Kerala backwaters', isShared: true } }), { id: connectionId });
    const bList2 = await call<{ items: VisionItem[] }>(listVision, request(`/api/v1/connections/${connectionId}/vision`, { token: b.user.token }), { id: connectionId });
    expect(bList2.body.data?.items.map((i) => [i.isMine, i.isShared])).toEqual([[false, true], [true, true]]);
    const t = await call<InsightEnvelope<VisionThemes>>(themes, request(`/api/v1/connections/${connectionId}/vision/themes`, { method: 'POST', token: a.user.token }), { id: connectionId });
    expect(t.body.data?.content.commonThemes[0]).toMatch(/travel/i);
    expect((await call(delVision, request(`/api/v1/connections/${connectionId}/vision/${itemId}`, { method: 'DELETE', token: a.user.token }), { id: connectionId, itemId })).status).toBe(200);
  });
});

describe('compatibility journal', () => {
  it('is private to its author', async () => {
    const { a, b, connectionId } = await setup();
    const e = await call<JournalEntry>(addJournal, request(`/api/v1/connections/${connectionId}/journal`, { token: a.user.token, body: { kind: 'question_remaining', content: 'Ask about relocation timelines' } }), { id: connectionId });
    expect(e.status).toBe(200);
    expect((await call<JournalEntry[]>(listJournal, request(`/api/v1/connections/${connectionId}/journal`, { token: b.user.token }), { id: connectionId })).body.data).toEqual([]);
    const id = e.body.data!.id;
    expect((await call(patchJournal, request(`/api/v1/connections/${connectionId}/journal/${id}`, { method: 'PATCH', token: b.user.token, body: { resolved: true } }), { id: connectionId, entryId: id })).status).toBe(404);
    const p = await call<JournalEntry>(patchJournal, request(`/api/v1/connections/${connectionId}/journal/${id}`, { method: 'PATCH', token: a.user.token, body: { resolved: true } }), { id: connectionId, entryId: id });
    expect(p.body.data?.resolved).toBe(true);
    expect((await call(delJournal, request(`/api/v1/connections/${connectionId}/journal/${id}`, { method: 'DELETE', token: a.user.token }), { id: connectionId, entryId: id })).status).toBe(200);
  });
});

describe('meetings', () => {
  it('propose → other member accepts; proposer cannot accept; family coordinators can view and propose', async () => {
    const { a, b, connectionId } = await setup();
    const when = new Date(Date.now() + 3 * 86400_000).toISOString();
    const m = await call<MeetingPlan>(propose, request(`/api/v1/connections/${connectionId}/meetings`, { token: a.user.token, body: { title: 'Coffee', proposedAt: when, locationText: 'Café near the lake' } }), { id: connectionId });
    expect(m.status).toBe(200);
    const id = m.body.data!.id;
    expect((await call(patchMeeting, request(`/api/v1/connections/${connectionId}/meetings/${id}`, { method: 'PATCH', token: a.user.token, body: { status: 'accepted' } }), { id: connectionId, meetingId: id })).status).toBe(403);
    const acc = await call<MeetingPlan>(patchMeeting, request(`/api/v1/connections/${connectionId}/meetings/${id}`, { method: 'PATCH', token: b.user.token, body: { status: 'accepted' } }), { id: connectionId, meetingId: id });
    expect(acc.body.data?.status).toBe('accepted');
    expect((await call(propose, request(`/api/v1/connections/${connectionId}/meetings`, { token: a.user.token, body: { title: 'Past', proposedAt: '2020-01-01T10:00:00Z' } }), { id: connectionId })).status).toBe(422);

    const parent = await trackUser(await createTestUser('cimom'));
    await admin().from('family_members').insert({ profile_id: a.profileId, member_user_id: parent.userId, invited_contact: parent.email, relation: 'mother', permissions: ['view_profiles'], status: 'active' });
    expect((await call(listMeetings, request(`/api/v1/connections/${connectionId}/meetings`, { token: parent.token }), { id: connectionId })).status).toBe(404);
    await admin().from('family_members').update({ permissions: ['view_profiles', 'coordinate_meetings'] }).eq('member_user_id', parent.userId);
    const list = await call<MeetingPlan[]>(listMeetings, request(`/api/v1/connections/${connectionId}/meetings`, { token: parent.token }), { id: connectionId });
    expect(list.body.data?.map((x) => x.id)).toContain(id);
    const fv = await call<{ connections: { id: string; profile: { id: string } }[] }>(famView, request(`/api/v1/family/of/${a.profileId}`, { token: parent.token }), { profileId: a.profileId });
    expect(fv.body.data?.connections).toEqual([{ id: connectionId, profile: expect.objectContaining({ id: b.profileId }) }]);
    const fm = await call<MeetingPlan>(propose, request(`/api/v1/connections/${connectionId}/meetings`, { token: parent.token, body: { title: 'Families meet', proposedAt: when } }), { id: connectionId });
    expect(fm.body.data?.proposedByFamily).toBe(true);
    // family cannot accept on anyone's behalf
    expect((await call(patchMeeting, request(`/api/v1/connections/${connectionId}/meetings/${id}`, { method: 'PATCH', token: parent.token, body: { status: 'completed' } }), { id: connectionId, meetingId: id })).status).toBe(403);
  });
});
