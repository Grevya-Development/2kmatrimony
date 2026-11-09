import type { SearchFilters } from '@2k/shared';

/** Browse links (functional after sign-in: they open Discover with filters applied). */
export const BROWSE_TONGUES = ['Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Hindi', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Odia', 'Konkani', 'Urdu'] as const;
export const BROWSE_CITIES = ['Chennai', 'Bengaluru', 'Hyderabad', 'Mumbai', 'Coimbatore', 'Madurai', 'Kochi', 'Pune', 'Delhi', 'Mysuru', 'Thiruvananthapuram', 'Kolkata'] as const;

export function discoverHref(filters: SearchFilters, signedIn = false): string {
  const next = `/app/discover?f=${encodeURIComponent(JSON.stringify(filters))}`;
  return signedIn ? next : `/login?next=${encodeURIComponent(next)}`;
}
