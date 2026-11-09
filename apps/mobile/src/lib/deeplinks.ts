/**
 * Maps web paths (/app/...), notification `data.href` values and incoming
 * deep links (twokmatrimony://..., https://app-domain/app/...) to native routes.
 * Pure module — unit tested.
 */
const SIMPLE: Record<string, string> = {
  '': '/',
  app: '/',
  'app/discover': '/discover',
  'app/matchmaker': '/matchmaker',
  'app/interests': '/interests',
  'app/messages': '/messages',
  'app/connections': '/connections',
  'app/notifications': '/notifications',
  'app/settings': '/settings',
  'app/billing': '/billing',
  'app/verification': '/verification',
  'app/shortlist': '/shortlist',
  'app/profile': '/me',
  'app/dna': '/me/dna',
  'app/family': '/family',
  'app/readiness': '/readiness',
  'app/support': '/support',
  discover: '/discover',
  matchmaker: '/matchmaker',
  interests: '/interests',
  messages: '/messages',
  notifications: '/notifications',
};

const UUIDISH = /^[A-Za-z0-9-]{1,64}$/;

/** Split any link into a normalized path (no leading/trailing slash) and query string. */
export function splitLink(input: string): { path: string; query: string } {
  let s = input.trim();
  const custom = s.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i);
  if (custom) {
    const scheme = custom[1]!.toLowerCase();
    const rest = custom[2]!;
    if (scheme === 'http' || scheme === 'https' || scheme === 'exp') {
      const slash = rest.indexOf('/');
      s = slash === -1 ? '' : rest.slice(slash);
      s = s.replace(/^\/--\//, '/'); // Expo Go dev URLs: exp://host/--/path
    } else {
      s = rest; // custom scheme: host is the first path segment
    }
  }
  const qIdx = s.indexOf('?');
  const path = (qIdx === -1 ? s : s.slice(0, qIdx)).replace(/^\/+|\/+$/g, '');
  const query = qIdx === -1 ? '' : s.slice(qIdx + 1);
  return { path, query };
}

export function hrefToRoute(href: string | null | undefined): string | null {
  if (!href) return null;
  const { path, query } = splitLink(href);
  const q = query ? `?${query}` : '';
  if (path in SIMPLE) return SIMPLE[path]!;
  const parts = path.split('/');
  const [a, b, c] = parts;
  const id = (v: string | undefined) => (v && UUIDISH.test(v) ? v : null);

  // auth/callback?code=...
  if (path === 'auth/callback') return `/auth/callback${q}`;
  // family/accept?token=...
  if (path === 'family/accept' || path === 'app/family/accept') return `/family/accept${q}`;

  if (a === 'app' && parts.length === 3) {
    if (b === 'messages' && id(c)) return `/chat/${c}`;
    if (b === 'profile' && id(c)) return `/member/${c}`;
    if (b === 'connections' && id(c)) return `/connections/${c}`;
    if (b === 'support' && id(c)) return `/support/${c}`;
  }
  if (parts.length === 2) {
    if ((a === 'messages' || a === 'chat') && id(b)) return `/chat/${b}`;
    if ((a === 'profile' || a === 'member') && id(b)) return `/member/${b}`;
    if (a === 'connections' && id(b)) return `/connections/${b}`;
  }
  return null;
}
