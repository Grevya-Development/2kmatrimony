import 'server-only';
import { db } from '@/lib/supabase/admin';
import { errors } from './http';

const TTL_MS = 30_000;
let flagsCache: { at: number; flags: Record<string, boolean> } | null = null;
const settingsCache = new Map<string, { at: number; value: unknown }>();

/** Feature flags (30s in-memory cache per server instance). */
export async function getFlags(): Promise<Record<string, boolean>> {
  if (flagsCache && Date.now() - flagsCache.at < TTL_MS) return flagsCache.flags;
  const { data } = await db().from('feature_flags').select('key, enabled');
  const flags = Object.fromEntries((data ?? []).map((f) => [f.key, f.enabled]));
  flagsCache = { at: Date.now(), flags };
  return flags;
}

export async function isEnabled(key: string): Promise<boolean> {
  return (await getFlags())[key] ?? false;
}

export async function requireFlag(key: string): Promise<void> {
  if (!(await isEnabled(key))) throw errors.featureDisabled();
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = settingsCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const { data } = await db().from('platform_settings').select('value').eq('key', key).maybeSingle();
  const value = data?.value ? ({ ...(fallback as object), ...(data.value as object) } as T) : fallback;
  settingsCache.set(key, { at: Date.now(), value });
  return value;
}

/** Call after admin edits so this instance picks up changes immediately. */
export function invalidateConfigCache(): void {
  flagsCache = null;
  settingsCache.clear();
}
