/**
 * Deterministic, viewer-facing explanation of a PairResult. Used directly when
 * AI is disabled/unconfigured, and as grounded facts for the AI writer.
 */
import {
  SCORE_DIMENSIONS,
  SCORE_DIMENSION_LABELS,
  compatibilityLabel,
  type DimensionInsight,
  type MatchExplanation,
} from '@2k/shared';
import type { DirectionResult, PairResult } from './types';

export const MATCH_DISCLAIMER =
  'Compatibility reflects how your stated preferences align today. It is not a prediction of relationship success and not a personality assessment.';

interface ViewerFrame {
  forViewer: DirectionResult; // candidate measured against viewer's preferences
  forCandidate: DirectionResult; // viewer measured against candidate's preferences
}

function frame(pair: PairResult, viewerId: string): ViewerFrame {
  return viewerId === pair.aId ? { forViewer: pair.aToB, forCandidate: pair.bToA } : { forViewer: pair.bToA, forCandidate: pair.aToB };
}

function dimensionNote(score: number | null, notes: string[]): string {
  if (score === null) return 'Not enough information yet.';
  if (notes.length) return notes[0]!;
  if (score >= 80) return 'Closely aligned.';
  if (score >= 60) return 'Mostly aligned.';
  if (score >= 40) return 'Some differences worth discussing.';
  return 'Quite different priorities here.';
}

export function buildExplanation(pair: PairResult, viewerId: string, candidateId: string, computedAt = new Date().toISOString()): MatchExplanation {
  const { forViewer, forCandidate } = frame(pair, viewerId);

  const dimensions: DimensionInsight[] = SCORE_DIMENSIONS.map((key) => {
    const v = forViewer.dimensions[key];
    const c = forCandidate.dimensions[key];
    const mutual = pair.dimensions[key].mutual;
    return {
      key,
      label: SCORE_DIMENSION_LABELS[key],
      score: mutual,
      forViewer: v.score === null ? null : Math.round(v.score * 100),
      forCandidate: c.score === null ? null : Math.round(c.score * 100),
      note: dimensionNote(mutual, [...v.notes, ...c.notes]),
    };
  });

  const alignments = new Set<string>();
  const differences = new Set<string>();
  for (const key of SCORE_DIMENSIONS) {
    for (const n of [...forViewer.dimensions[key].notes, ...forCandidate.dimensions[key].notes]) {
      if (/^(Different|Quite different)/i.test(n)) differences.add(n);
      else alignments.add(n);
    }
  }
  // Unmet soft preferences in either direction are worth surfacing as differences.
  for (const chk of forViewer.checks) if (chk.status === 'unmet' && !chk.hard) differences.add(`Outside your preference for ${chk.label.toLowerCase()}`);
  for (const chk of forCandidate.checks) if (chk.status === 'unmet' && !chk.hard) differences.add(`You are outside their preference for ${chk.label.toLowerCase()}`);
  for (const chk of [...forViewer.dealbreakers, ...forCandidate.dealbreakers]) differences.add(`Non-negotiable not met: ${chk.label.toLowerCase()}`);

  const mutualPreferenceNotes: string[] = [];
  const known = (r: DirectionResult) => r.checks.filter((c) => c.status !== 'unknown' && c.field !== 'gender');
  const met = (r: DirectionResult) => known(r).filter((c) => c.status === 'met').length;
  if (known(forViewer).length) mutualPreferenceNotes.push(`They meet ${met(forViewer)} of ${known(forViewer).length} preferences you set.`);
  if (known(forCandidate).length) mutualPreferenceNotes.push(`You meet ${met(forCandidate)} of ${known(forCandidate).length} preferences they set.`);
  if (Math.abs(forViewer.score - forCandidate.score) > 20) {
    mutualPreferenceNotes.push(
      forViewer.score > forCandidate.score
        ? 'They match your preferences more closely than you match theirs.'
        : 'You match their preferences more closely than they match yours.',
    );
  }

  const missingInformation = [...new Set([...forViewer.missing, ...forCandidate.missing])];
  const best = dimensions.filter((d) => d.score !== null).sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
  const headline = best.length
    ? `${compatibilityLabel(pair.mutual)} — strongest on ${best.slice(0, 2).map((d) => d.label.toLowerCase()).join(' and ')}.`
    : 'Add more to your profile to see how you align.';

  return {
    candidateProfileId: candidateId,
    compatibility: {
      mutual: pair.mutual,
      label: compatibilityLabel(pair.mutual),
      confidence: pair.confidence,
      forViewer: forViewer.score,
      forCandidate: forCandidate.score,
    },
    headline,
    dimensions,
    alignments: [...alignments].slice(0, 8),
    differences: [...differences].slice(0, 6),
    sharedInterests: pair.sharedInterests,
    mutualPreferenceNotes,
    missingInformation,
    conversationStarters: ruleBasedStarters(pair),
    generator: 'engine',
    disclaimer: MATCH_DISCLAIMER,
    computedAt,
  };
}

/** Simple, respectful starters derived from shared ground. AI can replace these. */
export function ruleBasedStarters(pair: PairResult): string[] {
  const out: string[] = [];
  for (const i of pair.sharedInterests.slice(0, 2)) out.push(`You both enjoy ${i.toLowerCase()} — what got you into it?`);
  for (const v of pair.sharedValues.slice(0, 1)) out.push(`You both value ${v.toLowerCase()}. What does that look like in your everyday life?`);
  out.push('What does a perfect weekend look like for you?');
  out.push('What is something you are looking forward to this year?');
  return out.slice(0, 5);
}
