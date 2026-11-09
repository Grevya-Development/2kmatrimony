import 'server-only';
import { z } from 'zod';
import { DNA_DIMENSIONS, DNA_DIMENSION_META, type DnaDimension, type DnaSuggestion } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { runStructured, untrusted } from '@/server/ai/client';
import { registerPrompt } from '@/server/ai/prompts';
import { errors } from '@/server/http';

registerPrompt(
  'dna_interpretation',
  `You help a member describe their own Relationship DNA: ten self-described preference spectrums, each scored 0-100.
For every dimension the member's text clearly speaks to, suggest where THEY place themselves (selfScore, 0 = left label, 100 = right label) and how much it seems to matter to them (importance 1-5).
Rules:
- Only suggest dimensions the text gives real evidence for. Skip the rest — fewer, well-grounded suggestions are better.
- The rationale quotes or paraphrases the member's own words in one short sentence, addressed to them ("You mentioned…").
- These are suggestions the member will review and correct. Never describe them as a diagnosis, test result or personality type.
Dimensions (left label → right label):
${DNA_DIMENSIONS.map((d) => `- ${d}: ${DNA_DIMENSION_META[d].left} → ${DNA_DIMENSION_META[d].right}`).join('\n')}`,
);

const OutputSchema = z.object({
  suggestions: z.array(
    z.object({
      dimension: z.enum(DNA_DIMENSIONS),
      selfScore: z.number().int().min(0).max(100),
      importance: z.number().int().min(1).max(5),
      rationale: z.string().max(300),
    }),
  ),
});

export async function hasAiConsent(userId: string): Promise<boolean> {
  const { data } = await db().from('current_consents').select('granted').eq('user_id', userId).eq('consent_type', 'ai_processing').maybeSingle();
  return data?.granted === true;
}

export async function interpretDna(auth: AuthContext, text: string, dimension?: DnaDimension): Promise<{ suggestions: DnaSuggestion[]; note: string }> {
  if (!(await hasAiConsent(auth.userId))) {
    throw errors.forbidden('Turn on AI assistance in Settings → Consents to use this feature.');
  }
  const focus = dimension ? `\nFocus only on the "${dimension}" dimension.` : '';
  const { output } = await runStructured({
    feature: 'dna_interpretation',
    userId: auth.userId,
    schema: OutputSchema,
    input: `Suggest Relationship DNA positions from the member's own description.${focus}\n\n${untrusted('member_input', text)}`,
  });
  const seen = new Set<string>();
  const suggestions = output.suggestions
    .filter((s) => (!dimension || s.dimension === dimension) && !seen.has(s.dimension) && seen.add(s.dimension))
    .map((s) => ({ ...s }));
  return { suggestions, note: 'These are suggestions based on your words. Review and adjust each one — only what you confirm is saved.' };
}
