import 'server-only';
import { VERIFICATION_KINDS, type VerificationItem, type VerificationKind, type VerificationSubmitInput } from '@2k/shared';
import { ID_DOCUMENT_TYPES, EMPLOYMENT_DOCUMENT_TYPES } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { errors } from '@/server/http';
import { assertUploaded } from '@/server/media';
import { requireProfile } from './service';

/** Create approved phone/email rows from Supabase Auth confirmations (idempotent). */
async function syncContactVerifications(auth: AuthContext, profileId: string) {
  const c = db();
  const { data } = await c.auth.admin.getUserById(auth.userId);
  const u = data.user;
  if (!u) return;
  const confirmed: VerificationKind[] = [];
  if (u.phone && u.phone_confirmed_at) confirmed.push('phone');
  if (u.email && u.email_confirmed_at) confirmed.push('email');
  if (!confirmed.length) return;
  const { data: rows } = await c.from('verifications').select('kind').eq('profile_id', profileId).eq('status', 'approved').in('kind', confirmed);
  const have = new Set((rows ?? []).map((r) => r.kind));
  const toInsert = confirmed.filter((k) => !have.has(k)).map((kind) => ({
    profile_id: profileId,
    kind,
    status: 'approved',
    provider: 'supabase_auth',
    submitted_data: { contact: kind === 'phone' ? `•••${(u.phone ?? '').slice(-4)}` : (u.email ?? '').replace(/^(.).*(@.*)$/, '$1•••$2') },
    reviewed_at: new Date().toISOString(),
  }));
  if (toInsert.length) await c.from('verifications').insert(toInsert);
}

export async function listVerifications(auth: AuthContext): Promise<VerificationItem[]> {
  const p = requireProfile(auth);
  await syncContactVerifications(auth, p.id);
  const { data } = await db().from('verifications').select('id, kind, status, document_type, rejection_reason, attempt, created_at, reviewed_at').eq('profile_id', p.id).order('created_at', { ascending: false });
  return VERIFICATION_KINDS.map((kind) => {
    const latest = (data ?? []).find((r) => r.kind === kind);
    return {
      kind,
      status: (latest?.status ?? 'not_started') as VerificationItem['status'],
      id: latest?.id ?? null,
      documentType: latest?.document_type ?? null,
      rejectionReason: latest?.rejection_reason ?? null,
      attempt: latest?.attempt ?? 0,
      submittedAt: latest?.created_at ?? null,
      reviewedAt: latest?.reviewed_at ?? null,
    };
  });
}

const DOC_TYPES: Record<string, readonly string[]> = {
  government_id: ID_DOCUMENT_TYPES,
  employment: EMPLOYMENT_DOCUMENT_TYPES,
  education: ['degree', 'marksheet', 'provisional_certificate'],
  photo: ['selfie'],
};

/** Reject anything that looks like a full government ID number in metadata. */
function assertNoFullIdNumbers(data: Record<string, string>) {
  for (const [k, v] of Object.entries(data)) {
    const digits = v.replace(/[\s-]/g, '');
    if (/^\d{9,}$/.test(digits) || /^[A-Z]{5}\d{4}[A-Z]$/i.test(digits)) {
      throw errors.validation(`Please do not enter full ID numbers (${k}). The last 4 characters are enough.`);
    }
  }
}

export async function submitVerification(auth: AuthContext, input: VerificationSubmitInput) {
  const p = requireProfile(auth);
  const c = db();
  const docType = input.kind === 'photo' ? 'selfie' : input.documentType;
  if (!docType || !DOC_TYPES[input.kind]!.includes(docType)) throw errors.validation('Choose a supported document type.');
  assertNoFullIdNumbers(input.submittedData);
  for (const path of input.documentPaths) await assertUploaded('verification-docs', path, p.id);

  const { data: latest } = await c.from('verifications').select('id, status, attempt').eq('profile_id', p.id).eq('kind', input.kind).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (latest && ['pending', 'in_review'].includes(latest.status)) throw errors.conflict('A submission is already under review.');
  if (latest?.status === 'approved') throw errors.conflict('This check is already verified.');

  const { data, error } = await c
    .from('verifications')
    .insert({
      profile_id: p.id,
      kind: input.kind,
      status: 'pending',
      provider: 'manual',
      document_type: docType,
      document_paths: input.documentPaths,
      submitted_data: input.submittedData,
      attempt: (latest?.attempt ?? 0) + 1,
    })
    .select('id')
    .single();
  if (error) throw error;
  await c.from('verification_events').insert({ verification_id: data.id, actor_user_id: auth.userId, from_status: latest?.status ?? null, to_status: 'pending', note: latest ? 'Resubmitted by member' : 'Submitted by member' });
  await audit(auth, { action: 'verification.submit', entityType: 'verification', entityId: data.id, after: { kind: input.kind, documentType: docType } });
  return { id: data.id, status: 'pending' as const };
}
