"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff } from "lucide-react";
import { Callout } from "@/components/ui";
import type { CoachStatus } from "@/lib/coach/schema";

export function useCoachStatus() {
  const [status, setStatus] = useState<CoachStatus | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/coach", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((s: CoachStatus) => alive && setStatus(s))
      .catch(() => alive && setStatus({ configured: false, provider: null, model: null, reason: "Offline — using the built-in coach." }));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}

export function CoachStatusBanner({ status }: { status: CoachStatus | null }) {
  if (!status) return <div className="h-[58px] animate-pulse rounded-xl bg-surface-2" aria-hidden />;
  if (status.configured) {
    return (
      <Callout tone="success" icon={<Cloud className="h-4 w-4 text-success" />} title="Cloud AI coach is on">
        Chat answers come from {status.provider}{status.model ? ` (${status.model})` : ""}. Only your question and practice context (instrument, lesson, measured scores) are sent — never your name, email or audio.
      </Callout>
    );
  }
  return (
    <Callout tone="neutral" icon={<CloudOff className="h-4 w-4 text-muted" />} title="Using the built-in offline coach">
      <span>
        Everything here works without an API key — the listening teacher is fully local and chat answers common beginner questions. To enable a cloud AI teacher, add to <code className="rounded bg-surface-3 px-1">.env.local</code>:{" "}
        <code className="rounded bg-surface-3 px-1">AI_PROVIDER=anthropic</code> and <code className="rounded bg-surface-3 px-1">AI_API_KEY=…</code> (optionally <code className="rounded bg-surface-3 px-1">AI_MODEL</code>), then restart the server. See the README for OpenAI-compatible providers.
        {status.reason && <span className="mt-1 block text-xs">Status: {status.reason}</span>}
      </span>
    </Callout>
  );
}
