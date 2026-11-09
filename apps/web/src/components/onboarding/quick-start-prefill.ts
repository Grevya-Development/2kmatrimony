import type { PartnerPreferencesInput } from '@2k/shared';
import { QUICKSTART_KEY, type QuickStart } from '@/components/marketing/quick-start';

/**
 * Partner-preference defaults from the landing page's "I'm looking for…" card
 * (saved in localStorage before sign-up). Browser-only; returns null when absent.
 */
export function readQuickStartPreferences(): Partial<PartnerPreferencesInput> | null {
  try {
    const raw = window.localStorage.getItem(QUICKSTART_KEY);
    if (!raw) return null;
    const q = JSON.parse(raw) as Partial<QuickStart>;
    const out: Partial<PartnerPreferencesInput> = {};
    if (q.lookingFor === 'bride') out.seekingGenders = ['female'];
    if (q.lookingFor === 'groom') out.seekingGenders = ['male'];
    if (typeof q.ageMin === 'number' && typeof q.ageMax === 'number' && q.ageMin >= 18 && q.ageMax <= 99 && q.ageMin <= q.ageMax) {
      out.ageMin = q.ageMin;
      out.ageMax = q.ageMax;
    }
    if (typeof q.motherTongue === 'string' && q.motherTongue.trim()) out.motherTongues = [q.motherTongue.trim()];
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export function clearQuickStart(): void {
  try { window.localStorage.removeItem(QUICKSTART_KEY); } catch { /* storage unavailable */ }
}
