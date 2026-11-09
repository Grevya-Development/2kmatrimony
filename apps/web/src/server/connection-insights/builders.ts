/**
 * Deterministic builders for connection insights. Pure functions over
 * privacy-safe GroundingProfiles + engine facts. Differences are framed as
 * topics to explore — never as verdicts.
 */
import {
  CHILDREN_OPTIONS,
  DNA_DIMENSION_META,
  LIVING_OPTIONS,
  SETTLE_OPTIONS,
  TRAVEL_OPTIONS,
  VISION_CATEGORY_LABELS,
  labelOf,
  type BeforeYouMeetBriefing,
  type DimensionInsight,
  type DnaDimension,
  type GapAnalysis,
  type VisionCategory,
  type VisionThemes,
} from '@2k/shared';
import type { GroundingProfile } from '@/server/ai/features/common';

export interface PairFacts {
  dimensions: DimensionInsight[];
  alignments: string[];
  differences: string[];
  sharedInterests: string[];
}

const norm = (s: string) => s.trim().toLowerCase();
export const sharedOf = (a: string[], b: string[]) => a.filter((x) => b.some((y) => norm(y) === norm(x)));
const first = (name: string) => name.split(/\s+/)[0] ?? name;
const human = (s: string | null) => (s ? s.replace(/_/g, ' ') : null);

export const GAP_NOTE =
  'Different preferences are normal and often complementary. These are conversation topics, not judgements — only the two of you can decide what works.';

const DNA_COMPROMISES: Partial<Record<DnaDimension, string[]>> = {
  communication: ['Agree on a rhythm — for example a daily check-in and a longer weekly conversation.', 'Say what “staying in touch” means to each of you.'],
  independence: ['Plan both shared rituals and protected personal time.', 'Talk about which activities you would like to do together.'],
  family_orientation: ['Discuss how often you would like to see extended family and in what ways.', 'Share what support each family may expect.'],
  career_ambition: ['Talk about how you would support each other through demanding career phases.', 'Discuss how decisions about relocation for work would be made.'],
  lifestyle_pace: ['Alternate between quiet weekends and social or active ones.', 'Find a few shared activities that suit both energies.'],
  financial_philosophy: ['Agree on shared goals first, then personal spending room.', 'Consider a shared budget with individual allowances.'],
  long_term_aspirations: ['Describe where you each see yourselves in five years.', 'Identify which plans are fixed and which are flexible.'],
  emotional_connection: ['Share how you each like to receive care and support.', 'Talk about what helps when one of you has a hard day.'],
  personal_values: ['Discuss which traditions matter to each of you and why.', 'Explore how you would like to celebrate festivals and family occasions.'],
  shared_interests: ['Try each other’s favourite activities once or twice.', 'Keep space for individual hobbies too.'],
};

interface Topic { topic: string; detail: string; possibleCompromises: string[] }

/** Differences derived from explicit answers (both sides known and different). */
export function deriveDifferences(a: GroundingProfile, b: GroundingProfile): Topic[] {
  const out: Topic[] = [];
  const A = first(a.name);
  const B = first(b.name);
  if (a.settlePreference && b.settlePreference && a.settlePreference !== b.settlePreference && a.settlePreference !== 'flexible' && b.settlePreference !== 'flexible') {
    out.push({
      topic: 'Where to settle',
      detail: `${A} prefers ${labelOf(SETTLE_OPTIONS, a.settlePreference as never).toLowerCase()}, while ${B} prefers ${labelOf(SETTLE_OPTIONS, b.settlePreference as never).toLowerCase()}.`,
      possibleCompromises: ['Discuss a timeline — for example a few years in one place, then a review.', 'Talk about which reasons matter most: career, family, lifestyle.'],
    });
  }
  if (a.livingArrangement && b.livingArrangement && a.livingArrangement !== b.livingArrangement && a.livingArrangement !== 'flexible' && b.livingArrangement !== 'flexible') {
    out.push({
      topic: 'Living arrangements',
      detail: `${A} would like to live ${labelOf(LIVING_OPTIONS, a.livingArrangement as never).toLowerCase()}; ${B} would like ${labelOf(LIVING_OPTIONS, b.livingArrangement as never).toLowerCase()}.`,
      possibleCompromises: ['Living nearby rather than together can balance closeness and independence.', 'Talk about what support each set of parents may need over time.'],
    });
  }
  if (a.childrenPreference && b.childrenPreference && a.childrenPreference !== b.childrenPreference && a.childrenPreference !== 'open' && b.childrenPreference !== 'open') {
    out.push({
      topic: 'Children',
      detail: `${A}: ${labelOf(CHILDREN_OPTIONS, a.childrenPreference as never).toLowerCase()}. ${B}: ${labelOf(CHILDREN_OPTIONS, b.childrenPreference as never).toLowerCase()}.`,
      possibleCompromises: ['This is important to discuss openly early, including timing and how firm each view is.'],
    });
  }
  if (a.travel && b.travel) {
    const order = ['rarely', 'occasionally', 'frequently', 'passionate'];
    if (Math.abs(order.indexOf(a.travel) - order.indexOf(b.travel)) >= 2) {
      out.push({
        topic: 'Travel',
        detail: `${A} ${labelOf(TRAVEL_OPTIONS, a.travel as never).toLowerCase()}, while ${B} ${labelOf(TRAVEL_OPTIONS, b.travel as never).toLowerCase()}.`,
        possibleCompromises: ['Plan one bigger trip a year and shorter weekend breaks.', 'Some trips can be solo or with friends.'],
      });
    }
  }
  if (a.financialPhilosophy && b.financialPhilosophy && a.financialPhilosophy !== b.financialPhilosophy) {
    const pair = [a.financialPhilosophy, b.financialPhilosophy].sort().join('|');
    if (['saver|spender', 'separate_finances|shared_pool', 'investor|spender'].includes(pair)) {
      out.push({
        topic: 'Money',
        detail: `${A} describes their approach as ${human(a.financialPhilosophy)}; ${B} as ${human(b.financialPhilosophy)}.`,
        possibleCompromises: DNA_COMPROMISES.financial_philosophy!,
      });
    }
  }
  for (const dim of Object.keys(DNA_DIMENSION_META) as DnaDimension[]) {
    const x = a.dna[dim];
    const y = b.dna[dim];
    if (x === undefined || y === undefined || Math.abs(x - y) < 40) continue;
    if (dim === 'financial_philosophy' && out.some((t) => t.topic === 'Money')) continue;
    const meta = DNA_DIMENSION_META[dim];
    const lean = (v: number) => (v < 50 ? meta.left.toLowerCase() : meta.right.toLowerCase());
    out.push({
      topic: meta.label,
      detail: `${A} leans towards “${lean(x)}”, ${B} towards “${lean(y)}”.`,
      possibleCompromises: DNA_COMPROMISES[dim] ?? ['Share what this looks like day to day for each of you.'],
    });
  }
  return out;
}

export function deriveAlignments(a: GroundingProfile, b: GroundingProfile, facts: PairFacts): { topic: string; detail: string }[] {
  const out: { topic: string; detail: string }[] = [];
  const values = sharedOf(a.coreValues, b.coreValues);
  if (values.length) out.push({ topic: 'Shared values', detail: `You both value ${values.map(human).join(', ')}.` });
  const interests = sharedOf(a.interests, b.interests);
  if (interests.length) out.push({ topic: 'Shared interests', detail: `You both enjoy ${interests.slice(0, 5).join(', ').toLowerCase()}.` });
  if (a.childrenPreference && a.childrenPreference === b.childrenPreference) out.push({ topic: 'Children', detail: `You share the same view: ${labelOf(CHILDREN_OPTIONS, a.childrenPreference as never).toLowerCase()}.` });
  if (a.settlePreference && a.settlePreference === b.settlePreference) out.push({ topic: 'Where to settle', detail: `You both prefer ${labelOf(SETTLE_OPTIONS, a.settlePreference as never).toLowerCase()}.` });
  if (a.familyValues && a.familyValues === b.familyValues) out.push({ topic: 'Family values', detail: `You both describe your family values as ${a.familyValues}.` });
  if (a.diet && a.diet === b.diet) out.push({ topic: 'Food', detail: `You share the same food preferences (${human(a.diet)}).` });
  for (const d of facts.dimensions) {
    if (d.score !== null && d.score >= 80 && !out.some((o) => o.topic === d.label)) out.push({ topic: d.label, detail: d.note });
  }
  return out.slice(0, 8);
}

const QUESTION_BANK: { key: keyof GroundingProfile; q: string }[] = [
  { key: 'childrenPreference', q: 'How do you each feel about children, and about timing?' },
  { key: 'settlePreference', q: 'Where would you each like to settle in the long run?' },
  { key: 'livingArrangement', q: 'What living arrangement do you each picture after marriage?' },
  { key: 'financialPhilosophy', q: 'How would you like to manage money as a couple?' },
  { key: 'householdSplit', q: 'How would you like to share household responsibilities?' },
  { key: 'relocation', q: 'Would either of you relocate for work or family?' },
  { key: 'conflictStyle', q: 'What helps each of you when you disagree?' },
  { key: 'communicationStyle', q: 'How do you each like to stay in touch during a busy week?' },
];

export function deriveUnanswered(a: GroundingProfile, b: GroundingProfile): string[] {
  return QUESTION_BANK.filter(({ key }) => !a[key] || !b[key]).map(({ q }) => q).slice(0, 6);
}

export function buildGapAnalysis(a: GroundingProfile, b: GroundingProfile, facts: PairFacts): GapAnalysis {
  const differences = deriveDifferences(a, b).slice(0, 6);
  const alignments = deriveAlignments(a, b, facts);
  const unansweredQuestions = deriveUnanswered(a, b);
  const suggestedConversations = [
    ...differences.slice(0, 3).map((d) => `Share what matters most to each of you about ${d.topic.toLowerCase()}.`),
    ...(alignments[0] ? [`Talk about how ${alignments[0].topic.toLowerCase()} shows up in your everyday lives.`] : []),
    'Describe an ordinary weekday you would enjoy together a few years from now.',
  ].slice(0, 5);
  return { alignments, differences, unansweredQuestions, suggestedConversations, note: GAP_NOTE };
}

const MEETING_IDEAS: { match: RegExp; idea: string; why: string }[] = [
  { match: /read|book|writ/i, idea: 'Meet at a bookstore café', why: 'You both enjoy reading — browsing together gives easy things to talk about.' },
  { match: /music|concert|classical/i, idea: 'A live music or acoustic evening', why: 'Shared love of music, with natural pauses for conversation.' },
  { match: /food|cook|restaurant/i, idea: 'Try a new restaurant or food street', why: 'Food is a shared interest and keeps the mood relaxed.' },
  { match: /hik|trek|fitness|yoga|walk|run/i, idea: 'An easy morning walk in a popular park', why: 'You are both active — walking side by side makes talking comfortable.' },
  { match: /art|museum|photo|design/i, idea: 'Visit a gallery or museum', why: 'Art gives you plenty to react to and discuss.' },
  { match: /movie|film|theatre/i, idea: 'A film or play followed by coffee', why: 'You will have a shared experience to talk about afterwards.' },
  { match: /travel/i, idea: 'Explore a heritage site or old neighbourhood in your city', why: 'A small adventure that suits two people who love to travel.' },
  { match: /garden|plant|nature/i, idea: 'A botanical garden visit', why: 'Calm surroundings and a shared interest in nature.' },
];

export function buildBeforeYouMeet(a: GroundingProfile, b: GroundingProfile, facts: PairFacts): BeforeYouMeetBriefing {
  const sharedInterests = sharedOf(a.interests, b.interests).slice(0, 5);
  const sharedValues = sharedOf(a.coreValues, b.coreValues).map((v) => human(v)!);
  const compatibilityAreas = facts.dimensions
    .filter((d) => d.score !== null && d.score >= 65)
    .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
    .slice(0, 4)
    .map((d) => ({ area: d.label, detail: d.note }));
  const potentialDifferences = deriveDifferences(a, b).slice(0, 4).map((d) => ({ area: d.topic, detail: d.detail }));

  const starters: string[] = [];
  for (const i of sharedInterests.slice(0, 2)) starters.push(`You both enjoy ${i.toLowerCase()} — what first drew you to it?`);
  for (const v of sharedValues.slice(0, 1)) starters.push(`What does ${v.toLowerCase()} look like in your everyday life?`);
  if (a.futureGoals || b.futureGoals) starters.push('What is one thing you are working towards over the next few years?');
  starters.push('What does a perfect weekend look like for you?', 'Which family tradition or memory do you treasure most?', 'What made you decide you were ready to look for a partner?');

  const questionsToDiscuss = [
    ...potentialDifferences.slice(0, 2).map((d) => `How do you each see ${d.area.toLowerCase()}?`),
    ...deriveUnanswered(a, b).slice(0, 3),
  ];
  if (questionsToDiscuss.length < 3) questionsToDiscuss.push('What role would you like your families to play in your life together?', 'How do you like to handle disagreements?');

  const pool = [...sharedInterests, ...a.interests, ...b.interests].join(' ');
  const ideas = MEETING_IDEAS.filter((m) => m.match.test(pool)).slice(0, 2).map(({ idea, why }) => ({ idea, why }));
  ideas.push({ idea: 'Coffee at a quiet café in a familiar area', why: 'Simple, unhurried and easy to extend or end comfortably.' });

  return {
    sharedInterests,
    sharedValues,
    compatibilityAreas,
    potentialDifferences,
    conversationStarters: [...new Set(starters)].slice(0, 5),
    questionsToDiscuss: [...new Set(questionsToDiscuss)].slice(0, 5),
    firstMeetingIdeas: ideas.slice(0, 3),
    note: 'Meet somewhere public for the first few times and let someone you trust know your plans. There is no right or wrong way for this to go.',
  };
}

export function buildVisionThemes(items: { category: VisionCategory; content: string; mine: boolean }[]): VisionThemes {
  const byCat = new Map<VisionCategory, { mine: number; theirs: number; texts: string[] }>();
  for (const i of items) {
    const e = byCat.get(i.category) ?? { mine: 0, theirs: 0, texts: [] };
    if (i.mine) e.mine++; else e.theirs++;
    e.texts.push(i.content);
    byCat.set(i.category, e);
  }
  const commonThemes: string[] = [];
  const unansweredQuestions: string[] = [];
  for (const cat of Object.keys(VISION_CATEGORY_LABELS) as VisionCategory[]) {
    const e = byCat.get(cat);
    const label = VISION_CATEGORY_LABELS[cat];
    if (e && e.mine > 0 && e.theirs > 0) commonThemes.push(`You have both shared hopes about ${label.toLowerCase()}.`);
    else if (e) unansweredQuestions.push(`Only one of you has added ${label.toLowerCase()} so far — what would the other add?`);
    else unansweredQuestions.push(`Neither of you has added anything about ${label.toLowerCase()} yet.`);
  }
  return {
    commonThemes: commonThemes.slice(0, 6),
    unansweredQuestions: unansweredQuestions.slice(0, 5),
    note: items.length ? 'Based only on items you have both chosen to share.' : 'Share a few items to see common themes.',
  };
}
