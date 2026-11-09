/**
 * Sanitise a user-supplied post-login redirect (`?next=`). Safe on client and
 * server. Only same-origin relative paths survive; anything else falls back.
 *
 * Rejects: absolute/protocol-relative URLs (`https://x`, `//x`), backslash
 * tricks (`/\\x`, `/%5Cx` — browsers treat `\` as `/`), control characters
 * (tab/newline are stripped by URL parsers and can smuggle hosts), and
 * anything that resolves to a different origin.
 */
const FALLBACK = '/app';

export function safeNextPath(next: string | null | undefined, origin: string, fallback = FALLBACK): string {
  if (!next) return fallback;
  let decoded = next;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  for (const candidate of [next, decoded]) {
    if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
    if (candidate.includes('\\')) return fallback;
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;
  }
  let url: URL;
  try {
    url = new URL(next, origin);
  } catch {
    return fallback;
  }
  if (url.origin !== new URL(origin).origin) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
