import { afterAll, describe, expect, it } from 'vitest';
import type { FamilyDiscussionItem, FamilyMemberItem, FamilySuggestionItem, ProfileCard } from '@2k/shared';
import { GET as ownerView, POST as invite } from '@/app/api/v1/family/route';
import { DELETE as revoke, PATCH as patchMember } from '@/app/api/v1/family/[memberId]/route';
import { POST as accept } from '@/app/api/v1/family/accept/route';
import { GET as memberView } from '@/app/api/v1/family/of/[profileId]/route';
import { POST as famShortlist } from '@/app/api/v1/family/of/[profileId]/shortlist/route';
import { POST as suggest } from '@/app/api/v1/family/suggestions/route';
import { PATCH as patchSuggestion } from '@/app/api/v1/family/suggestions/[id]/route';
import { GET as listDisc, POST as postDisc } from '@/app/api/v1/family/discussions/route';
import { admin, call, createTestUser, request } from './helpers';
import { cleanupCreated, createMember, trackUser } from './ai-fixtures';

afterAll(cleanupCreated);

type OwnerPayload = { members: FamilyMemberItem[]; suggestions: FamilySuggestionItem[]; discussions: { profile: ProfileCard }[] };
type MemberPayload = { owner: { profileId: string }; permissions: string[]; recommendations: ProfileCard[]; shortlist: { profile: ProfileCard; addedByMe: boolean }[] };

describe('family collaboration', () => {
  it('invite → accept → permissions → shortlist/suggest/discuss → revoke', async () => {
    const owner = await createMember({ label: 'fown', gender: 'female', seeking: 'male' });
    const candidate = await createMember({ label: 'fcand', gender: 'male', seeking: 'female' });
    const parent = await trackUser(await createTestUser('fmom'));

    const inv = await call<{ member: FamilyMemberItem; inviteLink: string; delivered: boolean }>(invite, request('/api/v1/family', { token: owner.user.token, body: { contact: parent.email, relation: 'mother', displayName: 'Amma', permissions: ['view_profiles'] } }));
    expect(inv.status).toBe(200);
    expect(inv.body.data?.delivered).toBe(false); // email provider not configured locally
    expect(inv.body.data?.member.invitedContact).not.toBe(parent.email); // masked
    const token = new URL(inv.body.data!.inviteLink).searchParams.get('token')!;
    expect(token.length).toBeGreaterThan(30);
    const { data: consent } = await admin().from('consent_records').select('consent_type').eq('user_id', owner.user.userId).eq('consent_type', 'family_access');
    expect(consent?.length).toBe(1);
    expect((await call(invite, request('/api/v1/family', { token: owner.user.token, body: { contact: parent.email, relation: 'mother', permissions: ['view_profiles'] } }))).status).toBe(409);

    // Owner cannot accept their own invitation; the invitee can, exactly once.
    expect((await call(accept, request('/api/v1/family/accept', { token: owner.user.token, body: { token } }))).status).toBe(422);
    const acc = await call<{ profileId: string }>(accept, request('/api/v1/family/accept', { token: parent.token, body: { token, acceptTerms: true } }));
    expect(acc.status).toBe(200);
    expect(acc.body.data?.profileId).toBe(owner.profileId);
    expect((await call(accept, request('/api/v1/family/accept', { token: parent.token, body: { token } }))).status).toBe(404);
    const { data: parentConsents } = await admin().from('consent_records').select('consent_type').eq('user_id', parent.userId);
    expect(parentConsents?.map((c) => c.consent_type).sort()).toEqual(['privacy', 'terms']);

    const ov = await call<OwnerPayload>(ownerView, request('/api/v1/family', { token: owner.user.token }));
    const memberId = ov.body.data!.members[0]!.id;
    expect(ov.body.data?.members[0]?.status).toBe('active');

    // Recommendations appear from the OWNER's perspective.
    await admin().from('recommendations').insert({ profile_id: owner.profileId, candidate_profile_id: candidate.profileId, score: 80 });
    const mv = await call<MemberPayload>(memberView, request(`/api/v1/family/of/${owner.profileId}`, { token: parent.token }), { profileId: owner.profileId });
    expect(mv.status).toBe(200);
    expect(mv.body.data?.recommendations.map((c) => c.id)).toEqual([candidate.profileId]);

    // Without permission: forbidden.
    expect((await call(famShortlist, request(`/api/v1/family/of/${owner.profileId}/shortlist`, { token: parent.token, body: { targetProfileId: candidate.profileId } }), { profileId: owner.profileId })).status).toBe(403);
    expect((await call(suggest, request('/api/v1/family/suggestions', { token: parent.token, body: { profileId: owner.profileId, targetProfileId: candidate.profileId } }))).status).toBe(403);

    await call(patchMember, request(`/api/v1/family/${memberId}`, { method: 'PATCH', token: owner.user.token, body: { permissions: ['view_profiles', 'shortlist', 'suggest_matches', 'discuss'] } }), { memberId });
    expect((await call(famShortlist, request(`/api/v1/family/of/${owner.profileId}/shortlist`, { token: parent.token, body: { targetProfileId: candidate.profileId, note: 'Lovely family' } }), { profileId: owner.profileId })).status).toBe(200);
    const { data: sl } = await admin().from('shortlists').select('added_by_user_id').eq('owner_profile_id', owner.profileId).single();
    expect(sl?.added_by_user_id).toBe(parent.userId);

    const sg = await call<{ id: string }>(suggest, request('/api/v1/family/suggestions', { token: parent.token, body: { profileId: owner.profileId, targetProfileId: candidate.profileId, note: 'Please take a look' } }));
    expect(sg.status).toBe(200);
    const inbox = await call<OwnerPayload>(ownerView, request('/api/v1/family', { token: owner.user.token }));
    expect(inbox.body.data?.suggestions[0]).toMatchObject({ note: 'Please take a look', suggestedBy: { name: 'Amma' } });
    expect(inbox.body.data?.suggestions[0]?.profile?.id).toBe(candidate.profileId);
    const { data: notif } = await admin().from('notifications').select('type').eq('user_id', owner.user.userId);
    expect(notif?.map((n) => n.type)).toEqual(expect.arrayContaining(['family_invite_accepted', 'family_suggestion']));
    expect((await call(patchSuggestion, request(`/api/v1/family/suggestions/${sg.body.data!.id}`, { method: 'PATCH', token: owner.user.token, body: { status: 'dismissed' } }), { id: sg.body.data!.id })).status).toBe(200);

    await call(postDisc, request('/api/v1/family/discussions', { token: parent.token, body: { profileId: owner.profileId, targetProfileId: candidate.profileId, body: 'What did you think of his travel plans?' } }));
    await call(postDisc, request('/api/v1/family/discussions', { token: owner.user.token, body: { targetProfileId: candidate.profileId, body: 'I like that he reads a lot.' } }));
    const disc = await call<FamilyDiscussionItem[]>(listDisc, request(`/api/v1/family/discussions?targetProfileId=${candidate.profileId}`, { token: owner.user.token }));
    expect(disc.body.data?.map((d) => [d.authorName, d.isOwner, d.isMine])).toEqual([['Amma', false, false], ['fown', true, true]]);

    // Family can never act as the owner: no interest/message endpoints accept them (they have no profile).
    // Revoke removes all access.
    expect((await call(revoke, request(`/api/v1/family/${memberId}`, { method: 'DELETE', token: owner.user.token }), { memberId })).status).toBe(200);
    expect((await call(memberView, request(`/api/v1/family/of/${owner.profileId}`, { token: parent.token }), { profileId: owner.profileId })).status).toBe(404);
  });

  it('rejects expired invitations and regenerates links', async () => {
    const owner = await createMember({ label: 'fown2', gender: 'male', seeking: 'female' });
    const relative = await trackUser(await createTestUser('frel'));
    const inv = await call<{ member: FamilyMemberItem; inviteLink: string }>(invite, request('/api/v1/family', { token: owner.user.token, body: { contact: '9876543210', relation: 'brother', permissions: ['view_profiles'] } }));
    const token = new URL(inv.body.data!.inviteLink).searchParams.get('token')!;
    await admin().from('family_members').update({ invite_expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', inv.body.data!.member.id);
    expect((await call(accept, request('/api/v1/family/accept', { token: relative.token, body: { token } }))).status).toBe(409);
    const regen = await call<{ inviteLink: string }>(patchMember, request(`/api/v1/family/${inv.body.data!.member.id}`, { method: 'PATCH', token: owner.user.token, body: { regenerateInvite: true } }), { memberId: inv.body.data!.member.id });
    const token2 = new URL(regen.body.data!.inviteLink).searchParams.get('token')!;
    expect(token2).not.toBe(token);
    expect((await call(accept, request('/api/v1/family/accept', { token: relative.token, body: { token } }))).status).toBe(404);
    expect((await call(accept, request('/api/v1/family/accept', { token: relative.token, body: { token: token2 } }))).status).toBe(200);
    expect((await call(invite, request('/api/v1/family', { token: owner.user.token, body: { contact: 'not-a-contact', relation: 'brother', permissions: ['view_profiles'] } }))).status).toBe(422);
  });
});
