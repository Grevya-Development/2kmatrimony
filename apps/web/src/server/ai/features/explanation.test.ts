import { describe, expect, it } from 'vitest';
import type { MatchExplanation } from '@2k/shared';
import { mergeAiExplanation } from './explanation';
import { rulesTurn } from './matchmaker';
import { sanitizeGap } from '@/server/connection-insights/service';

const engine: MatchExplanation = {
  candidateProfileId: 'c', compatibility: { mutual: 80, label: 'Strong alignment', confidence: 70, forViewer: 82, forCandidate: 78 },
  headline: 'Engine headline', dimensions: [], alignments: ['Both value family'], differences: ['Different plans for where to settle'],
  sharedInterests: ['Music'], mutualPreferenceNotes: [], missingInformation: [], conversationStarters: ['Engine starter'],
  generator: 'engine', disclaimer: 'x', computedAt: '2026-11-09T00:00:00Z',
};
const ai = {
  headline: 'You share a love of music and a family-first outlook.',
  alignments: ['You both enjoy live music', 'Family matters to you both', 'You are soulmates'],
  differences: ['Where you settle is worth a conversation'],
  conversationStarters: ['What song never gets old for you?', 'What does family time look like for you?', 'This is a guaranteed perfect match', '  ', 'Where would you love to travel next?'],
};

describe('mergeAiExplanation', () => {
  it('full tier rewrites copy, drops unsafe promises, and marks generator ai', () => {
    const r = mergeAiExplanation(engine, ai, 'full');
    expect(r.generator).toBe('ai');
    expect(r.headline).toBe(ai.headline);
    expect(r.alignments).toEqual(['You both enjoy live music', 'Family matters to you both']);
    expect(r.conversationStarters).toEqual(['What song never gets old for you?', 'What does family time look like for you?', 'Where would you love to travel next?']);
    expect(r.compatibility).toEqual(engine.compatibility); // scores are never changed by AI
  });
  it('basic tier only replaces conversation starters', () => {
    const r = mergeAiExplanation(engine, ai, 'basic');
    expect(r.headline).toBe(engine.headline);
    expect(r.alignments).toEqual(engine.alignments);
    expect(r.conversationStarters).toHaveLength(3);
  });
  it('falls back to engine starters if all AI starters are unsafe', () => {
    expect(mergeAiExplanation(engine, { ...ai, conversationStarters: ['You will marry'] }, 'basic').conversationStarters).toEqual(['Engine starter']);
  });
});

describe('matchmaker rulesTurn', () => {
  it('asks to clarify when nothing is recognised in a new conversation', () => {
    const t = rulesTurn('hello there', null);
    expect(t.intent).toBe('clarify');
    expect(t.generator).toBe('rules');
  });
  it('searches with parsed filters', () => {
    const t = rulesTurn('vegetarian, 27-31, in Chennai', null);
    expect(t.intent).toBe('search');
    expect(t.filters).toMatchObject({ ageMin: 27, ageMax: 31, diets: ['vegetarian', 'vegan', 'jain'] });
  });
  it('refines by merging with current filters', () => {
    const t = rulesTurn('only in Pune', { ageMin: 27, ageMax: 31, cities: ['Chennai'], softPreferences: ['kind'] });
    expect(t.intent).toBe('refine');
    expect(t.filters).toMatchObject({ ageMin: 27, ageMax: 31, cities: ['Pune'] });
    expect(t.soft).toContain('kind');
  });
});

describe('sanitizeGap', () => {
  it('removes verdict language and keeps the standard note', () => {
    const draft = { alignments: [{ topic: 'x', detail: 'y' }], differences: [], unansweredQuestions: ['q'], suggestedConversations: ['s'], note: 'n' };
    const r = sanitizeGap({
      alignments: [{ topic: 'Values', detail: 'You both value honesty' }],
      differences: [{ topic: 'Location', detail: 'You are incompatible on location', possibleCompromises: [] }, { topic: 'Travel', detail: 'Ananya travels more often', possibleCompromises: ['Plan one trip a year'] }],
      unansweredQuestions: [], suggestedConversations: ['Talk about travel'],
    }, draft);
    expect(r.differences.map((d) => d.topic)).toEqual(['Travel']);
    expect(r.unansweredQuestions).toEqual(['q']);
    expect(r.note).toMatch(/not judgements/);
  });
});
