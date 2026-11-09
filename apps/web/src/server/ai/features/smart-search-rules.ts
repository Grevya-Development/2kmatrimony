/**
 * Deterministic natural-language → SearchFilters parser. Used when AI is not
 * configured (and as a safety net). Only maps explicit words to explicit,
 * member-declared fields; never infers sensitive traits.
 */
import {
  ADVANCED_FILTER_KEYS,
  searchFiltersSchema,
  type Entitlements,
  type SearchFilters,
} from '@2k/shared';

export interface RulesInterpretation {
  filters: SearchFilters;
  softPreferences: string[];
  clarifyingQuestions: string[];
  summaryParts: string[];
}

// Canonical city names with common aliases (both spellings are searched).
const CITIES: Record<string, string[]> = {
  bengaluru: ['Bengaluru', 'Bangalore'],
  bangalore: ['Bengaluru', 'Bangalore'],
  mumbai: ['Mumbai', 'Bombay'],
  bombay: ['Mumbai', 'Bombay'],
  chennai: ['Chennai', 'Madras'],
  madras: ['Chennai', 'Madras'],
  kolkata: ['Kolkata', 'Calcutta'],
  calcutta: ['Kolkata', 'Calcutta'],
  delhi: ['Delhi', 'New Delhi'],
  'new delhi': ['Delhi', 'New Delhi'],
  hyderabad: ['Hyderabad'],
  pune: ['Pune'],
  ahmedabad: ['Ahmedabad'],
  kochi: ['Kochi', 'Cochin'],
  cochin: ['Kochi', 'Cochin'],
  mysuru: ['Mysuru', 'Mysore'],
  mysore: ['Mysuru', 'Mysore'],
  coimbatore: ['Coimbatore'],
  thiruvananthapuram: ['Thiruvananthapuram', 'Trivandrum'],
  trivandrum: ['Thiruvananthapuram', 'Trivandrum'],
  gurugram: ['Gurugram', 'Gurgaon'],
  gurgaon: ['Gurugram', 'Gurgaon'],
  noida: ['Noida'],
  jaipur: ['Jaipur'],
  lucknow: ['Lucknow'],
  chandigarh: ['Chandigarh'],
  visakhapatnam: ['Visakhapatnam', 'Vizag'],
  vizag: ['Visakhapatnam', 'Vizag'],
  mangaluru: ['Mangaluru', 'Mangalore'],
  mangalore: ['Mangaluru', 'Mangalore'],
  madurai: ['Madurai'],
  indore: ['Indore'],
  bhopal: ['Bhopal'],
  nagpur: ['Nagpur'],
  surat: ['Surat'],
  vadodara: ['Vadodara', 'Baroda'],
};

const LANGUAGES = ['tamil', 'telugu', 'kannada', 'malayalam', 'hindi', 'marathi', 'bengali', 'gujarati', 'punjabi', 'urdu', 'odia', 'konkani', 'tulu'];

const INTEREST_WORDS: Record<string, string> = {
  travel: 'Travel', travelling: 'Travel', traveling: 'Travel', reading: 'Reading', books: 'Reading', music: 'Music',
  cooking: 'Cooking', fitness: 'Fitness', yoga: 'Yoga', hiking: 'Hiking', trekking: 'Hiking', cricket: 'Cricket',
  football: 'Football', badminton: 'Badminton', movies: 'Movies', films: 'Movies', theatre: 'Theatre',
  photography: 'Photography', art: 'Art', dance: 'Dance', dancing: 'Dance', gardening: 'Gardening',
  volunteering: 'Volunteering', technology: 'Technology', startups: 'Startups', investing: 'Investing',
  meditation: 'Meditation', podcasts: 'Podcasts', gaming: 'Gaming', writing: 'Writing', pets: 'Pets',
};

const SOFT_PHRASES: [RegExp, string][] = [
  [/career[- ]?(oriented|driven|focused|minded)/, 'career-oriented'],
  [/\bambitious\b/, 'ambitious'],
  [/emotional(ly)? (connection|mature|maturity|intelligen)/, 'emotionally mature'],
  [/emotional connection/, 'emotional connection'],
  [/growing together|grow together/, 'growing together'],
  [/\bkind\b|kindness/, 'kind'],
  [/sense of humou?r|funny/, 'sense of humour'],
  [/\bcalm\b/, 'calm'],
  [/adventur/, 'adventurous'],
  [/spiritual/, 'spiritual'],
  [/\bcreative\b/, 'creative'],
  [/international travel/, 'international travel'],
];

const unique = <T,>(xs: T[]) => [...new Set(xs)];

export function parseSmartQuery(query: string): RulesInterpretation {
  const q = ` ${query.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ')} `;
  const f: SearchFilters = {};
  const soft: string[] = [];
  const parts: string[] = [];

  // Age ------------------------------------------------------------------
  let m: RegExpMatchArray | null;
  if ((m = q.match(/\b(\d{2})\s*(?:-|–|to|and)\s*(\d{2})\b/)) && Number(m[1]) >= 18 && Number(m[2]) <= 99) {
    const a = Number(m[1]); const b = Number(m[2]);
    f.ageMin = Math.min(a, b); f.ageMax = Math.max(a, b);
  } else if ((m = q.match(/\b(?:under|below|younger than|less than)\s*(\d{2})\b/))) {
    f.ageMax = Math.max(18, Number(m[1]) - 1);
  } else if ((m = q.match(/\b(?:over|above|older than|more than)\s*(\d{2})\b/))) {
    f.ageMin = Math.min(99, Number(m[1]) + 1);
  } else if ((m = q.match(/\b(early|mid|late)?\s*(20|30|40)s\b/))) {
    const base = Number(m[2]);
    const band = m[1] === 'early' ? [0, 3] : m[1] === 'mid' ? [4, 6] : m[1] === 'late' ? [7, 9] : [0, 9];
    f.ageMin = Math.max(18, base + band[0]!); f.ageMax = base + band[1]!;
  }
  if (f.ageMin !== undefined || f.ageMax !== undefined) parts.push(`aged ${f.ageMin ?? 18}–${f.ageMax ?? 99}`);

  // Location ----------------------------------------------------------------
  const cities: string[] = [];
  for (const [key, names] of Object.entries(CITIES)) {
    if (new RegExp(`\\b${key}\\b`).test(q)) cities.push(...names);
  }
  if (cities.length) { f.cities = unique(cities); parts.push(`in ${unique(cities.map((c) => CITIES[c.toLowerCase()]?.[0] ?? c)).join(', ')}`); }

  // Settling / relocation -------------------------------------------------------
  if (/(settle|settling|live|living|move|moving|based)\s+(abroad|overseas|outside india)/.test(q) || /\bnri\b/.test(q)) {
    f.settlePreferences = ['abroad', 'flexible'];
    parts.push('open to settling abroad');
  }
  if (/(open to|willing to|happy to|ok with|okay with)\s+(relocat|mov)/.test(q) || /relocat\w* after marriage/.test(q)) {
    f.relocation = ['open', 'within_country'];
    parts.push('open to relocating');
  }
  if (/(stay|staying|settle|settling) (close|near) (to )?(family|parents)/.test(q)) {
    f.settlePreferences = unique([...(f.settlePreferences ?? []), 'current_city', 'flexible']);
    soft.push('close to family');
  }

  // Diet & habits ----------------------------------------------------------------
  if (/\bvegan\b/.test(q)) f.diets = ['vegan'];
  else if (/\beggetarian\b/.test(q)) f.diets = ['eggetarian'];
  else if (/\bnon[- ]?veg(etarian)?\b/.test(q)) f.diets = ['non_vegetarian'];
  else if (/\bveg(etarian)?\b|\bpure veg\b/.test(q)) f.diets = ['vegetarian', 'vegan', 'jain'];
  if (f.diets) parts.push(f.diets.includes('non_vegetarian') ? 'non-vegetarian' : f.diets[0]!.replace('_', '-'));

  // Marital status ------------------------------------------------------------------
  if (/never (been )?married|first marriage|unmarried/.test(q)) { f.maritalStatuses = ['never_married']; parts.push('never married'); }
  else if (/\bdivorced\b/.test(q)) { f.maritalStatuses = ['divorced']; parts.push('divorced'); }
  else if (/\bwidow(ed|er)?\b/.test(q)) { f.maritalStatuses = ['widowed']; parts.push('widowed'); }

  // Education & profession ---------------------------------------------------------------
  if (/\b(phd|doctorate)\b/.test(q)) f.educationLevels = ['doctorate'];
  else if (/\b(masters|master's|postgraduate|post-graduate|mba|m\.?tech|ms)\b/.test(q)) f.educationLevels = ['masters', 'professional', 'doctorate'];
  else if (/\b(graduate|bachelors|bachelor's|degree)\b/.test(q)) f.educationLevels = ['bachelors', 'masters', 'professional', 'doctorate'];
  if (f.educationLevels) parts.push('with the education you asked for');
  const professions: string[] = [];
  if (/\bdoctors?\b|\bphysician/.test(q) && !/doctorate/.test(q)) professions.push('Doctor');
  if (/\bengineers?\b/.test(q)) professions.push('Engineer');
  if (/\blawyers?\b|\badvocate/.test(q)) professions.push('Lawyer');
  if (/\bteachers?\b|\bprofessor/.test(q)) professions.push('Teacher');
  if (/\barchitects?\b/.test(q)) professions.push('Architect');
  if (/\bdesigners?\b/.test(q)) professions.push('Designer');
  if (/chartered accountant|\bca\b/.test(q)) professions.push('Chartered Accountant');
  if (professions.length) { f.professions = professions; parts.push(professions.join(' / ').toLowerCase()); }

  // Language -----------------------------------------------------------------------------
  const tongues = LANGUAGES.filter((l) => new RegExp(`\\b${l}(-| )?(speaking|speaker|mother tongue)\\b|\\bspeaks? ${l}\\b`).test(q));
  if (tongues.length) { f.motherTongues = tongues.map((t) => t[0]!.toUpperCase() + t.slice(1)); parts.push(`${f.motherTongues.join('/')} speaking`); }

  // Values ----------------------------------------------------------------------------------
  const values: NonNullable<SearchFilters['coreValues']> = [];
  if (/(values?|valuing|oriented|close to|loves?) (their |the )?family|family[- ]oriented|family values/.test(q)) values.push('family');
  if (/personal growth|self[- ]improvement|growth mindset/.test(q)) values.push('growth');
  if (/\bindependen(t|ce)\b/.test(q)) values.push('independence');
  if (/\bhonest(y)?\b/.test(q)) values.push('honesty');
  if (/\bequal(ity)? partner|equality\b/.test(q)) values.push('equality');
  if (/\btraditional\b|tradition/.test(q)) values.push('tradition');
  if (values.length) { f.coreValues = unique(values); parts.push(`who value ${f.coreValues.join(', ')}`); }

  // Children -----------------------------------------------------------------------------------
  if (/(wants?|want to have|would like) (kids|children)/.test(q)) f.childrenPreferences = ['want', 'open', 'have_and_want_more'];
  else if (/(no|doesn't want|don't want|without) (kids|children)|child[- ]?free/.test(q)) f.childrenPreferences = ['dont_want', 'have_no_more', 'open'];

  // Interests --------------------------------------------------------------------------------------
  const interests = unique(Object.entries(INTEREST_WORDS).filter(([w]) => new RegExp(`\\b${w}\\b`).test(q)).map(([, v]) => v));
  if (interests.length) { f.interests = interests; parts.push(`into ${interests.map((i) => i.toLowerCase()).join(', ')}`); }

  // Trust ------------------------------------------------------------------------------------------
  if (/\bverified\b/.test(q)) { f.verifiedOnly = true; parts.push('verified'); }
  if (/with (a )?photos?\b/.test(q)) f.withPhotoOnly = true;

  // Soft, ranking-only preferences ---------------------------------------------------------------------
  for (const [re, label] of SOFT_PHRASES) if (re.test(q)) soft.push(label);

  const filters = searchFiltersSchema.parse(f);
  const clarifyingQuestions: string[] = [];
  if (filters.ageMin === undefined && filters.ageMax === undefined) clarifyingQuestions.push('Is there an age range you have in mind?');
  if (!filters.cities?.length && !filters.settlePreferences?.length && !filters.relocation?.length) clarifyingQuestions.push('Should we focus on a particular city, or are you open to anywhere?');
  return { filters, softPreferences: unique(soft), clarifyingQuestions: clarifyingQuestions.slice(0, 2), summaryParts: parts };
}

export function summarise(parts: string[], soft: string[]): string {
  if (!parts.length && !soft.length) return 'I could not pick out specific filters — try mentioning an age range, city, lifestyle or values.';
  const core = parts.length ? `Looking for people ${parts.join(', ')}` : 'Looking broadly';
  return soft.length ? `${core}, ranking higher those who come across as ${soft.join(', ')}.` : `${core}.`;
}

/**
 * Remove filters the member's plan doesn't include. Removed values are kept as
 * ranking-only soft preferences so intent isn't lost.
 */
export function stripAdvancedFilters(filters: SearchFilters, ent: Entitlements): { filters: SearchFilters; removed: (keyof SearchFilters)[]; soft: string[] } {
  if (ent.advanced_filters) return { filters, removed: [], soft: [] };
  const out: SearchFilters = { ...filters };
  const removed: (keyof SearchFilters)[] = [];
  const soft: string[] = [];
  for (const key of ADVANCED_FILTER_KEYS) {
    const v = out[key];
    if (v === undefined || v === null || v === false || (Array.isArray(v) && v.length === 0) || v === '') continue;
    removed.push(key);
    if (Array.isArray(v)) soft.push(...v.map((x) => String(x).replace(/_/g, ' ')));
    else if (typeof v === 'string') soft.push(v.replace(/_/g, ' '));
    delete out[key];
  }
  return { filters: out, removed, soft };
}

const FILTER_LABELS: Partial<Record<keyof SearchFilters, string>> = {
  heightMinCm: 'height', heightMaxCm: 'height', professions: 'profession', minIncomeRange: 'income',
  familyValues: 'family values', childrenPreferences: 'children', settlePreferences: 'where to settle',
  relocation: 'relocation', coreValues: 'values', verifiedOnly: 'verified only', text: 'keywords',
};
export const removedFiltersNotice = (removed: (keyof SearchFilters)[]): string | null =>
  removed.length
    ? `Filtering by ${unique(removed.map((k) => FILTER_LABELS[k] ?? String(k))).join(', ')} isn’t available right now — we used these to rank results instead.`
    : null;
