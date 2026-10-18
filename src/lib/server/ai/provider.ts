import Anthropic from "@anthropic-ai/sdk";
import type { CoachRequest } from "@/lib/coach/schema";
import type { AIConfig } from "./config";
import { SYSTEM_PROMPT, contextBlock } from "./prompt";

if (typeof window !== "undefined") {
  throw new Error("src/lib/server/ai must only be imported on the server");
}

export class ProviderError extends Error {
  constructor(message: string, readonly kind: "auth" | "rate-limit" | "timeout" | "refused" | "bad-response" | "network" | "other") {
    super(message);
  }
}

const TIMEOUT_MS = 45_000;
/** Models that accept the server-side refusal fallback. */
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

function buildMessages(req: CoachRequest) {
  const msgs = req.messages.map((m) => ({ ...m }));
  // The API requires the first turn to be the user's.
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  const last = msgs[msgs.length - 1];
  last.content = last.content + contextBlock(req.context);
  return msgs;
}

async function callAnthropic(cfg: AIConfig, req: CoachRequest): Promise<string> {
  const client = new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl, timeout: TIMEOUT_MS, maxRetries: 1 });
  const messages: Anthropic.Beta.BetaMessageParam[] = buildMessages(req);
  const useFallback = FALLBACK_MODELS.has(cfg.model);
  try {
    const res = await client.beta.messages.create({
      model: cfg.model,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
      // Short conversational coaching: low effort keeps replies quick and inexpensive.
      output_config: { effort: "low" },
      // On a policy decline, the API retries on the fallback model within the same call.
      ...(useFallback ? { betas: ["server-side-fallback-2026-06-01"], fallbacks: [{ model: "claude-opus-4-8" }] } : {}),
    });
    if (res.stop_reason === "refusal") throw new ProviderError("The AI declined to answer this request.", "refused");
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) throw new ProviderError("Empty response from the AI provider.", "bad-response");
    return text;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new ProviderError("The AI API key was rejected.", "auth");
    if (e instanceof Anthropic.RateLimitError) throw new ProviderError("The AI provider is rate limiting requests.", "rate-limit");
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new ProviderError("The AI provider took too long to answer.", "timeout");
    if (e instanceof Anthropic.APIConnectionError) throw new ProviderError("Couldn't reach the AI provider.", "network");
    if (e instanceof Anthropic.APIError) throw new ProviderError(`AI provider error (${e.status ?? "unknown"}).`, "other");
    throw new ProviderError("Unexpected AI provider error.", "other");
  }
}

/** OpenAI Chat Completions–compatible HTTP API (OpenAI, Ollama, LM Studio, OpenRouter…). */
async function callOpenAICompatible(cfg: AIConfig, req: CoachRequest): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.baseUrl!.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: "system", content: SYSTEM_PROMPT }, ...buildMessages(req)] }),
    });
    if (res.status === 401 || res.status === 403) throw new ProviderError("The AI API key was rejected.", "auth");
    if (res.status === 429) throw new ProviderError("The AI provider is rate limiting requests.", "rate-limit");
    if (!res.ok) throw new ProviderError(`AI provider error (${res.status}).`, "other");
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new ProviderError("Empty response from the AI provider.", "bad-response");
    return text;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if ((e as Error)?.name === "AbortError") throw new ProviderError("The AI provider took too long to answer.", "timeout");
    throw new ProviderError("Couldn't reach the AI provider.", "network");
  } finally {
    clearTimeout(timer);
  }
}

export function callProvider(cfg: AIConfig, req: CoachRequest): Promise<string> {
  return cfg.provider === "anthropic" ? callAnthropic(cfg, req) : callOpenAICompatible(cfg, req);
}
