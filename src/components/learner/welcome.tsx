"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CloudOff, Loader2, UserRound } from "lucide-react";
import { Button, Callout, Input, cn } from "@/components/ui";
import { BRAND, } from "@/config/brand";
import { LearnerNameSchema, initials } from "@/lib/learner/names";
import { createLearner, fetchLearners, selectLearner, type LearnerSummary } from "@/lib/learner/sync";

function lastActive(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const mins = Math.round(diff / 60000);
  if (mins < 60) return rtf.format(-Math.max(mins, 0), "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

/**
 * "What's your name?" — creates a learner profile, or lets someone on a new device pick their name
 * to continue with their saved progress.
 */
export function WelcomeCard({ onReady, className }: { onReady?: (kind: "new" | "existing") => void; className?: string }) {
  const [list, setList] = useState<{ loading: boolean; enabled: boolean; learners: LearnerSummary[]; error?: string }>({ loading: true, enabled: false, learners: [] });
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<LearnerSummary | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchLearners().then((r) => alive && setList({ loading: false, ...r }));
    return () => {
      alive = false;
    };
  }, []);

  const pick = async (l: LearnerSummary) => {
    setBusy(l.id);
    setError(null);
    try {
      await selectLearner(l);
      onReady?.("existing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load that profile.");
      setBusy(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = LearnerNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please enter your name.");
      return;
    }
    setBusy("new");
    setError(null);
    try {
      const r = await createLearner(parsed.data);
      if (r.kind === "exists") {
        setConfirm(r.learner);
        setBusy(null);
        return;
      }
      onReady?.("new");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your name.");
      setBusy(null);
    }
  };

  return (
    <div className={cn("w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8", className)} data-testid="welcome-card">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <UserRound className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="font-display text-3xl tracking-tight">What&apos;s your name?</h2>
      <p className="mt-1.5 text-sm text-muted">
        {list.enabled ? "Your progress is saved under your name, so you can continue on any device." : "Your progress will be saved under your name on this device."}
      </p>

      {confirm ? (
        <div className="mt-5 space-y-3" role="alert">
          <p className="text-sm">
            Someone named <strong>{confirm.name}</strong> is already learning with {BRAND.name}. Is that you?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void pick(confirm)} loading={busy === confirm.id} data-testid="confirm-existing">
              Yes, continue my progress
            </Button>
            <Button variant="ghost" onClick={() => { setConfirm(null); setName(""); }}>
              No, use another name
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
          <label htmlFor="learner-name" className="sr-only">Your name</label>
          <Input
            id="learner-name"
            autoFocus
            autoComplete="given-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Asha"
            aria-invalid={!!error}
            aria-describedby={error ? "learner-name-error" : undefined}
            className="h-12 text-base"
            data-testid="learner-name"
          />
          <Button type="submit" size="lg" className="w-full" loading={busy === "new"} disabled={!!busy && busy !== "new"} data-testid="learner-continue">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      )}

      {error && (
        <p id="learner-name-error" className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {list.loading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Looking for saved learners…
        </p>
      ) : list.learners.length > 0 && !confirm ? (
        <div className="mt-7">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Already learning? Pick your name</p>
          <ul className="scrollbar-thin max-h-64 space-y-1.5 overflow-y-auto" data-testid="learner-list">
            {list.learners.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => void pick(l)}
                  disabled={!!busy}
                  className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-guitar to-piano text-sm font-semibold text-white" aria-hidden>
                    {initials(l.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{l.name}</span>
                    <span className="block text-xs text-muted">Last active {lastActive(l.updatedAt)}</span>
                  </span>
                  {busy === l.id ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : <ArrowRight className="h-4 w-4 text-subtle" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {list.error && (
        <Callout tone="warn" className="mt-5" icon={<CloudOff className="h-4 w-4" />}>
          {list.error} You can still continue — progress is saved on this device.
        </Callout>
      )}
    </div>
  );
}

/** Full-page version shown in front of the app until a name is chosen. */
export function WelcomeScreen() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center py-8">
      <WelcomeCard />
    </div>
  );
}
