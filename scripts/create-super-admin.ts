/**
 * Bootstrap an admin (default: super admin) for an EXISTING account.
 * The person must sign up once in the app first (phone OTP, email or OAuth).
 *
 * Usage (Node 22.6+):
 *   node --experimental-strip-types scripts/create-super-admin.ts --email you@example.com [--name "Your Name"]
 *   node --experimental-strip-types scripts/create-super-admin.ts --phone +919876543210 --role admin --no-mfa
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 * Falls back to apps/web/.env.local when those are not set.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
  }
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), 'apps/web/.env.local'));
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.');

  const email = arg('email');
  const phone = arg('phone');
  const roleKey = arg('role') ?? 'super_admin';
  const mfaRequired = !process.argv.includes('--no-mfa');
  if (!email && !phone) throw new Error('Pass --email or --phone of an existing account.');

  const db = createClient(url, key, { auth: { persistSession: false } });
  const digits = phone?.replace(/\D/g, '');
  const { data: user, error } = email
    ? await db.from('app_users').select('id, email, phone, full_name').ilike('email', email).maybeSingle()
    : await db.from('app_users').select('id, email, phone, full_name').in('phone', [phone!, digits!, `+${digits}`]).limit(1).maybeSingle();
  if (error) throw error;
  if (!user) throw new Error('No account found. Sign up in the app first, then re-run this script.');

  const { data: role } = await db.from('admin_roles').select('id, name').eq('key', roleKey).maybeSingle();
  if (!role) throw new Error(`Unknown role "${roleKey}".`);

  const displayName = arg('name') ?? user.full_name ?? user.email ?? user.phone ?? 'Administrator';
  const { error: upsertErr } = await db.from('admin_users').upsert({ user_id: user.id, role_id: role.id, display_name: displayName, is_active: true, mfa_required: mfaRequired });
  if (upsertErr) throw upsertErr;
  await db.from('audit_logs').insert({ actor_user_id: null, actor_type: 'system', action: 'admin.admin.bootstrap', entity_type: 'admin_user', entity_id: user.id, after_data: { role: roleKey, mfaRequired, via: 'scripts/create-super-admin.ts' } });

  console.log(`✓ ${displayName} is now ${role.name}.${mfaRequired ? ' They will enrol an authenticator app on first visit to /admin.' : ''}`);
}

main().catch((e: unknown) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
