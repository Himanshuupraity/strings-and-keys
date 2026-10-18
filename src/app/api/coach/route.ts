import { NextResponse, connection, type NextRequest } from "next/server";
import { CoachRequestSchema, MAX_BODY_BYTES, type CoachResponse, type CoachStatus } from "@/lib/coach/schema";
import { RateLimiter } from "@/lib/coach/rate-limit";
import { ruleReply } from "@/lib/coach/rules";
import { readAIConfig } from "@/lib/server/ai/config";
import { callProvider, ProviderError } from "@/lib/server/ai/provider";

/** 20 requests per 5 minutes per client IP (per server instance). */
const limiter = new RateLimiter(20, 5 * 60_000);

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "local";
}

export async function GET() {
  await connection(); // read env at request time, never bake config into a prerender
  const { config, provider, reason } = readAIConfig();
  const body: CoachStatus = { configured: !!config, provider, model: config?.model ?? null, reason };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const rl = limiter.check(clientKey(req));
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  }

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "Could not read request." }, { status: 400 });
  }
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Request too large." }, { status: 413 });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = CoachRequestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request.", issues: parsed.error.issues.map((i) => i.message).slice(0, 5) }, { status: 400 });

  const body = parsed.data;
  const question = body.messages[body.messages.length - 1].content;
  const fallback = (reason: CoachResponse["fallbackReason"]): CoachResponse => ({ reply: ruleReply(question, body.context).text, source: "rules", fallbackReason: reason });

  const { config } = readAIConfig();
  if (!config) return NextResponse.json(fallback("not-configured"));

  try {
    const reply = await callProvider(config, body);
    const res: CoachResponse = { reply, source: "llm" };
    return NextResponse.json(res, { headers: { "x-ratelimit-remaining": String(rl.remaining) } });
  } catch (e) {
    const kind = e instanceof ProviderError ? e.kind : "other";
    console.warn(`[coach] provider failed (${kind}); using rule-based fallback`);
    return NextResponse.json(fallback(kind === "refused" ? "refused" : "provider-error"));
  }
}
