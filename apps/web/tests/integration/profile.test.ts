import { afterAll, describe, expect, it } from 'vitest';
import type { OnboardingQuestion, OwnProfileResponse } from '@2k/shared';
import { admin, call, request } from './helpers';
import { basics, cleanupCreated, completeRequired, newUser, startedUser, TINY_PNG } from './profile-helpers';
import { GET as getProfile, POST as startProfile, PATCH as patchProfile } from '@/app/api/v1/profile/route';
import { PUT as putBasics } from '@/app/api/v1/profile/basics/route';
import { PUT as putEducation } from '@/app/api/v1/profile/education/route';
import { PUT as putCareer } from '@/app/api/v1/profile/career/route';
import { PUT as putDna } from '@/app/api/v1/profile/dna/route';
import { POST as interpret } from '@/app/api/v1/profile/dna/interpret/route';
import { PUT as putPrivacy } from '@/app/api/v1/profile/privacy/route';
import { GET as getQuestions } from '@/app/api/v1/onboarding/questions/route';
import { POST as postAnswers } from '@/app/api/v1/onboarding/answers/route';
import { POST as uploads } from '@/app/api/v1/uploads/route';
import { POST as confirmPhoto } from '@/app/api/v1/profile/photos/route';
import { PATCH as patchPhoto, DELETE as deletePhoto } from '@/app/api/v1/profile/photos/[id]/route';
import { GET as getVerification, POST as postVerification } from '@/app/api/v1/verification/route';

afterAll(cleanupCreated);

const own = async (token: string, preview = false) => (await call<OwnProfileResponse>(getProfile, request(`/api/v1/profile${preview ? '?preview=1' : ''}`, { token }))).body.data!;

async function uploadPng(token: string, kind: 'photo' | 'verification') {
  const up = await call<{ path: string; signedUrl: string }>(uploads, request('/api/v1/uploads', { token, body: { kind, contentType: 'image/png', sizeBytes: TINY_PNG.length } }));
  expect(up.status).toBe(201);
  const put = await fetch(up.body.data!.signedUrl, { method: 'PUT', headers: { 'content-type': 'image/png' }, body: TINY_PNG });
  expect(put.ok).toBe(true);
  return up.body.data!.path;
}

describe('profile start & sections', () => {
  it('requires a profile before reading it', async () => {
    const u = await newUser('a-noprof');
    const r = await call(getProfile, request('/api/v1/profile', { token: u.token }));
    expect(r.status).toBe(409);
    expect(r.body.error?.code).toBe('profile_incomplete');
  });

  it('rejects start without required consents', async () => {
    const u = await newUser('a-consent');
    const r = await call(startProfile, request('/api/v1/profile', { token: u.token, body: { createdFor: 'self', consents: { terms: false, privacy: true, aiProcessing: false } } }));
    expect(r.status).toBe(422);
  });

  it('creates a draft profile, records consents, and is idempotent', async () => {
    const u = await startedUser('a-start');
    const again = await call<{ created: boolean }>(startProfile, request('/api/v1/profile', { token: u.token, body: { createdFor: 'son', consents: { terms: true, privacy: true, aiProcessing: true } } }));
    expect(again.status).toBe(200);
    expect(again.body.data?.created).toBe(false);
    const { data: consents } = await admin().from('current_consents').select('consent_type, granted').eq('user_id', u.userId);
    expect(consents?.find((c) => c.consent_type === 'terms')?.granted).toBe(true);
    expect(consents?.find((c) => c.consent_type === 'ai_processing')?.granted).toBe(true);
    const p = await own(u.token);
    expect(p.status).toBe('draft');
    expect(p.createdFor).toBe('self');
    expect(p.onboardingStep).toBe('basics');
  });

  it('rejects members under 18', async () => {
    const u = await startedUser('a-minor');
    const r = await call(putBasics, request('/api/v1/profile/basics', { token: u.token, method: 'PUT', body: { ...basics, dateOfBirth: '2012-01-01' } }));
    expect(r.status).toBe(422);
  });

  it('saves sections, tracks completion and activates when required sections are complete', async () => {
    const u = await startedUser('a-full');
    const r1 = await call<{ completion: { pct: number } }>(putBasics, request('/api/v1/profile/basics', { token: u.token, method: 'PUT', body: basics }));
    expect(r1.status).toBe(200);
    expect(r1.body.data!.completion.pct).toBeGreaterThan(0);
    const edu = await call(putEducation, request('/api/v1/profile/education', { token: u.token, method: 'PUT', body: { items: [{ level: 'masters', qualification: 'M.Tech', institution: 'IISc' }, { level: 'bachelors', qualification: 'B.E.' }] } }));
    expect(edu.status).toBe(200);
    const car = await call(putCareer, request('/api/v1/profile/career', { token: u.token, method: 'PUT', body: { profession: 'Software engineer', incomeRange: '25_50l', relocationWillingness: 'within_country' } }));
    expect(car.status).toBe(200);
    await completeRequired(u);
    const p = await own(u.token);
    expect(p.status).toBe('active');
    expect(p.completion.canActivate).toBe(true);
    expect(p.form.education).toHaveLength(2);
    expect(p.form.education.find((e) => e.isHighest)?.qualification).toBe('M.Tech');
    expect(p.form.basics.firstName).toBe('Ananya');
    const { data: prof } = await admin().from('profiles').select('search_text, activated_at').eq('owner_user_id', u.userId).single();
    expect(prof?.search_text).toContain('Software engineer');
    expect(prof?.activated_at).not.toBeNull();
    const { count } = await admin().from('audit_logs').select('id', { count: 'exact', head: true }).eq('actor_user_id', u.userId).eq('action', 'profile.update');
    expect(count).toBeGreaterThanOrEqual(4);
    const step = await call(patchProfile, request('/api/v1/profile', { token: u.token, method: 'PATCH', body: { onboardingStep: 'done' } }));
    expect(step.status).toBe(200);
  });

  it('tracks DNA provenance: AI-accepted then user-corrected', async () => {
    const u = await startedUser('a-dna');
    await call(putDna, request('/api/v1/profile/dna', { token: u.token, method: 'PUT', body: { entries: [{ dimension: 'communication', selfScore: 70, partnerTarget: null, importance: 4, flexible: true, origin: 'ai_accepted' }] } }));
    let p = await own(u.token);
    expect(p.form.dna.find((d) => d.dimension === 'communication')?.source).toBe('ai_suggested');
    await call(putDna, request('/api/v1/profile/dna', { token: u.token, method: 'PUT', body: { entries: [{ dimension: 'communication', selfScore: 40, partnerTarget: 60, importance: 4, flexible: false }] } }));
    p = await own(u.token);
    const d = p.form.dna.find((x) => x.dimension === 'communication')!;
    expect(d.source).toBe('user_corrected');
    expect(d.partnerTarget).toBe(60);
  });

  it('DNA interpretation requires AI consent and reports when AI is unconfigured', async () => {
    const noConsent = await startedUser('a-ai-no', false);
    const r1 = await call(interpret, request('/api/v1/profile/dna/interpret', { token: noConsent.token, body: { text: 'I love deep conversations every evening and I need my partner to check in.' } }));
    expect(r1.status).toBe(403);
    const withConsent = await startedUser('a-ai-yes', true);
    const r2 = await call(interpret, request('/api/v1/profile/dna/interpret', { token: withConsent.token, body: { text: 'I love deep conversations every evening and I need my partner to check in.' } }));
    if (process.env.ANTHROPIC_API_KEY) expect(r2.status).toBe(200);
    else expect(r2.body.error?.code).toBe('service_unconfigured');
  });

  it('privacy settings hide sensitive fields from strangers in preview', async () => {
    const u = await startedUser('a-priv');
    await completeRequired(u);
    const r = await call(putPrivacy, request('/api/v1/profile/privacy', { token: u.token, method: 'PUT', body: { visibility: 'members', photoVisibility: 'connections', sensitiveFieldsVisibility: 'connections', nameVisibility: 'initials', messagingPolicy: 'connections' } }));
    expect(r.status).toBe(200);
    const ownView = await own(u.token);
    expect(ownView.detail?.basics.religion).toBe('Example faith');
    const preview = await own(u.token, true);
    expect(preview.detail?.basics.religion).toBeNull();
    expect(preview.detail?.displayName).toBe('A. R.');
    expect(preview.detail?.hiddenSections).toContain('religion_community');
  });
});

describe('onboarding questions', () => {
  it('lists questions and maps answers to DNA, values and profile fields', async () => {
    const u = await startedUser('a-q');
    const q = await call<OnboardingQuestion[]>(getQuestions, request('/api/v1/onboarding/questions', { token: u.token }));
    expect(q.status).toBe(200);
    const dnaQ = q.body.data!.find((x) => x.mapsTo === 'dna:communication')!;
    expect(dnaQ.inputType).toBe('scale');
    expect(dnaQ.options).toHaveProperty('left');
    const r = await call(postAnswers, request('/api/v1/onboarding/answers', { token: u.token, body: { answers: [
      { questionKey: 'dna_communication', answer: { selfScore: 80, partnerTarget: null, importance: 5, flexible: false } },
      { questionKey: 'future_children', answer: 'open' },
      { questionKey: 'values_core_values', answer: ['honesty', 'growth'] },
      { questionKey: 'future_goals', answer: 'Buy a home and travel to Japan.' },
    ] } }));
    expect(r.status).toBe(200);
    const p = await own(u.token);
    expect(p.form.dna.find((d) => d.dimension === 'communication')?.selfScore).toBe(80);
    expect(p.form.values.childrenPreference).toBe('open');
    expect(p.form.values.coreValues).toEqual(['honesty', 'growth']);
    expect(p.form.values.futureGoals).toBe('Buy a home and travel to Japan.');
    const q2 = await call<OnboardingQuestion[]>(getQuestions, request('/api/v1/onboarding/questions?section=values', { token: u.token }));
    expect(q2.body.data!.find((x) => x.key === 'future_children')?.answer).toBe('open');
  });

  it('rejects answers outside the allowed options', async () => {
    const u = await startedUser('a-qbad');
    const r = await call(postAnswers, request('/api/v1/onboarding/answers', { token: u.token, body: { answers: [{ questionKey: 'future_children', answer: 'many' }] } }));
    expect(r.status).toBe(422);
    const r2 = await call(postAnswers, request('/api/v1/onboarding/answers', { token: u.token, body: { answers: [{ questionKey: 'not_a_question', answer: 'x' }] } }));
    expect(r2.status).toBe(422);
  });
});

describe('photos', () => {
  it('uploads, confirms (pending, primary), reorders and deletes photos', async () => {
    const u = await startedUser('a-photo');
    const path1 = await uploadPng(u.token, 'photo');
    const c1 = await call<{ id: string }>(confirmPhoto, request('/api/v1/profile/photos', { token: u.token, body: { path: path1, width: 1, height: 1 } }));
    expect(c1.status).toBe(201);
    const path2 = await uploadPng(u.token, 'photo');
    const c2 = await call<{ id: string }>(confirmPhoto, request('/api/v1/profile/photos', { token: u.token, body: { path: path2 } }));
    let p = await own(u.token);
    expect(p.photos).toHaveLength(2);
    expect(p.photos.find((x) => x.id === c1.body.data!.id)?.isPrimary).toBe(true);
    expect(p.photos.every((x) => x.moderationStatus === 'pending')).toBe(true);
    expect(p.photos[0]?.url).toMatch(/^http/);
    await call(patchPhoto, request(`/api/v1/profile/photos/${c2.body.data!.id}`, { token: u.token, method: 'PATCH', body: { isPrimary: true, visibility: 'connections' } }), { id: c2.body.data!.id });
    p = await own(u.token);
    expect(p.photos.find((x) => x.id === c2.body.data!.id)?.isPrimary).toBe(true);
    expect(p.photos.find((x) => x.id === c2.body.data!.id)?.visibility).toBe('connections');
    const del = await call(deletePhoto, request(`/api/v1/profile/photos/${c2.body.data!.id}`, { token: u.token, method: 'DELETE' }), { id: c2.body.data!.id });
    expect(del.status).toBe(200);
    p = await own(u.token);
    expect(p.photos).toHaveLength(1);
    expect(p.photos[0]?.isPrimary).toBe(true);
  });

  it('refuses to confirm another member\'s upload or a missing file', async () => {
    const a = await startedUser('a-ph-a');
    const b = await startedUser('a-ph-b');
    const pathA = await uploadPng(a.token, 'photo');
    const r = await call(confirmPhoto, request('/api/v1/profile/photos', { token: b.token, body: { path: pathA } }));
    expect(r.status).toBe(403);
    const { data: pb } = await admin().from('profiles').select('id').eq('owner_user_id', b.userId).single();
    const r2 = await call(confirmPhoto, request('/api/v1/profile/photos', { token: b.token, body: { path: `${pb!.id}/missing.png` } }));
    expect(r2.status).toBe(422);
  });

  it('rejects unsupported upload types and chat uploads', async () => {
    const u = await startedUser('a-uptype');
    const r = await call(uploads, request('/api/v1/uploads', { token: u.token, body: { kind: 'photo', contentType: 'application/x-msdownload', sizeBytes: 100 } }));
    expect(r.status).toBe(422);
    const r2 = await call(uploads, request('/api/v1/uploads', { token: u.token, body: { kind: 'chat', contentType: 'image/png', sizeBytes: 100 } }));
    expect(r2.status).toBe(422);
  });
});

describe('verification', () => {
  it('auto-approves confirmed email and handles document submission lifecycle', async () => {
    const u = await startedUser('a-verify');
    const list = await call<{ kind: string; status: string }[]>(getVerification, request('/api/v1/verification', { token: u.token }));
    expect(list.status).toBe(200);
    expect(list.body.data!.find((v) => v.kind === 'email')?.status).toBe('approved');
    expect(list.body.data!.find((v) => v.kind === 'government_id')?.status).toBe('not_started');

    const path = await uploadPng(u.token, 'verification');
    const bad = await call(postVerification, request('/api/v1/verification', { token: u.token, body: { kind: 'government_id', documentType: 'pan', documentPaths: [path], submittedData: { number: 'ABCDE1234F' } } }));
    expect(bad.status).toBe(422);
    const ok = await call(postVerification, request('/api/v1/verification', { token: u.token, body: { kind: 'government_id', documentType: 'passport', documentPaths: [path], submittedData: { last4: '1234' } } }));
    expect(ok.status).toBe(201);
    const dup = await call(postVerification, request('/api/v1/verification', { token: u.token, body: { kind: 'government_id', documentType: 'passport', documentPaths: [path] } }));
    expect(dup.status).toBe(409);

    // Admin asks for resubmission -> member can resubmit with attempt 2
    const { data: row } = await admin().from('verifications').select('id').eq('kind', 'government_id').order('created_at', { ascending: false }).limit(1).single();
    await admin().from('verifications').update({ status: 'resubmission_required', rejection_reason: 'Photo is blurry' }).eq('id', row!.id);
    const again = await call(postVerification, request('/api/v1/verification', { token: u.token, body: { kind: 'government_id', documentType: 'passport', documentPaths: [path] } }));
    expect(again.status).toBe(201);
    const list2 = await call<{ kind: string; status: string; attempt: number }[]>(getVerification, request('/api/v1/verification', { token: u.token }));
    const gov = list2.body.data!.find((v) => v.kind === 'government_id')!;
    expect(gov.status).toBe('pending');
    expect(gov.attempt).toBe(2);
  });
});
