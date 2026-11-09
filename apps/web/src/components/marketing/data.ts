import 'server-only';
import { db } from '@/lib/supabase/admin';
import { getSetting } from '@/server/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface Brand { name: string; tagline: string; support_email: string }

export const getBrand = () => getSetting<Brand>('brand', { name: '2K Matrimony', tagline: 'More Than a Match. A Meaningful Beginning.', support_email: '2kmatrimonysupport@gmail.com' });

export async function getCms(kind: 'faq' | 'success_story') {
  const { data } = await db().from('cms_entries').select('id, slug, title, body, metadata').eq('kind', kind).eq('locale', 'en').eq('is_published', true).order('sort_order');
  return data ?? [];
}

/** Lightweight signed-in check for CTAs (no profile/admin lookups). */
export async function isSignedIn(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    return !!data?.claims;
  } catch {
    return false;
  }
}
