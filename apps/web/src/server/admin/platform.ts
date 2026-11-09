import 'server-only';
import { z } from 'zod';
import { ADMIN_PERMISSIONS, APP_LOCALES, NOTIFICATION_CHANNELS, type Json } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { integrationStatus } from '@/lib/env';
import type { AuthContext } from '@/server/auth';
import { audit } from '@/server/audit';
import { invalidateConfigCache } from '@/server/config';
import { errors } from '@/server/http';
import { notify, renderTemplate } from '@/server/notify';
import { likeSafe, paged, qp, type Page } from './common';

const asJson = (v: unknown) => v as NonNullable<Json>;

// ---------------------------------------------------------------------------
// CMS
// ---------------------------------------------------------------------------
export const cmsSchema = z.object({
  kind: z.enum(['faq', 'success_story', 'legal', 'announcement', 'help_article']),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  locale: z.enum(APP_LOCALES).default('en'),
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(1).max(50000),
  metadata: z.record(z.string(), z.unknown()).default({}),
  isPublished: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  consentReference: z.string().trim().max(200).nullish(),
});

const cmsRow = (v: Partial<z.infer<typeof cmsSchema>>) => ({
  ...(v.kind !== undefined && { kind: v.kind }),
  ...(v.slug !== undefined && { slug: v.slug }),
  ...(v.locale !== undefined && { locale: v.locale }),
  ...(v.title !== undefined && { title: v.title }),
  ...(v.body !== undefined && { body: v.body }),
  ...(v.metadata !== undefined && { metadata: asJson(v.metadata) }),
  ...(v.isPublished !== undefined && { is_published: v.isPublished }),
  ...(v.sortOrder !== undefined && { sort_order: v.sortOrder }),
  ...(v.consentReference !== undefined && { consent_reference: v.consentReference ?? null }),
});

function assertStoryConsent(kind: string, published: boolean, consent: string | null | undefined) {
  if (kind === 'success_story' && published && !consent) throw errors.validation('Success stories need a recorded consent reference before publishing.');
}

export async function listCms(req: Request) {
  let q = db().from('cms_entries').select('*').order('kind').order('sort_order');
  const kind = qp(req, 'kind');
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createCms(auth: AuthContext, input: z.infer<typeof cmsSchema>) {
  assertStoryConsent(input.kind, input.isPublished, input.consentReference);
  const { data, error } = await db().from('cms_entries').insert({ ...cmsRow(input), kind: input.kind, slug: input.slug, title: input.title, body: input.body, updated_by: auth.userId }).select('*').single();
  if (error) {
    if (error.code === '23505') throw errors.conflict('An entry with this kind, slug and locale already exists.');
    throw error;
  }
  await audit(auth, { action: 'admin.cms.create', entityType: 'cms_entry', entityId: data.id, after: data });
  return data;
}

export async function updateCms(auth: AuthContext, id: string, input: Partial<z.infer<typeof cmsSchema>>) {
  const c = db();
  const { data: before } = await c.from('cms_entries').select('*').eq('id', id).maybeSingle();
  if (!before) throw errors.notFound('Entry not found.');
  assertStoryConsent(input.kind ?? before.kind, input.isPublished ?? before.is_published, input.consentReference !== undefined ? input.consentReference : before.consent_reference);
  const { data, error } = await c.from('cms_entries').update({ ...cmsRow(input), updated_by: auth.userId, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw error;
  await audit(auth, { action: 'admin.cms.update', entityType: 'cms_entry', entityId: id, before, after: data });
  return data;
}

export async function deleteCms(auth: AuthContext, id: string) {
  const c = db();
  const { data: before } = await c.from('cms_entries').select('*').eq('id', id).maybeSingle();
  if (!before) throw errors.notFound('Entry not found.');
  await c.from('cms_entries').delete().eq('id', id);
  await audit(auth, { action: 'admin.cms.delete', entityType: 'cms_entry', entityId: id, before });
}

// ---------------------------------------------------------------------------
// Notification templates & broadcast
// ---------------------------------------------------------------------------
export const templateSchema = z.object({
  key: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/),
  channel: z.enum(NOTIFICATION_CHANNELS),
  locale: z.enum(APP_LOCALES).default('en'),
  subject: z.string().trim().max(300).nullish(),
  body: z.string().trim().min(1).max(5000),
  providerTemplateId: z.string().trim().max(120).nullish(),
  isActive: z.boolean().default(true),
});

const tplRow = (v: Partial<z.infer<typeof templateSchema>>) => ({
  ...(v.key !== undefined && { key: v.key }),
  ...(v.channel !== undefined && { channel: v.channel }),
  ...(v.locale !== undefined && { locale: v.locale }),
  ...(v.subject !== undefined && { subject: v.subject ?? null }),
  ...(v.body !== undefined && { body: v.body }),
  ...(v.providerTemplateId !== undefined && { provider_template_id: v.providerTemplateId ?? null }),
  ...(v.isActive !== undefined && { is_active: v.isActive }),
});

export const templateVariables = (text: string) => [...new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!))];

export async function listTemplates() {
  const { data, error } = await db().from('notification_templates').select('*').order('key').order('channel').order('locale');
  if (error) throw error;
  return (data ?? []).map((t) => ({ ...t, variables: templateVariables(`${t.subject ?? ''} ${t.body}`) }));
}

export async function createTemplate(auth: AuthContext, input: z.infer<typeof templateSchema>) {
  const { data, error } = await db().from('notification_templates').insert({ ...tplRow(input), key: input.key, channel: input.channel, body: input.body, updated_by: auth.userId }).select('*').single();
  if (error) {
    if (error.code === '23505') throw errors.conflict('A template for this key, channel and locale already exists.');
    throw error;
  }
  await audit(auth, { action: 'admin.template.create', entityType: 'notification_template', entityId: data.id, after: data });
  return data;
}

export async function updateTemplate(auth: AuthContext, id: string, input: Partial<z.infer<typeof templateSchema>>) {
  const c = db();
  const { data: before } = await c.from('notification_templates').select('*').eq('id', id).maybeSingle();
  if (!before) throw errors.notFound('Template not found.');
  const { data, error } = await c.from('notification_templates').update({ ...tplRow(input), updated_by: auth.userId, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw error;
  await audit(auth, { action: 'admin.template.update', entityType: 'notification_template', entityId: id, before, after: data });
  return data;
}

export async function deleteTemplate(auth: AuthContext, id: string) {
  const c = db();
  const { data: before } = await c.from('notification_templates').select('*').eq('id', id).maybeSingle();
  if (!before) throw errors.notFound('Template not found.');
  await c.from('notification_templates').delete().eq('id', id);
  await audit(auth, { action: 'admin.template.delete', entityType: 'notification_template', entityId: id, before });
}

export const previewSchema = z.object({ subject: z.string().nullish(), body: z.string(), vars: z.record(z.string(), z.string()).default({}) });
export const previewTemplate = (v: z.infer<typeof previewSchema>) => ({
  subject: v.subject ? renderTemplate(v.subject, v.vars) : null,
  body: renderTemplate(v.body, v.vars),
  variables: templateVariables(`${v.subject ?? ''} ${v.body}`),
});

export const broadcastSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(1000),
  href: z.string().trim().startsWith('/').max(200).optional(),
  audience: z.object({
    planCode: z.enum(['free', 'plus', 'premium', 'elite']).optional(),
    country: z.string().length(2).optional(),
    city: z.string().trim().max(80).optional(),
  }).default({}),
  dryRun: z.boolean().default(false),
});

const BROADCAST_CAP = 10000;

async function broadcastRecipients(a: z.infer<typeof broadcastSchema>['audience']): Promise<string[]> {
  const c = db();
  let ids: string[];
  if (a.country || a.city) {
    let q = c.from('profiles').select('owner_user_id').neq('status', 'deleted').limit(BROADCAST_CAP * 2);
    if (a.country) q = q.eq('current_country', a.country.toUpperCase());
    if (a.city) q = q.ilike('current_city', likeSafe(a.city));
    ids = ((await q).data ?? []).map((r) => r.owner_user_id);
  } else {
    ids = ((await c.from('app_users').select('id').eq('status', 'active').limit(BROADCAST_CAP * 2)).data ?? []).map((r) => r.id);
  }
  const { data: active } = await c.from('app_users').select('id').in('id', ids.slice(0, BROADCAST_CAP * 2)).eq('status', 'active');
  ids = (active ?? []).map((r) => r.id);
  if (a.planCode) {
    const nowIso = new Date().toISOString();
    const { data: paid } = await c.from('subscriptions').select('user_id, plans!inner(code)').eq('status', 'active').gt('current_period_end', nowIso);
    const byPlan = new Map((paid ?? []).map((s) => [s.user_id, (s.plans as unknown as { code: string }).code]));
    ids = ids.filter((id) => (a.planCode === 'free' ? !byPlan.has(id) : byPlan.get(id) === a.planCode));
  }
  return ids.slice(0, BROADCAST_CAP);
}

export async function broadcast(auth: AuthContext, input: z.infer<typeof broadcastSchema>) {
  const recipients = await broadcastRecipients(input.audience);
  if (input.dryRun) return { recipients: recipients.length, sent: 0, capped: recipients.length >= BROADCAST_CAP };
  let sent = 0;
  for (let i = 0; i < recipients.length; i += 50) {
    const batch = recipients.slice(i, i + 50);
    await Promise.all(batch.map((userId) => notify({ userId, category: 'product_updates', templateKey: 'admin_broadcast', vars: { title: input.title, body: input.body }, data: input.href ? { href: input.href } : {} })));
    sent += batch.length;
  }
  await audit(auth, { action: 'admin.notification.broadcast', entityType: 'notification', after: { title: input.title, audience: input.audience, sent } });
  return { recipients: recipients.length, sent, capped: recipients.length >= BROADCAST_CAP };
}

// ---------------------------------------------------------------------------
// Feature flags & settings
// ---------------------------------------------------------------------------
export async function listFlags() {
  const { data, error } = await db().from('feature_flags').select('*').order('key');
  if (error) throw error;
  return data ?? [];
}

export const flagSchema = z.object({ enabled: z.boolean().optional(), rolloutPercent: z.number().int().min(0).max(100).optional(), description: z.string().trim().min(3).max(300).optional() });

export async function updateFlag(auth: AuthContext, key: string, input: z.infer<typeof flagSchema>) {
  const c = db();
  const { data: before } = await c.from('feature_flags').select('*').eq('key', key).maybeSingle();
  if (!before) throw errors.notFound('Flag not found.');
  const patch = {
    ...(input.enabled !== undefined && { enabled: input.enabled }),
    ...(input.rolloutPercent !== undefined && { rollout_percent: input.rolloutPercent }),
    ...(input.description !== undefined && { description: input.description }),
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  };
  await c.from('feature_flags').update(patch).eq('key', key);
  invalidateConfigCache();
  await audit(auth, { action: 'admin.flag.update', entityType: 'feature_flag', entityId: key, before, after: patch });
}

/** Validators for known setting keys; unknown keys must still be JSON objects. */
const SETTING_SCHEMAS: Record<string, z.ZodType> = {
  brand: z.object({ name: z.string().min(1).max(60), tagline: z.string().max(200), support_email: z.email() }).strict(),
  policy_versions: z.record(z.string(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD versions')),
  limits: z.object({ min_age: z.number().int().min(18).max(30), max_photos: z.number().int().min(1).max(20), video_min_seconds: z.number().int().min(5).max(60), video_max_seconds: z.number().int().min(15).max(90), about_max_chars: z.number().int().min(200).max(5000) }).strict(),
  interests: z.object({ expiry_days: z.number().int().min(1).max(365), message_max_chars: z.number().int().min(0).max(1000) }).strict(),
  privacy: z.object({ deletion_grace_days: z.number().int().min(0).max(90), export_link_hours: z.number().int().min(1).max(168) }).strict(),
  gst: z.object({ rate_bps: z.number().int().min(0).max(5000), seller_gstin: z.string().regex(/^[0-9]{2}[A-Z0-9]{13}$/).nullable(), seller_state: z.string().min(2).max(10), seller_legal_name: z.string().max(200).nullable(), seller_address: z.string().max(500).nullable(), sac: z.string().max(10) }).strict(),
  safety: z.object({ max_interests_per_hour: z.number().int().min(1).max(1000), max_messages_per_minute: z.number().int().min(1).max(1000), duplicate_device_threshold: z.number().int().min(1).max(100) }).strict(),
};

export async function listSettings() {
  const { data, error } = await db().from('platform_settings').select('*').order('key');
  if (error) throw error;
  return (data ?? []).map((s) => ({ ...s, validated: s.key in SETTING_SCHEMAS }));
}

export const settingSchema = z.object({ value: z.record(z.string(), z.unknown()), description: z.string().max(300).optional(), isPublic: z.boolean().optional() });

export async function updateSetting(auth: AuthContext, key: string, input: z.infer<typeof settingSchema>) {
  const validator = SETTING_SCHEMAS[key];
  if (validator) {
    const r = validator.safeParse(input.value);
    if (!r.success) throw errors.validation(`Invalid value for "${key}": ${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`, z.flattenError(r.error));
  }
  const c = db();
  const { data: before } = await c.from('platform_settings').select('*').eq('key', key).maybeSingle();
  const row = { key, value: asJson(input.value), updated_by: auth.userId, updated_at: new Date().toISOString(), ...(input.description !== undefined && { description: input.description }), ...(input.isPublic !== undefined && { is_public: input.isPublic }) };
  const { error } = await c.from('platform_settings').upsert(row, { onConflict: 'key' });
  if (error) throw error;
  invalidateConfigCache();
  await audit(auth, { action: 'admin.setting.update', entityType: 'platform_setting', entityId: key, before, after: row });
}

// ---------------------------------------------------------------------------
// Regions & languages
// ---------------------------------------------------------------------------
export async function listRegionsAndLanguages() {
  const [{ data: regions }, { data: languages }] = await Promise.all([
    db().from('regions').select('*').order('country_code').order('code'),
    db().from('languages').select('*').order('sort_order'),
  ]);
  return { regions: regions ?? [], languages: languages ?? [] };
}

export const regionSchema = z.object({ isEnabled: z.boolean().optional(), matchingConfigRegion: z.string().trim().min(1).max(40).optional() });
export const languageSchema = z.object({ isEnabled: z.boolean().optional(), aiSupported: z.boolean().optional() });

export async function updateRegion(auth: AuthContext, code: string, input: z.infer<typeof regionSchema>) {
  const c = db();
  const { data: before } = await c.from('regions').select('*').eq('code', code).maybeSingle();
  if (!before) throw errors.notFound('Region not found.');
  const patch = { ...(input.isEnabled !== undefined && { is_enabled: input.isEnabled }), ...(input.matchingConfigRegion !== undefined && { matching_config_region: input.matchingConfigRegion }) };
  await c.from('regions').update(patch).eq('code', code);
  await audit(auth, { action: 'admin.region.update', entityType: 'region', entityId: code, before, after: patch });
}

export async function updateLanguage(auth: AuthContext, code: string, input: z.infer<typeof languageSchema>) {
  if (code === 'en' && input.isEnabled === false) throw errors.conflict('English cannot be disabled.');
  const c = db();
  const { data: before } = await c.from('languages').select('*').eq('code', code).maybeSingle();
  if (!before) throw errors.notFound('Language not found.');
  const patch = { ...(input.isEnabled !== undefined && { is_enabled: input.isEnabled }), ...(input.aiSupported !== undefined && { ai_supported: input.aiSupported }) };
  await c.from('languages').update(patch).eq('code', code);
  invalidateConfigCache();
  await audit(auth, { action: 'admin.language.update', entityType: 'language', entityId: code, before, after: patch });
}

// ---------------------------------------------------------------------------
// Onboarding questions
// ---------------------------------------------------------------------------
const optionSchema = z.object({ value: z.string().min(1).max(60), label: z.string().min(1).max(200) });
const questionBase = z.object({
  key: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/),
  section: z.enum(['basics', 'education', 'career', 'family', 'lifestyle', 'values', 'dna', 'preferences']),
  prompt: z.string().trim().min(5).max(300),
  helpText: z.string().trim().max(500).nullish(),
  inputType: z.enum(['single_select', 'multi_select', 'text', 'long_text', 'number', 'scale', 'date', 'tags']),
  options: z.union([z.array(optionSchema).max(40), z.object({ left: z.string().min(1).max(120), right: z.string().min(1).max(120) })]).default([]),
  mapsTo: z.string().trim().max(80).nullish(),
  isRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  translations: z.partialRecord(z.enum(APP_LOCALES), z.record(z.string(), z.unknown())).default({}),
});
export const questionSchema = questionBase.refine((q) => q.inputType !== 'scale' || !Array.isArray(q.options), { message: 'Scale questions need {left, right} labels.', path: ['options'] })
  .refine((q) => !['single_select', 'multi_select'].includes(q.inputType) || (Array.isArray(q.options) && q.options.length >= 2), { message: 'Select questions need at least two options.', path: ['options'] });

export const questionPatchSchema = z.object({
  section: questionBase.shape.section.optional(), prompt: questionBase.shape.prompt.optional(), helpText: questionBase.shape.helpText,
  inputType: questionBase.shape.inputType.optional(), options: z.union([z.array(optionSchema).max(40), z.object({ left: z.string().min(1).max(120), right: z.string().min(1).max(120) })]).optional(),
  mapsTo: questionBase.shape.mapsTo, isRequired: z.boolean().optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).max(10000).optional(),
  translations: z.partialRecord(z.enum(APP_LOCALES), z.record(z.string(), z.unknown())).optional(), key: z.string().optional(),
});

const qRow = (v: Partial<z.input<typeof questionSchema>>) => ({
  ...(v.key !== undefined && { key: v.key }),
  ...(v.section !== undefined && { section: v.section }),
  ...(v.prompt !== undefined && { prompt: v.prompt }),
  ...(v.helpText !== undefined && { help_text: v.helpText ?? null }),
  ...(v.inputType !== undefined && { input_type: v.inputType }),
  ...(v.options !== undefined && { options: asJson(v.options) }),
  ...(v.mapsTo !== undefined && { maps_to: v.mapsTo ?? null }),
  ...(v.isRequired !== undefined && { is_required: v.isRequired }),
  ...(v.isActive !== undefined && { is_active: v.isActive }),
  ...(v.sortOrder !== undefined && { sort_order: v.sortOrder }),
  ...(v.translations !== undefined && { translations: asJson(v.translations) }),
});

export async function listQuestions() {
  const { data, error } = await db().from('onboarding_questions').select('*').order('section').order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function createQuestion(auth: AuthContext, input: z.infer<typeof questionSchema>) {
  const { data, error } = await db().from('onboarding_questions').insert({ ...qRow(input), key: input.key, section: input.section, prompt: input.prompt, input_type: input.inputType, updated_by: auth.userId }).select('*').single();
  if (error) {
    if (error.code === '23505') throw errors.conflict('A question with this key already exists.');
    throw error;
  }
  invalidateConfigCache();
  await audit(auth, { action: 'admin.question.create', entityType: 'onboarding_question', entityId: data.id, after: data });
  return data;
}

export async function updateQuestion(auth: AuthContext, id: string, input: Partial<z.input<typeof questionSchema>>) {
  const c = db();
  const { data: before } = await c.from('onboarding_questions').select('*').eq('id', id).maybeSingle();
  if (!before) throw errors.notFound('Question not found.');
  if (input.key !== undefined && input.key !== before.key) throw errors.validation('Question keys cannot be changed (answers reference them).');
  const { data, error } = await c.from('onboarding_questions').update({ ...qRow(input), updated_by: auth.userId, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw error;
  invalidateConfigCache();
  await audit(auth, { action: 'admin.question.update', entityType: 'onboarding_question', entityId: id, before, after: data });
  return data;
}

export async function deleteQuestion(auth: AuthContext, id: string) {
  const c = db();
  const { data: before } = await c.from('onboarding_questions').select('*').eq('id', id).maybeSingle();
  if (!before) throw errors.notFound('Question not found.');
  // Soft-delete: keep the definition so existing answers remain interpretable.
  await c.from('onboarding_questions').update({ is_active: false, updated_by: auth.userId }).eq('id', id);
  invalidateConfigCache();
  await audit(auth, { action: 'admin.question.deactivate', entityType: 'onboarding_question', entityId: id, before });
}

// ---------------------------------------------------------------------------
// Audit log viewer
// ---------------------------------------------------------------------------
export async function listAudit(req: Request, p: Page) {
  const c = db();
  let q = c.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(p.offset, p.offset + p.limit - 1);
  const action = qp(req, 'action');
  const entityType = qp(req, 'entityType');
  const entityId = qp(req, 'entityId');
  const actor = qp(req, 'actor');
  const actorType = qp(req, 'actorType');
  const from = qp(req, 'from');
  const to = qp(req, 'to');
  if (action) q = q.ilike('action', `${likeSafe(action)}%`);
  if (entityType) q = q.eq('entity_type', entityType);
  if (entityId) q = q.eq('entity_id', entityId);
  if (actorType) q = q.eq('actor_type', actorType);
  if (actor) {
    if (/^[0-9a-f-]{36}$/i.test(actor)) q = q.eq('actor_user_id', actor);
    else {
      const { data: u } = await c.from('app_users').select('id').ilike('email', `%${likeSafe(actor)}%`).limit(50);
      q = q.in('actor_user_id', (u ?? []).map((x) => x.id).concat(['00000000-0000-0000-0000-000000000000']));
    }
  }
  if (from) q = q.gte('created_at', `${from}T00:00:00Z`);
  if (to) q = q.lt('created_at', new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400_000).toISOString());
  const { data, count, error } = await q;
  if (error) throw error;
  const actorIds = [...new Set((data ?? []).map((r) => r.actor_user_id).filter(Boolean) as string[])];
  const { data: admins } = actorIds.length ? await c.from('admin_users').select('user_id, display_name').in('user_id', actorIds) : { data: [] };
  const names = new Map((admins ?? []).map((a) => [a.user_id, a.display_name]));
  return paged((data ?? []).map((r) => ({ ...r, ip: null, actorName: r.actor_user_id ? names.get(r.actor_user_id) ?? null : 'System' })), count, p);
}

// ---------------------------------------------------------------------------
// Admin accounts & roles (super admin)
// ---------------------------------------------------------------------------
export async function listAdmins() {
  const c = db();
  const { data, error } = await c.from('admin_users').select('user_id, display_name, is_active, mfa_required, last_login_at, created_at, role_id, admin_roles(key, name)').order('created_at');
  if (error) throw error;
  const ids = (data ?? []).map((a) => a.user_id);
  const { data: users } = ids.length ? await c.from('app_users').select('id, email, phone').in('id', ids) : { data: [] };
  const byId = new Map((users ?? []).map((u) => [u.id, u]));
  return (data ?? []).map((a) => ({ ...a, role: a.admin_roles as unknown as { key: string; name: string }, admin_roles: undefined, email: byId.get(a.user_id)?.email ?? null, phone: byId.get(a.user_id)?.phone ?? null }));
}

export const adminInviteSchema = z.object({
  identifier: z.string().trim().min(5).max(120),
  roleId: z.uuid(),
  displayName: z.string().trim().min(2).max(80),
  mfaRequired: z.boolean().default(true),
});
export const adminUpdateSchema = z.object({ roleId: z.uuid().optional(), isActive: z.boolean().optional(), mfaRequired: z.boolean().optional(), displayName: z.string().trim().min(2).max(80).optional() });

export async function inviteAdmin(auth: AuthContext, input: z.infer<typeof adminInviteSchema>) {
  const c = db();
  const isEmail = input.identifier.includes('@');
  const phone = input.identifier.replace(/[^\d+]/g, '');
  const { data: user } = isEmail
    ? await c.from('app_users').select('id').ilike('email', input.identifier).maybeSingle()
    : await c.from('app_users').select('id').in('phone', [phone, phone.replace(/^\+/, ''), `91${phone.replace(/\D/g, '').slice(-10)}`]).limit(1).maybeSingle();
  if (!user) throw errors.notFound('No account found. The person must sign up once before they can be made an admin.');
  const { data: role } = await c.from('admin_roles').select('id, key').eq('id', input.roleId).maybeSingle();
  if (!role) throw errors.notFound('Role not found.');
  const { data: existing } = await c.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (existing) throw errors.conflict('This person is already an admin.');
  const { error } = await c.from('admin_users').insert({ user_id: user.id, role_id: role.id, display_name: input.displayName, mfa_required: input.mfaRequired, created_by: auth.userId });
  if (error) throw error;
  await audit(auth, { action: 'admin.admin.create', entityType: 'admin_user', entityId: user.id, after: { role: role.key, displayName: input.displayName, mfaRequired: input.mfaRequired } });
  return { userId: user.id };
}

async function activeSuperAdmins(): Promise<string[]> {
  const { data } = await db().from('admin_users').select('user_id, admin_roles!inner(key)').eq('is_active', true).eq('admin_roles.key', 'super_admin');
  return (data ?? []).map((r) => r.user_id);
}

export async function updateAdmin(auth: AuthContext, userId: string, input: z.infer<typeof adminUpdateSchema>) {
  const c = db();
  const { data: before } = await c.from('admin_users').select('*, admin_roles(key)').eq('user_id', userId).maybeSingle();
  if (!before) throw errors.notFound('Admin not found.');
  const wasSuper = (before.admin_roles as unknown as { key: string } | null)?.key === 'super_admin';
  let newRoleKey: string | null = null;
  if (input.roleId) newRoleKey = (await c.from('admin_roles').select('key').eq('id', input.roleId).maybeSingle()).data?.key ?? null;
  if (input.roleId && !newRoleKey) throw errors.notFound('Role not found.');
  const losesSuper = wasSuper && before.is_active && (input.isActive === false || (newRoleKey !== null && newRoleKey !== 'super_admin'));
  if (losesSuper) {
    const supers = await activeSuperAdmins();
    if (supers.length <= 1) throw errors.conflict('There must always be at least one active super admin.');
  }
  if (userId === auth.userId && input.isActive === false) throw errors.conflict('You cannot deactivate yourself.');
  const patch = {
    ...(input.roleId !== undefined && { role_id: input.roleId }),
    ...(input.isActive !== undefined && { is_active: input.isActive }),
    ...(input.mfaRequired !== undefined && { mfa_required: input.mfaRequired }),
    ...(input.displayName !== undefined && { display_name: input.displayName }),
  };
  await c.from('admin_users').update(patch).eq('user_id', userId);
  await audit(auth, { action: 'admin.admin.update', entityType: 'admin_user', entityId: userId, before, after: patch });
}

export async function listRoles() {
  const { data, error } = await db().from('admin_roles').select('id, key, name, description, is_system, created_at, admin_role_permissions(permission_key), admin_users(user_id)').order('created_at');
  if (error) throw error;
  const { data: perms } = await db().from('admin_permissions').select('*').order('category').order('key');
  return {
    roles: (data ?? []).map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, isSystem: r.is_system, permissions: r.key === 'super_admin' ? ['*'] : (r.admin_role_permissions ?? []).map((p) => p.permission_key), memberCount: (r.admin_users ?? []).length })),
    permissions: perms ?? [],
  };
}

const permArray = z.array(z.enum(ADMIN_PERMISSIONS)).max(ADMIN_PERMISSIONS.length);
export const roleCreateSchema = z.object({ key: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/), name: z.string().trim().min(2).max(60), description: z.string().trim().max(300).nullish(), permissions: permArray });
export const roleUpdateSchema = z.object({ name: z.string().trim().min(2).max(60).optional(), description: z.string().trim().max(300).nullish(), permissions: permArray.optional() });

async function setRolePermissions(roleId: string, permissions: string[]) {
  const c = db();
  await c.from('admin_role_permissions').delete().eq('role_id', roleId);
  if (permissions.length) {
    const { error } = await c.from('admin_role_permissions').insert([...new Set(permissions)].map((p) => ({ role_id: roleId, permission_key: p })));
    if (error) throw error;
  }
}

export async function createRole(auth: AuthContext, input: z.infer<typeof roleCreateSchema>) {
  const { data, error } = await db().from('admin_roles').insert({ key: input.key, name: input.name, description: input.description ?? null, is_system: false }).select('id').single();
  if (error) {
    if (error.code === '23505') throw errors.conflict('A role with this key exists.');
    throw error;
  }
  await setRolePermissions(data.id, input.permissions);
  await audit(auth, { action: 'admin.role.create', entityType: 'admin_role', entityId: data.id, after: input });
  return data;
}

export async function updateRole(auth: AuthContext, id: string, input: z.infer<typeof roleUpdateSchema>) {
  const c = db();
  const { data: role } = await c.from('admin_roles').select('id, key, name, description, admin_role_permissions(permission_key)').eq('id', id).maybeSingle();
  if (!role) throw errors.notFound('Role not found.');
  if (role.key === 'super_admin') throw errors.conflict('The Super Admin role cannot be modified.');
  const patch = { ...(input.name !== undefined && { name: input.name }), ...(input.description !== undefined && { description: input.description ?? null }) };
  if (Object.keys(patch).length) await c.from('admin_roles').update(patch).eq('id', id);
  if (input.permissions) await setRolePermissions(id, input.permissions);
  await audit(auth, { action: 'admin.role.update', entityType: 'admin_role', entityId: id, before: { ...role, permissions: (role.admin_role_permissions ?? []).map((p) => p.permission_key) }, after: input });
}

export async function deleteRole(auth: AuthContext, id: string) {
  const c = db();
  const { data: role } = await c.from('admin_roles').select('id, key, is_system').eq('id', id).maybeSingle();
  if (!role) throw errors.notFound('Role not found.');
  if (role.is_system) throw errors.conflict('System roles cannot be deleted.');
  const { count } = await c.from('admin_users').select('user_id', { count: 'exact', head: true }).eq('role_id', id);
  if (count) throw errors.conflict('Reassign admins in this role before deleting it.');
  await c.from('admin_roles').delete().eq('id', id);
  await audit(auth, { action: 'admin.role.delete', entityType: 'admin_role', entityId: id, before: role });
}

// ---------------------------------------------------------------------------
// System monitoring
// ---------------------------------------------------------------------------
export async function systemStatus() {
  const c = db();
  const started = Date.now();
  const ping = await c.from('feature_flags').select('key', { head: true, count: 'exact' });
  const dbLatencyMs = Date.now() - started;
  const day = new Date(Date.now() - 86400_000).toISOString();
  const week = new Date(Date.now() - 7 * 86400_000).toISOString();
  const count = async (p: PromiseLike<{ count: number | null }>) => (await p).count ?? 0;
  const [pendingVerifications, openReports, openTickets, pendingDataRequests, openRiskSignals, pendingMedia, aiErrors, deliveries, lastWebhook] = await Promise.all([
    count(c.from('verifications').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_review'])),
    count(c.from('reports').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_review'])),
    count(c.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'pending_user'])),
    count(c.from('data_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing'])),
    count(c.from('risk_signals').select('id', { count: 'exact', head: true }).eq('status', 'open')),
    count(c.from('profile_photos').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending')),
    c.from('ai_usage_logs').select('id, feature, model, status, error_code, created_at').in('status', ['error', 'refused']).gte('created_at', day).order('created_at', { ascending: false }).limit(20),
    c.from('notification_deliveries').select('channel, status, provider').gte('created_at', week).limit(50000),
    c.from('payment_webhook_events').select('id, event_type, received_at, processed_at, error').order('received_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const deliveryStats = new Map<string, Record<string, number>>();
  for (const d of deliveries.data ?? []) {
    const e = deliveryStats.get(d.channel) ?? {};
    e[d.status] = (e[d.status] ?? 0) + 1;
    deliveryStats.set(d.channel, e);
  }
  return {
    health: { database: ping.error ? 'error' : 'ok', dbLatencyMs, checkedAt: new Date().toISOString() },
    integrations: integrationStatus(),
    queues: { pendingVerifications, openReports, openTickets, pendingDataRequests, openRiskSignals, pendingMedia },
    recentAiErrors: aiErrors.data ?? [],
    notificationDeliveries7d: [...deliveryStats.entries()].map(([channel, statuses]) => ({ channel, ...statuses })),
    lastWebhookEvent: lastWebhook.data ?? null,
  };
}
