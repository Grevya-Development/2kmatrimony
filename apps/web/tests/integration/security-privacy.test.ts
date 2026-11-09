import { afterAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { MatchExplanation, ProfileCard } from '@2k/shared';
import { GET as explanation } from '@/app/api/v1/profiles/[id]/explanation/route';
import { GET as profileView } from '@/app/api/v1/profiles/[id]/route';
import { POST as search } from '@/app/api/v1/search/route';
import { POST as smartSearch } from '@/app/api/v1/search/smart/route';
import { PUT as saveBasics } from '@/app/api/v1/profile/basics/route';
import { DELETE as deletePhoto } from '@/app/api/v1/profile/photos/[id]/route';
import { POST as block } from '@/app/api/v1/blocks/route';
import { GET as listMessages, POST as sendMessage } from '@/app/api/v1/conversations/[id]/messages/route';
import { GET as connectionOverview } from '@/app/api/v1/connections/[id]/route';
import { POST as addVision } from '@/app/api/v1/connections/[id]/vision/route';
import { PATCH as updateVision } from '@/app/api/v1/connections/[id]/vision/[itemId]/route';
import { POST as closeConnection } from '@/app/api/v1/connections/[id]/close/route';
import { createConnection } from '@/server/connections/service';
import { scoreCandidates } from '@/server/matching/service';
import { loadBundles } from '@/server/profiles/load';
import { admin, call, createTestUser, request, type TestUser } from './helpers';
import { deleteUsers, seedMember, uniqueCity, type SeededMember } from './discovery.fixtures';

/** Security regression tests for audit findings H1, M5, M4, L1, L2, L3. */
const created: (SeededMember | TestUser)[] = [];
afterAll(async () => deleteUsers(created));

async function pair(city = uniqueCity()) {
  const attacker = await seedMember({ label: 'sec-att', gender: 'female', seeking: 'male', city });
  const target = await seedMember({ label: 'sec-tgt', gender: 'male', seeking: 'female', city });
  created.push(attacker, target);
  return { attacker, target, city };
}

const setPrefs = (profileId: string, patch: Record<string, unknown>) =>
  admin().from('partner_preferences').update({ religions: [], min_income_range: null, non_negotiables: [], ...patch }).eq('profile_id', profileId);

describe('H1: hidden religion/income cannot be inferred from scores or explanations', () => {
  it('explanation, search compatibility and recommendation eligibility are identical whatever the viewer probes', async () => {
    const { attacker, target, city } = await pair();
    // Target hides sensitive fields from non-connections (the default) and has a religion + high income.
    await admin().from('profiles').update({ religion: 'Hindu', sensitive_fields_visibility: 'connections' }).eq('id', target.profileId);
    await admin().from('profile_career').update({ income_range: '25_50l', income_visibility: 'connections' }).eq('profile_id', target.profileId);

    const probes: Record<string, unknown>[] = [
      {},
      { religions: ['Hindu'] },
      { religions: ['Muslim'] },
      { religions: ['Muslim'], non_negotiables: ['religion'] },
      { min_income_range: 'gt_1cr' },
      { min_income_range: 'lt_3l' },
    ];
    const snapshots: string[] = [];
    for (const probe of probes) {
      await setPrefs(attacker.profileId, probe);
      const ex = await call<MatchExplanation>(explanation, request(`/api/v1/profiles/${target.profileId}/explanation`, { token: attacker.token }), { id: target.profileId });
      expect(ex.status).toBe(200);
      const { computedAt: _c, ...exStable } = ex.body.data!;
      const text = JSON.stringify(exStable).toLowerCase();
      expect(text).not.toContain('religion');
      expect(text).not.toContain('income');

      const res = await call<{ items: ProfileCard[] }>(search, request('/api/v1/search', { token: attacker.token, body: { filters: { cities: [city] }, sort: 'compatibility', limit: 20 } }));
      expect(res.status).toBe(200);
      const card = res.body.data!.items.find((c) => c.id === target.profileId);
      expect(card).toBeDefined();

      const bundles = await loadBundles([attacker.profileId, target.profileId]);
      const scored = (await scoreCandidates(bundles.get(attacker.profileId)!, [bundles.get(target.profileId)!])).get(target.profileId)!;

      snapshots.push(JSON.stringify({ ex: exStable, compat: card!.compatibility, eligible: scored.eligible, recommended: scored.recommended, mutual: scored.mutual, confidence: scored.confidence }));
    }
    expect(new Set(snapshots).size).toBe(1);
  });

  it('visible fields still count once connected', async () => {
    const { attacker, target } = await pair();
    await admin().from('profiles').update({ religion: 'Hindu', sensitive_fields_visibility: 'connections' }).eq('id', target.profileId);
    await setPrefs(attacker.profileId, { religions: ['Muslim'], non_negotiables: ['religion'] });
    await createConnection(attacker.profileId, target.profileId, null);
    const bundles = await loadBundles([attacker.profileId, target.profileId]);
    const scored = (await scoreCandidates(bundles.get(attacker.profileId)!, [bundles.get(target.profileId)!])).get(target.profileId)!;
    expect(scored.eligible).toBe(false);
  });
});

describe('M5: search filters ignore values hidden from members', () => {
  it('religion filter only matches members who show religion to everyone', async () => {
    const { attacker, target, city } = await pair();
    await admin().from('profiles').update({ religion: 'Hindu', sensitive_fields_visibility: 'connections' }).eq('id', target.profileId);
    const find = async (religions: string[]) => {
      const r = await call<{ items: ProfileCard[] }>(search, request('/api/v1/search', { token: attacker.token, body: { filters: { cities: [city], religions }, sort: 'relevance', limit: 20 } }));
      expect(r.status).toBe(200);
      return r.body.data!.items.some((c) => c.id === target.profileId);
    };
    // Hidden: excluded for the right AND the wrong value — no signal.
    expect(await find(['Hindu'])).toBe(false);
    expect(await find(['Muslim'])).toBe(false);
    await admin().from('profiles').update({ sensitive_fields_visibility: 'members' }).eq('id', target.profileId);
    expect(await find(['Hindu'])).toBe(true);
    expect(await find(['Muslim'])).toBe(false);
  });

  it('income filter only matches incomes visible to all members', async () => {
    const { attacker, target } = await pair();
    await admin().from('profile_career').update({ income_range: '25_50l', income_visibility: 'connections' }).eq('profile_id', target.profileId);
    const ids = async () => {
      const { data } = await admin().rpc('search_profile_ids', { p_viewer: attacker.profileId, p_filters: { minIncomeRange: '10_15l' } as never, p_limit: 500 });
      return (data ?? []).map((r) => r.profile_id);
    };
    expect(await ids()).not.toContain(target.profileId);
    await admin().from('profiles').update({ sensitive_fields_visibility: 'members' }).eq('id', target.profileId);
    await admin().from('profile_career').update({ income_visibility: 'members' }).eq('profile_id', target.profileId);
    expect(await ids()).toContain(target.profileId);
  });
});

describe('M4: verified badges are withdrawn when the verified details change', () => {
  it('changing name clears the ID badge and expires the verification', async () => {
    const m = await seedMember({ label: 'sec-idv', gender: 'female', seeking: 'male', verified: true });
    created.push(m);
    const { data: v } = await admin().from('verifications').insert({ profile_id: m.profileId, kind: 'government_id', status: 'approved', reviewed_at: new Date().toISOString() }).select('id').single();
    const body = { firstName: 'Different', lastName: 'Test', nameVisibility: 'first_name', dateOfBirth: '1996-05-10', gender: 'female', maritalStatus: 'never_married', languages: [], currentCity: 'Bengaluru', currentCountry: 'IN' };
    const r = await call(saveBasics, request('/api/v1/profile/basics', { method: 'PUT', token: m.token, body }));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const { data: p } = await admin().from('profiles').select('is_identity_verified').eq('id', m.profileId).single();
    expect(p?.is_identity_verified).toBe(false);
    const { data: vv } = await admin().from('verifications').select('status').eq('id', v!.id).single();
    expect(vv?.status).toBe('expired');
    const { data: ev } = await admin().from('verification_events').select('to_status').eq('verification_id', v!.id);
    expect(ev?.map((e) => e.to_status)).toContain('expired');
  });

  it('editing non-identity fields keeps the ID badge', async () => {
    const m = await seedMember({ label: 'sec-idk', gender: 'female', seeking: 'male', verified: true });
    created.push(m);
    const body = { firstName: (await admin().from('profiles').select('first_name').eq('id', m.profileId).single()).data!.first_name!, lastName: 'Test', nameVisibility: 'first_name', dateOfBirth: '1996-05-10', gender: 'female', maritalStatus: 'never_married', languages: ['English'], currentCity: 'Mysuru', currentCountry: 'IN' };
    expect((await call(saveBasics, request('/api/v1/profile/basics', { method: 'PUT', token: m.token, body }))).status).toBe(200);
    const { data: p } = await admin().from('profiles').select('is_identity_verified').eq('id', m.profileId).single();
    expect(p?.is_identity_verified).toBe(true);
  });

  it('removing a photo clears the photo badge', async () => {
    const m = await seedMember({ label: 'sec-phv', gender: 'female', seeking: 'male' });
    created.push(m);
    await admin().from('profiles').update({ is_photo_verified: true }).eq('id', m.profileId);
    await admin().from('verifications').insert({ profile_id: m.profileId, kind: 'photo', status: 'approved', reviewed_at: new Date().toISOString() });
    const { data: ph } = await admin().from('profile_photos').insert({ profile_id: m.profileId, storage_path: `${m.profileId}/x.jpg`, is_primary: true, moderation_status: 'approved' }).select('id').single();
    expect((await call(deletePhoto, request(`/api/v1/profile/photos/${ph!.id}`, { method: 'DELETE', token: m.token }), { id: ph!.id })).status).toBe(200);
    const { data: p } = await admin().from('profiles').select('is_photo_verified').eq('id', m.profileId).single();
    expect(p?.is_photo_verified).toBe(false);
  });
});

describe('L1: draft (never-activated) profiles cannot browse other members', () => {
  it('rejects profile view and smart search', async () => {
    const target = await seedMember({ label: 'sec-l1t', gender: 'male', seeking: 'female' });
    const draftUser = await createTestUser('sec-draft');
    created.push(target, draftUser);
    await admin().from('profiles').insert({ owner_user_id: draftUser.userId, status: 'draft' });
    const v = await call(profileView, request(`/api/v1/profiles/${target.profileId}`, { token: draftUser.token }), { id: target.profileId });
    expect(v.status).toBe(409);
    expect(v.body.error?.code).toBe('profile_incomplete');
    const s = await call(smartSearch, request('/api/v1/search/smart', { token: draftUser.token, body: { query: 'engineers in Bengaluru' } }));
    expect(s.status).toBe(409);
  });
});

describe('L2/L3: blocking fully separates members', () => {
  it('blocked member loses message history, sending, connection views and realtime access', async () => {
    const { attacker: a, target: b } = await pair();
    const { connectionId, conversationId } = await createConnection(a.profileId, b.profileId, null);
    expect((await call(sendMessage, request(`/api/v1/conversations/${conversationId}/messages`, { token: a.token, body: { clientId: `sec-${a.userId.slice(0, 8)}`, kind: 'text', body: 'hello' } }), { id: conversationId })).status).toBeLessThan(300);

    expect((await call(block, request('/api/v1/blocks', { token: b.token, body: { targetProfileId: a.profileId } }))).status).toBeLessThan(300);

    expect((await call(listMessages, request(`/api/v1/conversations/${conversationId}/messages`, { token: a.token }), { id: conversationId })).status).toBe(404);
    expect((await call(sendMessage, request(`/api/v1/conversations/${conversationId}/messages`, { token: a.token, body: { clientId: `sec2-${a.userId.slice(0, 8)}`, kind: 'text', body: 'still there?' } }), { id: conversationId })).status).toBe(404);
    expect((await call(connectionOverview, request(`/api/v1/connections/${connectionId}`, { token: a.token }), { id: connectionId })).status).toBe(404);

    // Direct RLS reads return nothing, and the realtime channel guard is closed.
    const asA = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${a.token}` } }, auth: { persistSession: false } });
    const { data: rows } = await asA.from('messages').select('id').eq('conversation_id', conversationId);
    expect(rows ?? []).toHaveLength(0);
    const { data: open } = await admin().rpc('conversation_not_blocked', { p_conversation_id: conversationId });
    expect(open).toBe(false);

    // L3: clients can no longer probe block relationships.
    const { error } = await asA.rpc('is_blocked_between', { p1: a.profileId, p2: b.profileId });
    expect(error).not.toBeNull();
  });

  it('vision items cannot be edited after a connection closes', async () => {
    const { attacker: a, target: b } = await pair();
    const { connectionId } = await createConnection(a.profileId, b.profileId, null);
    const item = await call<{ id: string }>(addVision, request(`/api/v1/connections/${connectionId}/vision`, { token: a.token, body: { category: 'travel', content: 'Kyoto in spring', isShared: false } }), { id: connectionId });
    expect(item.status).toBeLessThan(300);
    expect((await call(closeConnection, request(`/api/v1/connections/${connectionId}/close`, { token: b.token, body: {} }), { id: connectionId })).status).toBeLessThan(300);
    const r = await call(updateVision, request(`/api/v1/connections/${connectionId}/vision/${item.body.data!.id}`, { method: 'PATCH', token: a.token, body: { isShared: true } }), { id: connectionId, itemId: item.body.data!.id });
    expect(r.status).toBe(409);
  });
});
