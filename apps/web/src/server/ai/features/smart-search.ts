import 'server-only';
import { z } from 'zod';
import type { SmartSearchInterpretation } from '@2k/shared';
import type { AuthContext } from '@/server/auth';
import { isEnabled } from '@/server/config';
import { consumeDailyQuota, getPlanState } from '@/server/entitlements';
import { aiAvailable, runStructured, untrusted } from '../client';
import { registerPrompt } from '../prompts';
import { cleanList, hasConsent, safeList } from './common';
import { AiFiltersSchema, FILTER_GUIDE, sanitizeFilters } from './filters';
import { parseSmartQuery, removedFiltersNotice, stripAdvancedFilters, summarise } from './smart-search-rules';

registerPrompt(
  'smart_search',
  `You convert a member's natural-language partner search into structured search filters.
${FILTER_GUIDE}
Return:
- filters: only what the member clearly asked for.
- softPreferences: up to 6 short phrases for qualities that are not filterable.
- clarifyingQuestions: up to 2 short questions if something important is ambiguous (e.g. no location or age), otherwise empty.
- summary: one plain sentence describing the search, starting with "Looking for people".`,
);

const AiSmartSchema = z.object({
  filters: AiFiltersSchema,
  softPreferences: z.array(z.string()),
  clarifyingQuestions: z.array(z.string()),
  summary: z.string(),
});

export async function interpretSmartSearch(auth: AuthContext, query: string): Promise<SmartSearchInterpretation> {
  const plan = await getPlanState(auth.userId);
  await consumeDailyQuota(auth.userId, 'smart_search', plan.entitlements.smart_search_per_day, 'Smart search');

  let interp: SmartSearchInterpretation | null = null;
  const useAi = (await aiAvailable('smart_search')) && (await hasConsent(auth.userId, 'ai_processing'));
  if (useAi) {
    try {
      const { output } = await runStructured({ feature: 'smart_search', userId: auth.userId, schema: AiSmartSchema, input: untrusted('member_input', query) });
      interp = {
        filters: sanitizeFilters(output.filters),
        softPreferences: safeList(cleanList(output.softPreferences, 6, 60)),
        clarifyingQuestions: cleanList(output.clarifyingQuestions, 2, 160),
        summary: output.summary.trim().slice(0, 300) || 'Looking for people who match your description.',
        generator: 'ai',
      };
    } catch (err) {
      console.error('[ai] smart search failed; using rules', err instanceof Error ? err.message : err);
    }
  }
  if (!interp) {
    const r = parseSmartQuery(query);
    interp = { filters: r.filters, softPreferences: r.softPreferences, clarifyingQuestions: r.clarifyingQuestions, summary: summarise(r.summaryParts, r.softPreferences), generator: 'rules' };
  }

  const stripped = stripAdvancedFilters(interp.filters, plan.entitlements);
  const notice = removedFiltersNotice(stripped.removed);
  return {
    ...interp,
    filters: stripped.filters,
    softPreferences: [...new Set([...interp.softPreferences, ...stripped.soft])].slice(0, 10),
    summary: notice ? `${interp.summary} ${notice}` : interp.summary,
  };
}

export async function smartSearchEnabled(): Promise<boolean> {
  return isEnabled('smart_search');
}
