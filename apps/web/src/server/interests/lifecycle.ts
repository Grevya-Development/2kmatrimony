import 'server-only';
import { db } from '@/lib/supabase/admin';

/** Mark pending interests past their expiry as expired. Returns the number expired. */
export async function expireInterests(): Promise<number> {
  const { data, error } = await db()
    .from('interests')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}
