import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './env';

/** Remove the fixed phone test users so each run starts from a fresh signup. */
export default async function globalSetup(): Promise<void> {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!url.includes('127.0.0.1') && !url.includes('localhost')) throw new Error('E2E must run against local Supabase');
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const phones = new Set(['919000000001', '919000000002', '919000000003']);
  for (let page = 1; page < 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.phone && phones.has(u.phone.replace('+', ''))) {
        await admin.from('admin_users').delete().eq('user_id', u.id);
        const { error } = await admin.auth.admin.deleteUser(u.id);
        if (error) throw new Error(`Could not delete E2E user ${u.phone}: ${error.message}`);
      }
    }
    if (users.length < 200) break;
  }
}
