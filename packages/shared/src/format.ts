/** Formatting helpers shared by web and mobile. */
export const formatInr = (paise: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 === 0 ? 0 : 2 }).format(paise / 100);

export const ageFromDob = (dob: string | null | undefined, now = new Date()): number | null => {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
};

export const formatHeight = (cm: number | null | undefined): string => {
  if (!cm) return '';
  const totalInches = Math.round(cm / 2.54);
  return `${Math.floor(totalInches / 12)}′${totalInches % 12}″ · ${cm} cm`;
};

/** Privacy-aware display name. */
export const displayName = (
  first: string | null | undefined,
  last: string | null | undefined,
  visibility: 'full' | 'first_name' | 'initials',
  fallback = 'Member',
): string => {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (!f) return fallback;
  if (visibility === 'full') return l ? `${f} ${l}` : f;
  if (visibility === 'initials') return `${f[0]!.toUpperCase()}.${l ? ` ${l[0]!.toUpperCase()}.` : ''}`;
  return l ? `${f} ${l[0]!.toUpperCase()}.` : f;
};

export const compatibilityLabel = (mutual: number): string => {
  if (mutual >= 85) return 'Exceptional alignment';
  if (mutual >= 75) return 'Strong alignment';
  if (mutual >= 65) return 'Good alignment';
  if (mutual >= 55) return 'Some alignment';
  return 'Different priorities';
};

export const relativeTime = (iso: string, now = Date.now()): string => {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
