import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z, type ZodType } from 'zod';
import type { AdminPermission, ApiErrorCode } from '@2k/shared';
import { getAuthContext, type AuthContext } from './auth';
import { rateLimit } from './rate-limit';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const errors = {
  unauthorized: (m = 'Please sign in to continue.') => new ApiError(401, 'unauthorized', m),
  forbidden: (m = 'You do not have access to this.') => new ApiError(403, 'forbidden', m),
  notFound: (m = 'Not found.') => new ApiError(404, 'not_found', m),
  conflict: (m: string, details?: unknown) => new ApiError(409, 'conflict', m, details),
  validation: (m: string, details?: unknown) => new ApiError(422, 'validation_failed', m, details),
  rateLimited: (m = 'Too many requests. Please slow down and try again shortly.') => new ApiError(429, 'rate_limited', m),
  entitlement: (m: string, details?: unknown) => new ApiError(402, 'entitlement_required', m, details),
  featureDisabled: (m = 'This feature is currently unavailable.') => new ApiError(403, 'feature_disabled', m),
  unconfigured: (service: string) =>
    new ApiError(503, 'service_unconfigured', `${service} is not configured on this server.`, { service }),
  profileIncomplete: (m = 'Complete your profile to use this feature.') => new ApiError(409, 'profile_incomplete', m),
  suspended: (m = 'Your account is suspended. Contact support for help.') => new ApiError(403, 'account_suspended', m),
};

export function ok<T>(data: T, init: { status?: number; nextCursor?: string | null; headers?: HeadersInit } = {}) {
  const body = init.nextCursor !== undefined ? { data, nextCursor: init.nextCursor } : { data };
  return NextResponse.json(body, { status: init.status ?? 200, headers: init.headers });
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  }
  console.error('[api] unhandled error', err);
  return NextResponse.json({ error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } }, { status: 500 });
}

export async function parseJson<S extends ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw errors.validation('Request body must be valid JSON.');
  }
  return validate(schema, raw);
}

export function validate<S extends ZodType>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw errors.validation(r.error.issues[0]?.message ?? 'Invalid input.', z.flattenError(r.error));
  }
  return r.data;
}

export function parseQuery<S extends ZodType>(req: Request, schema: S): z.infer<S> {
  const url = new URL(req.url);
  const obj: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    obj[key] = all.length > 1 ? all : all[0]!;
  }
  return validate(schema, obj);
}

type Params = Record<string, string | string[]>;

export interface RouteOptions {
  /** 'required' (default) | 'optional' | 'none' */
  auth?: 'required' | 'optional' | 'none';
  /** Require the caller to own a profile. 'active' also requires status=active. */
  profile?: 'required' | 'active';
  /** Require an admin permission (true = any admin). Also enforces MFA when configured. */
  admin?: AdminPermission | true;
  /** Fixed-window rate limit applied per user (or IP when anonymous). */
  rateLimit?: { name: string; limit: number; windowSec: number };
  /** Allow suspended accounts (e.g. /me, support, data export). */
  allowSuspended?: boolean;
}

export interface RouteContext<P extends Params = Params> {
  req: NextRequest;
  params: P;
  auth: AuthContext;
}

export interface OptionalRouteContext<P extends Params = Params> {
  req: NextRequest;
  params: P;
  auth: AuthContext | null;
}

/**
 * Wraps a route handler with authentication, authorization, rate limiting and
 * consistent error handling. Handlers may return a Response or plain data
 * (wrapped as `{ data }`).
 */
export function route<P extends Params = Params>(
  opts: RouteOptions & { auth: 'optional' | 'none' },
  handler: (ctx: OptionalRouteContext<P>) => Promise<unknown>,
): (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;
export function route<P extends Params = Params>(
  opts: RouteOptions,
  handler: (ctx: RouteContext<P>) => Promise<unknown>,
): (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;
export function route<P extends Params = Params>(
  opts: RouteOptions,
  handler: (ctx: never) => Promise<unknown>,
) {
  const mode = opts.auth ?? 'required';
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const params = ((await ctx?.params) ?? {}) as P;
      const auth = mode === 'none' ? null : await getAuthContext(req);
      if (mode === 'required' && !auth) throw errors.unauthorized();

      if (auth) {
        if (auth.user.status === 'deleted') throw errors.unauthorized('This account has been deleted.');
        if (auth.user.status === 'suspended' && !opts.allowSuspended && !auth.admin) throw errors.suspended();
        if (opts.profile) {
          if (!auth.profile) throw errors.profileIncomplete('Create your profile first.');
          if (opts.profile === 'active' && auth.profile.status !== 'active') {
            throw errors.profileIncomplete('Finish setting up your profile to use this feature.');
          }
        }
        if (opts.admin) {
          if (!auth.admin) throw errors.forbidden();
          if (auth.admin.mfaRequired && auth.aal !== 'aal2') {
            throw new ApiError(403, 'forbidden', 'Multi-factor authentication is required for the admin panel.', { mfaRequired: true });
          }
          if (opts.admin !== true && !auth.admin.can(opts.admin)) throw errors.forbidden();
        }
      }

      if (opts.rateLimit) {
        const who = auth?.userId ?? clientIp(req) ?? 'anon';
        await rateLimit(`${opts.rateLimit.name}:${who}`, opts.rateLimit.limit, opts.rateLimit.windowSec);
      }

      const result = await (handler as (c: OptionalRouteContext<P>) => Promise<unknown>)({ req, params, auth });
      return result instanceof Response ? result : ok(result ?? null);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip');
}

/** Base64url cursor helpers for keyset pagination. */
export const cursor = {
  encode: (v: Record<string, unknown>) => Buffer.from(JSON.stringify(v)).toString('base64url'),
  decode: <T>(c: string | undefined | null): T | null => {
    if (!c) return null;
    try {
      return JSON.parse(Buffer.from(c, 'base64url').toString('utf8')) as T;
    } catch {
      throw errors.validation('Invalid cursor.');
    }
  },
};
