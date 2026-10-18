/**
 * Server-only AI provider configuration. Never import this from client components:
 * it reads secrets from process.env. Only src/app/api/coach/route.ts imports it.
 */
if (typeof window !== "undefined") {
  throw new Error("src/lib/server/ai must only be imported on the server");
}

export type ProviderId = "anthropic" | "openai" | "openai-compatible";

export interface AIConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

/** Default Anthropic model. Override with AI_MODEL. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

export function readAIConfig(env: Record<string, string | undefined> = process.env): { config: AIConfig | null; reason?: string; provider: ProviderId | null } {
  const raw = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  const provider: ProviderId | null =
    raw === "anthropic" || raw === "openai" || raw === "openai-compatible"
      ? raw
      : raw === ""
        ? env.ANTHROPIC_API_KEY || (env.AI_API_KEY && !env.OPENAI_API_KEY)
          ? "anthropic"
          : env.OPENAI_API_KEY
            ? "openai"
            : null
        : null;
  if (raw && !provider) return { config: null, provider: null, reason: `Unknown AI_PROVIDER "${raw}". Use anthropic, openai or openai-compatible.` };
  if (!provider) return { config: null, provider: null, reason: "No AI provider configured." };

  const apiKey = env.AI_API_KEY || (provider === "anthropic" ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY) || "";
  if (!apiKey) return { config: null, provider, reason: `Set AI_API_KEY${provider === "anthropic" ? " (or ANTHROPIC_API_KEY)" : " (or OPENAI_API_KEY)"}.` };

  if (provider === "anthropic") return { provider, config: { provider, apiKey, model: env.AI_MODEL || DEFAULT_ANTHROPIC_MODEL, baseUrl: env.AI_BASE_URL || undefined } };

  // OpenAI-style providers: we don't guess a model name — it must be configured explicitly.
  const model = env.AI_MODEL;
  if (!model) return { config: null, provider, reason: "Set AI_MODEL to the model name your provider offers." };
  if (provider === "openai-compatible" && !env.AI_BASE_URL) return { config: null, provider, reason: "Set AI_BASE_URL for an OpenAI-compatible provider (e.g. http://localhost:11434/v1)." };
  return { provider, config: { provider, apiKey, model, baseUrl: provider === "openai" ? env.AI_BASE_URL || "https://api.openai.com/v1" : env.AI_BASE_URL } };
}
