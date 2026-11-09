import { z } from 'zod';
import { db } from '@/lib/supabase/admin';
import { clientIp, parseJson, route } from '@/server/http';
import { rateLimit } from '@/server/rate-limit';

const bodySchema = z.object({ email: z.email().max(254) });

/**
 * Step 1 of email-code sign-in. Makes sure an account exists for the address so
 * the client's `signInWithOtp({ shouldCreateUser: false })` sends the sign-in
 * email (6-digit code + link) for new and returning members alike.
 *
 * Safe because access still requires the code delivered to that inbox; the
 * response never reveals whether the address was already registered.
 */
export const POST = route({ auth: 'none' }, async ({ req }) => {
  const { email } = await parseJson(req, bodySchema);
  const normalized = email.trim().toLowerCase();
  const ip = clientIp(req) ?? 'unknown';
  await rateLimit(`email-start:ip:${ip}`, 20, 3600);
  await rateLimit(`email-start:addr:${normalized}`, 6, 3600);

  const { data: existing } = await db().from('app_users').select('id').eq('email', normalized).maybeSingle();
  if (!existing) {
    const { error } = await db().auth.admin.createUser({ email: normalized, email_confirm: true });
    // "already registered" races are fine; anything else is logged, and the client still proceeds.
    if (error && !/already/i.test(error.message)) console.error('[auth] email-start createUser failed', error.message);
  }
  return { ok: true };
});
