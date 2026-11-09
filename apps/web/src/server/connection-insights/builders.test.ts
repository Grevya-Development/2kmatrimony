import { describe, expect, it } from 'vitest';
import type { GroundingProfile } from '@/server/ai/features/common';
import { buildBeforeYouMeet, buildGapAnalysis, buildVisionThemes, deriveDifferences } from './builders';

const g = (o: Partial<GroundingProfile>): GroundingProfile => ({
  name: 'Member', age: 30, city: 'Pune', about: null, education: null, profession: null, interests: [], coreValues: [], personalityTraits: [],
  diet: null, smoking: null, drinking: null, fitness: null, travel: null, familyStructure: null, familyValues: null, childrenPreference: null,
  livingArrangement: null, settlePreference: null, relocation: null, relationshipExpectations: null, futureGoals: null, communicationStyle: null,
  conflictStyle: null, independenceLevel: null, financialPhilosophy: null, householdSplit: null, dna: {}, ...o,
});

const facts = { dimensions: [{ key: 'values' as const, label: 'Values', score: 88, forViewer: 90, forCandidate: 86, note: 'Both value family' }], alignments: [], differences: [], sharedInterests: [] };

describe('gap analysis builder', () => {
  const a = g({ name: 'Ananya R.', settlePreference: 'abroad', travel: 'passionate', interests: ['Travel', 'Reading'], coreValues: ['family', 'growth'], dna: { communication: 85 } });
  const b = g({ name: 'Rohan K.', settlePreference: 'current_city', travel: 'rarely', interests: ['reading'], coreValues: ['family'], dna: { communication: 20 } });

  it('surfaces the spec examples (abroad vs near family, frequent travel vs settled)', () => {
    const r = buildGapAnalysis(a, b, facts);
    const topics = r.differences.map((d) => d.topic);
    expect(topics).toEqual(expect.arrayContaining(['Where to settle', 'Travel', 'Communication']));
    expect(r.differences.every((d) => d.possibleCompromises.length > 0)).toBe(true);
    expect(r.alignments.map((x) => x.topic)).toEqual(expect.arrayContaining(['Shared values', 'Shared interests', 'Values']));
  });

  it('never labels people incompatible', () => {
    const text = JSON.stringify(buildGapAnalysis(a, b, facts)).toLowerCase();
    expect(text).not.toMatch(/incompatible|unsuitable|bad match/);
    expect(buildGapAnalysis(a, b, facts).note).toMatch(/not judgements/);
  });

  it('lists unanswered questions for missing answers', () => {
    expect(buildGapAnalysis(g({}), g({}), facts).unansweredQuestions.length).toBeGreaterThan(2);
  });

  it('treats "flexible" and "open" as compatible, not differences', () => {
    expect(deriveDifferences(g({ settlePreference: 'flexible', childrenPreference: 'open' }), g({ settlePreference: 'abroad', childrenPreference: 'want' }))).toEqual([]);
  });
});

describe('before you meet builder', () => {
  it('produces all sections with five starters and public meeting ideas', () => {
    const r = buildBeforeYouMeet(g({ name: 'A', interests: ['Music', 'Hiking'], coreValues: ['honesty'] }), g({ name: 'B', interests: ['music', 'hiking'], coreValues: ['honesty'] }), facts);
    expect(r.sharedInterests).toEqual(['Music', 'Hiking']);
    expect(r.sharedValues).toEqual(['honesty']);
    expect(r.conversationStarters).toHaveLength(5);
    expect(r.firstMeetingIdeas.length).toBeGreaterThanOrEqual(2);
    expect(r.questionsToDiscuss.length).toBeGreaterThanOrEqual(3);
    expect(r.note).toMatch(/public/);
  });
});

describe('vision themes builder', () => {
  it('finds shared categories and gaps', () => {
    const r = buildVisionThemes([
      { category: 'travel', content: 'Japan', mine: true },
      { category: 'travel', content: 'Ladakh', mine: false },
      { category: 'career', content: 'Start a studio', mine: true },
    ]);
    expect(r.commonThemes[0]).toMatch(/travel/i);
    expect(r.unansweredQuestions.some((q) => /career/i.test(q))).toBe(true);
  });
});
