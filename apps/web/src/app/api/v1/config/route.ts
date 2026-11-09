import { route } from '@/server/http';
import { db } from '@/lib/supabase/admin';

/** Public client configuration: public settings, enabled languages. */
export const GET = route({ auth: 'none' }, async () => {
  const [{ data: settings }, { data: languages }] = await Promise.all([
    db().from('platform_settings').select('key, value').eq('is_public', true),
    db().from('languages').select('code, name, native_name, is_enabled, ai_supported').order('sort_order'),
  ]);
  return { settings: Object.fromEntries((settings ?? []).map((s) => [s.key, s.value])), languages: languages ?? [] };
});
