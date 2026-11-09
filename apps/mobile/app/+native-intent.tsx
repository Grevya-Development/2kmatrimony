import { hrefToRoute } from '@/lib/deeplinks';

/** Rewrite incoming deep links (twokmatrimony://..., https app links) to native routes. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return hrefToRoute(path) ?? path;
  } catch {
    return '/';
  }
}
