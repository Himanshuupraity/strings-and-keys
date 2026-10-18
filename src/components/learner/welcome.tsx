"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CloudOff, Loader2, Lock, UserRound } from "lucide-react";
import { Button, Callout, Input, cn } from "@/components/ui";
import { BRAND } from "@/config/brand";
import { useLang, useT } from "@/lib/i18n";
import { LearnerNameSchema, initials } from "@/lib/learner/names";
import { createLearner, fetchLearners, PinRequiredError, selectLearner, type LearnerSummary } from "@/lib/learner/sync";
import { changePin, getToken, unlockLearner } from "@/lib/learner/pin-client";
import { loadLearner, patchLearner } from "@/lib/learner/store";
import { PinPad } from "./pin-pad";

function lastActive(iso: string, lang: "en" | "hi" = "en"): string {
  const diff = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(lang === "hi" ? "hi" : undefined, { numeric: "auto" });
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
  const t = useT();
  const lang = useLang();
  const [list, setList] = useState<{ loading: boolean; enabled: boolean; pinSupported: boolean; learners: LearnerSummary[]; error?: string }>({ loading: true, enabled: false, pinSupported: false, learners: [] });
  /** Profile waiting for its PIN before it can be opened. */
  const [unlock, setUnlock] = useState<LearnerSummary | null>(null);
  /** Just-created profile: offer to protect it with a PIN. */
  const [offerPin, setOfferPin] = useState(false);
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
    setError(null);
    if (l.hasPin && !getToken(l.id)) {
      setConfirm(null);
      setUnlock(l);
      return;
    }
    setBusy(l.id);
    try {
      await selectLearner(l);
      onReady?.("existing");
    } catch (e) {
      if (e instanceof PinRequiredError) {
        setConfirm(null);
        setUnlock(e.learner);
      } else setError(e instanceof Error ? e.message : t("welcome.couldntLoad"));
      setBusy(null);
    }
  };

  const submitPin = async (pin: string) => {
    if (!unlock) return;
    const r = await unlockLearner(unlock.id, pin);
    if (!r.ok) return r.message;
    const target = unlock;
    setUnlock(null);
    await pick({ ...target, hasPin: true });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = LearnerNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(lang === "hi" ? t("welcome.enterName") : parsed.error.issues[0]?.message ?? t("welcome.enterName"));
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
      if (r.kind === "created" && list.pinSupported) {
        setBusy(null);
        setOfferPin(true);
        return;
      }
      onReady?.("new");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("welcome.couldntSave"));
      setBusy(null);
    }
  };

  if (unlock) {
    return (
      <div className={cn("w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8", className)} data-testid="welcome-card">
        <PinPad title={t("welcome.enterPinFor", { name: unlock.name })} subtitle={t("welcome.protected")} onSubmit={submitPin} onCancel={() => setUnlock(null)} cancelLabel={t("common.back")} />
      </div>
    );
  }

  if (offerPin) {
    const finish = () => {
      setOfferPin(false);
      onReady?.("new");
    };
    return (
      <div className={cn("w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8", className)} data-testid="welcome-card">
        <PinPad
          mode="set"
          title={t("welcome.protectTitle")}
          subtitle={t("welcome.protectBody")}
          onSubmit={async (pin) => {
            const me = loadLearner();
            if (!me?.id) return finish();
            const r = await changePin(me.id, pin);
            if (!r.ok) return r.message;
            patchLearner({ hasPin: true });
            finish();
          }}
          onCancel={finish}
          cancelLabel={t("welcome.skipForNow")}
        />
      </div>
    );
  }

  return (
    <div className={cn("w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8", className)} data-testid="welcome-card">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <UserRound className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="font-display text-3xl tracking-tight">{t("welcome.title")}</h2>
      <p className="mt-1.5 text-sm text-muted">
        {list.enabled ? t("welcome.subtitleSync") : t("welcome.subtitleLocal")}
      </p>

      {confirm ? (
        <div className="mt-5 space-y-3" role="alert">
          <p className="text-sm">
            {t("welcome.isThatYou", { name: confirm.name, brand: BRAND.name })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void pick(confirm)} loading={busy === confirm.id} data-testid="confirm-existing">
              {t("welcome.yesContinue")}
            </Button>
            <Button variant="ghost" onClick={() => { setConfirm(null); setName(""); }}>
              {t("welcome.noOther")}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
          <label htmlFor="learner-name" className="sr-only">{t("welcome.nameLabel")}</label>
          <Input
            id="learner-name"
            autoFocus
            autoComplete="given-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("welcome.placeholder")}
            aria-invalid={!!error}
            aria-describedby={error ? "learner-name-error" : undefined}
            className="h-12 text-base"
            data-testid="learner-name"
          />
          <Button type="submit" size="lg" className="w-full" loading={busy === "new"} disabled={!!busy && busy !== "new"} data-testid="learner-continue">
            {t("welcome.continue")} <ArrowRight className="h-4 w-4" />
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
          <Loader2 className="h-4 w-4 animate-spin" /> {t("welcome.lookingUp")}
        </p>
      ) : list.learners.length > 0 && !confirm ? (
        <div className="mt-7">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">{t("welcome.pickName")}</p>
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
                    <span className="flex items-center gap-1.5 truncate font-medium">
                      {l.name}
                      {l.hasPin && <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-label={t("welcome.pinProtected")} />}
                    </span>
                    <span className="block text-xs text-muted">{t("welcome.lastActive", { when: lastActive(l.updatedAt, lang) })}</span>
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
          {list.error} {t("welcome.offlineNote")}
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
