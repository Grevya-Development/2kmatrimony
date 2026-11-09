import 'server-only';
import type { NextRequest } from 'next/server';
import type { AdminPermission, Database } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AppUser = Database['public']['Tables']['app_users']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export interface AdminContext {
  roleKey: string;
  roleName: string;
  displayName: string;
  permissions: Set<string>;
  mfaRequired: boolean;
  isSuperAdmin: boolean;
  can: (p: AdminPermission) => boolean;
}

export interface AuthContext {
  userId: string;
  email: string | null;
  phone: string | null;
  aal: 'aal1' | 'aal2';
  user: AppUser;
  profile: Profile | null;
  admin: AdminContext | null;
  ip: string | null;
  userAgent: string | null;
  platform: 'web' | 'ios' | 'android';
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1];
    return part ? (JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Resolves the caller from a Bearer token (mobile / API clients) or the
 * Supabase session cookie (web). Tokens are verified with the Auth server.
 */
export async function getAuthContext(req: NextRequest | Request): Promise<AuthContext | null> {
  const header = req.headers.get('authorization');
  let token: string | null = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
  let userId: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;

  if (token) {
    const { data, error } = await db().auth.getUser(token);
    if (error || !data.user) return null;
    userId = data.user.id;
    email = data.user.email ?? null;
    phone = data.user.phone ?? null;
  } else {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return null;
      userId = data.user.id;
      email = data.user.email ?? null;
      phone = data.user.phone ?? null;
      const { data: s } = await supabase.auth.getSession();
      token = s.session?.access_token ?? null;
    } catch {
      return null; // no request cookie scope (e.g. called outside a request)
    }
  }

  const claims = token ? decodeJwtPayload(token) : {};
  const aal = claims.aal === 'aal2' ? 'aal2' : 'aal1';

  const client = db();
  const [{ data: user }, { data: profile }, { data: adminRow }] = await Promise.all([
    client.from('app_users').select('*').eq('id', userId).maybeSingle(),
    client.from('profiles').select('*').eq('owner_user_id', userId).maybeSingle(),
    client
      .from('admin_users')
      .select('display_name, is_active, mfa_required, admin_roles(key, name, admin_role_permissions(permission_key))')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  // The app_users row is created by a DB trigger; recover if it is missing.
  let appUser = user;
  if (!appUser) {
    const { data: created } = await client.from('app_users').upsert({ id: userId, email, phone }).select('*').single();
    appUser = created;
  }
  if (!appUser) return null;

  let admin: AdminContext | null = null;
  if (adminRow?.is_active && adminRow.admin_roles) {
    const role = adminRow.admin_roles as unknown as { key: string; name: string; admin_role_permissions: { permission_key: string }[] };
    const permissions = new Set(role.admin_role_permissions.map((p) => p.permission_key));
    const isSuperAdmin = role.key === 'super_admin';
    const { data: flag } = await client.from('feature_flags').select('enabled').eq('key', 'require_admin_mfa').maybeSingle();
    admin = {
      roleKey: role.key,
      roleName: role.name,
      displayName: adminRow.display_name,
      permissions,
      // Super admins always follow their own row's MFA setting: the global flag
      // can only relax MFA for other roles (and only a super admin can change it).
      mfaRequired: adminRow.mfa_required && (isSuperAdmin || (flag?.enabled ?? true)),
      isSuperAdmin,
      can: (p) => isSuperAdmin || permissions.has(p),
    };
  }

  const platformHeader = req.headers.get('x-client-platform');
  const platform = platformHeader === 'ios' || platformHeader === 'android' ? platformHeader : 'web';

  return {
    userId: userId!,
    email,
    phone,
    aal,
    user: appUser,
    profile: profile ?? null,
    admin,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent'),
    platform,
  };
}

/** Auth context for Server Components (reads the session cookie via next/headers). */
export async function getServerAuth(): Promise<AuthContext | null> {
  const { headers } = await import('next/headers');
  const h = await headers();
  return getAuthContext(new Request('http://internal/', { headers: new Headers(h) }));
}
