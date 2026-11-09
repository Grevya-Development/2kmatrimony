import 'server-only';
import type { ConsentType, DnaDimension, ProfileDetail } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { ProfileBundle } from '@/server/profiles/load';

/** Latest consent state for a type (false when never recorded). */
export async function hasConsent(userId: string, type: ConsentType): Promise<boolean> {
  const { data } = await db()
    .from('consent_records')
    .select('granted')
    .eq('user_id', userId)
    .eq('consent_type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.granted ?? false;
}

/**
 * Grounding data for AI prompts and deterministic builders. Built ONLY from a
 * privacy-projected ProfileDetail (what the other person is allowed to see),
 * plus non-sensitive answers (values/future vision/DNA positions) when the
 * caller confirms the audience may see them (e.g. connected members, or self).
 * Never contains contact details, exact DOB, photos, religion/community/income
 * unless the projection already exposed them.
 */
export interface GroundingProfile {
  name: string;
  age: number | null;
  city: string | null;
  about: string | null;
  education: string | null;
  profession: string | null;
  interests: string[];
  coreValues: string[];
  personalityTraits: string[];
  diet: string | null;
  smoking: string | null;
  drinking: string | null;
  fitness: string | null;
  travel: string | null;
  familyStructure: string | null;
  familyValues: string | null;
  childrenPreference: string | null;
  livingArrangement: string | null;
  settlePreference: string | null;
  relocation: string | null;
  relationshipExpectations: string | null;
  futureGoals: string | null;
  communicationStyle: string | null;
  conflictStyle: string | null;
  independenceLevel: string | null;
  financialPhilosophy: string | null;
  householdSplit: string | null;
  dna: Partial<Record<DnaDimension, number>>;
}

export function groundingFrom(detail: ProfileDetail, bundle: ProfileBundle | null, includeValues: boolean): GroundingProfile {
  const v = includeValues ? bundle?.values ?? null : null;
  const dna: GroundingProfile['dna'] = {};
  if (includeValues && bundle) for (const d of bundle.dna) dna[d.dimension as DnaDimension] = d.self_score;
  return {
    name: detail.displayName,
    age: detail.age,
    city: detail.city,
    about: detail.basics.about,
    education: detail.education,
    profession: detail.profession,
    interests: [...new Set([...(detail.lifestyle?.interests ?? []), ...(detail.lifestyle?.hobbies ?? [])])],
    coreValues: detail.basics.coreValues,
    personalityTraits: detail.basics.personalityTraits,
    diet: detail.lifestyle?.diet ?? null,
    smoking: detail.lifestyle?.smoking ?? null,
    drinking: detail.lifestyle?.drinking ?? null,
    fitness: detail.lifestyle?.fitness ?? null,
    travel: detail.lifestyle?.travel ?? null,
    familyStructure: detail.family?.familyStructure ?? null,
    familyValues: detail.family?.familyValues ?? null,
    childrenPreference: detail.values?.childrenPreference ?? null,
    livingArrangement: detail.values?.livingArrangement ?? null,
    settlePreference: detail.values?.settlePreference ?? null,
    relocation: detail.career?.relocationWillingness ?? null,
    relationshipExpectations: detail.values?.relationshipExpectations ?? null,
    futureGoals: detail.values?.futureGoals ?? null,
    communicationStyle: v?.communication_style ?? null,
    conflictStyle: v?.conflict_style ?? null,
    independenceLevel: v?.independence_level ?? null,
    financialPhilosophy: v?.financial_philosophy ?? null,
    householdSplit: v?.household_split ?? null,
    dna,
  };
}

/** Trim strings, drop empties, dedupe and cap a list returned by a model. */
export function cleanList(xs: unknown, max: number, maxLen = 400): string[] {
  if (!Array.isArray(xs)) return [];
  const out: string[] = [];
  for (const x of xs) {
    if (typeof x !== 'string') continue;
    const s = x.trim().slice(0, maxLen);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** Phrases we never show, even if a model produces them. */
const BANNED = /\b(guarantee[sd]?|soul ?mates?|destined|meant to be|perfect match|will (definitely )?(marry|work out|last)|incompatible|not (a )?good (fit|match) for marriage)\b/i;
export const isSafeCopy = (s: string) => !BANNED.test(s);
export const safeList = (xs: string[]) => xs.filter(isSafeCopy);
