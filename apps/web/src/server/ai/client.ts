import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import type { AiFeature } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { integrations, serverEnv } from '@/lib/env';
import { errors } from '@/server/http';
import { resolvePrompt } from './prompts';

/**
 * AI ORCHESTRATION CORE
 * - Per-feature model/effort/limits come from ai_feature_configs (admin-editable).
 * - Prompts come from the code registry with optional DB overrides (ai_prompts).
 * - Every call is logged to ai_usage_logs with tokens, cost and latency.
 * - Server-side refusal fallback is enabled (`fallbacks: "default"`).
 * - AI never acts as a user and never receives private messages unless a
 *   feature has explicit consent (enforced by callers).
 */

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

// USD per million tokens (Anthropic first-party list prices).
const PRICING: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number }> = {
  'claude-opus-5-5': { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-5-5': { in: 0.1, out: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  'claude-fable-5-1': { in: 10, out: 50, cacheRead: 0.25, cacheWrite: 12.5 },
};

export interface FeatureConfig {
  feature: AiFeature;
  provider: 'anthropic' | 'voyage' | 'disabled';
  model: string;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null;
  maxTokens: number;
  promptKey: string | null;
  enabled: boolean;
  dailyUserLimit: number | null;
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: serverEnv.anthropicApiKey, maxRetries: 2, timeout: 120_000 });
  return client;
}

const cfgCache = new Map<string, { at: number; cfg: FeatureConfig }>();
export async function getFeatureConfig(feature: AiFeature): Promise<FeatureConfig> {
  const hit = cfgCache.get(feature);
  if (hit && Date.now() - hit.at < 30_000) return hit.cfg;
  const { data } = await db().from('ai_feature_configs').select('*').eq('feature', feature).maybeSingle();
  const cfg: FeatureConfig = {
    feature,
    provider: (data?.provider ?? 'anthropic') as FeatureConfig['provider'],
    model: data?.model ?? 'claude-opus-5-5',
    effort: (data?.effort ?? 'medium') as FeatureConfig['effort'],
    maxTokens: data?.max_tokens ?? 4000,
    promptKey: data?.prompt_key ?? feature,
    enabled: data?.enabled ?? true,
    dailyUserLimit: data?.daily_user_limit ?? null,
  };
  cfgCache.set(feature, { at: Date.now(), cfg });
  return cfg;
}
export function invalidateAiConfigCache(): void {
  cfgCache.clear();
}

/** True when the feature can call a model right now. */
export async function aiAvailable(feature: AiFeature): Promise<boolean> {
  if (!integrations.anthropic) return false;
  const cfg = await getFeatureConfig(feature);
  return cfg.enabled && cfg.provider === 'anthropic';
}

export function costMicros(model: string, u: { input: number; output: number; cacheRead: number; cacheWrite: number }): number {
  const p = PRICING[model] ?? PRICING['claude-opus-5-5']!;
  const usd = (u.input * p.in + u.output * p.out + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1_000_000;
  return Math.round(usd * 1_000_000);
}

interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export async function logUsage(entry: {
  userId: string | null;
  feature: string;
  provider: string;
  model: string;
  promptKey?: string | null;
  promptVersion?: number | null;
  usage?: UsageLike | null;
  latencyMs: number;
  status: 'success' | 'error' | 'refused' | 'rate_limited' | 'disabled';
  errorCode?: string | null;
}): Promise<void> {
  const u = {
    input: entry.usage?.input_tokens ?? 0,
    output: entry.usage?.output_tokens ?? 0,
    cacheRead: entry.usage?.cache_read_input_tokens ?? 0,
    cacheWrite: entry.usage?.cache_creation_input_tokens ?? 0,
  };
  const { error } = await db().from('ai_usage_logs').insert({
    user_id: entry.userId,
    feature: entry.feature,
    provider: entry.provider,
    model: entry.model,
    prompt_key: entry.promptKey ?? null,
    prompt_version: entry.promptVersion ?? null,
    input_tokens: u.input,
    output_tokens: u.output,
    cache_read_tokens: u.cacheRead,
    cache_write_tokens: u.cacheWrite,
    cost_usd_micros: entry.provider === 'anthropic' ? costMicros(entry.model, u) : 0,
    latency_ms: entry.latencyMs,
    status: entry.status,
    error_code: entry.errorCode ?? null,
  });
  if (error) console.error('[ai] usage log failed', error.message);
}

export class AiRefusalError extends Error {}

function errorCode(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) return 'rate_limited';
  if (err instanceof Anthropic.AuthenticationError) return 'auth';
  if (err instanceof Anthropic.BadRequestError) return 'bad_request';
  if (err instanceof Anthropic.APIConnectionError) return 'connection';
  if (err instanceof Anthropic.APIError) return `api_${err.status}`;
  if (err instanceof AiRefusalError) return 'refused';
  return 'unknown';
}

export interface StructuredCall<S extends z.ZodType> {
  feature: AiFeature;
  userId: string | null;
  schema: S;
  /** Untrusted, member-provided content goes here, wrapped in tags by the caller. */
  input: string;
  /** Extra stable instructions appended after the registry prompt (cached). */
  extraSystem?: string;
}

/**
 * One-shot structured generation validated against a Zod schema.
 * Throws ApiError(service_unconfigured/feature_disabled) when AI is unavailable;
 * callers decide whether to fall back to engine output.
 */
export async function runStructured<S extends z.ZodType>(call: StructuredCall<S>): Promise<{ output: z.infer<S>; model: string; promptVersion: number | null }> {
  if (!integrations.anthropic) throw errors.unconfigured('Anthropic AI');
  const cfg = await getFeatureConfig(call.feature);
  if (!cfg.enabled || cfg.provider !== 'anthropic') throw errors.featureDisabled('This AI feature is turned off.');
  const prompt = await resolvePrompt(cfg.promptKey ?? call.feature);
  const started = Date.now();
  try {
    const res = await anthropic().beta.messages.parse({
      model: cfg.model,
      max_tokens: cfg.maxTokens,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      system: [{ type: 'text', text: prompt.text + (call.extraSystem ? `\n\n${call.extraSystem}` : ''), cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: call.input }],
      output_config: { format: zodOutputFormat(call.schema), ...(cfg.effort ? { effort: cfg.effort } : {}) },
    } as Parameters<ReturnType<typeof anthropic>['beta']['messages']['parse']>[0]);
    if (res.stop_reason === 'refusal') throw new AiRefusalError('Model declined the request');
    const parsed = (res as unknown as { parsed_output: z.infer<S> | null }).parsed_output;
    if (parsed === null || parsed === undefined) throw new Error('Structured output failed to parse');
    await logUsage({ userId: call.userId, feature: call.feature, provider: 'anthropic', model: res.model ?? cfg.model, promptKey: prompt.key, promptVersion: prompt.version, usage: res.usage, latencyMs: Date.now() - started, status: 'success' });
    return { output: parsed, model: res.model ?? cfg.model, promptVersion: prompt.version };
  } catch (err) {
    const code = errorCode(err);
    await logUsage({ userId: call.userId, feature: call.feature, provider: 'anthropic', model: cfg.model, promptKey: prompt.key, promptVersion: prompt.version, latencyMs: Date.now() - started, status: code === 'refused' ? 'refused' : code === 'rate_limited' ? 'rate_limited' : 'error', errorCode: code });
    throw err;
  }
}

export interface ChatCall {
  feature: AiFeature;
  userId: string | null;
  messages: Anthropic.Beta.BetaMessageParam[];
  extraSystem?: string;
  tools?: Anthropic.Beta.BetaToolUnion[];
}

/**
 * Streaming chat call returning a ReadableStream of text deltas plus a promise
 * of the final message (for persistence/logging). Used by conversational features.
 */
export async function streamChat(call: ChatCall): Promise<{ textStream: ReadableStream<Uint8Array>; final: Promise<{ text: string; message: Anthropic.Beta.BetaMessage | null }> }> {
  if (!integrations.anthropic) throw errors.unconfigured('Anthropic AI');
  const cfg = await getFeatureConfig(call.feature);
  if (!cfg.enabled || cfg.provider !== 'anthropic') throw errors.featureDisabled('This AI feature is turned off.');
  const prompt = await resolvePrompt(cfg.promptKey ?? call.feature);
  const started = Date.now();
  const stream = anthropic().beta.messages.stream({
    model: cfg.model,
    max_tokens: Math.max(cfg.maxTokens, 4000),
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    system: [{ type: 'text', text: prompt.text + (call.extraSystem ? `\n\n${call.extraSystem}` : ''), cache_control: { type: 'ephemeral' } }],
    messages: call.messages,
    ...(call.tools ? { tools: call.tools } : {}),
    ...(cfg.effort ? { output_config: { effort: cfg.effort } } : {}),
  } as Parameters<ReturnType<typeof anthropic>['beta']['messages']['stream']>[0]);

  const encoder = new TextEncoder();
  let text = '';
  let resolveFinal!: (v: { text: string; message: Anthropic.Beta.BetaMessage | null }) => void;
  const final = new Promise<{ text: string; message: Anthropic.Beta.BetaMessage | null }>((r) => (resolveFinal = r));

  const textStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            text += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const message = await stream.finalMessage();
        await logUsage({ userId: call.userId, feature: call.feature, provider: 'anthropic', model: message.model ?? cfg.model, promptKey: prompt.key, promptVersion: prompt.version, usage: message.usage, latencyMs: Date.now() - started, status: message.stop_reason === 'refusal' ? 'refused' : 'success' });
        if (message.stop_reason === 'refusal' && !text) {
          const msg = 'I can’t help with that request, but I’m happy to help with your match search.';
          text = msg;
          controller.enqueue(encoder.encode(msg));
        }
        resolveFinal({ text, message });
        controller.close();
      } catch (err) {
        await logUsage({ userId: call.userId, feature: call.feature, provider: 'anthropic', model: cfg.model, promptKey: prompt.key, promptVersion: prompt.version, latencyMs: Date.now() - started, status: 'error', errorCode: errorCode(err) });
        const msg = text ? '' : 'Sorry — the assistant is unavailable right now. Please try again in a moment.';
        if (msg) controller.enqueue(encoder.encode(msg));
        resolveFinal({ text: text || msg, message: null });
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });
  return { textStream, final };
}

/** Wrap untrusted member content so the model treats it as data, not instructions. */
export function untrusted(tag: string, value: unknown): string {
  const body = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return `<${tag}>\n${body.replaceAll(`</${tag}>`, '')}\n</${tag}>`;
}
