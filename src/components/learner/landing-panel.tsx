"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useLearner } from "@/hooks/use-learner";
import { useHydrated, usePrefs } from "@/hooks/use-prefs";
import { initials } from "@/lib/learner/names";
import { switchLearner } from "@/lib/learner/sync";
import { WelcomeCard } from "./welcome";
import { syncLabel } from "./learner-menu";

/** Home page hero panel: asks for a name, or welcomes a returning learner back. */
export function LandingLearnerPanel() {
  const hydrated = useHydrated();
  const { learner, status } = useLearner();
  const [prefs] = usePrefs();
  const router = useRouter();

  if (!hydrated) return <div className="mx-auto h-[420px] w-full max-w-md animate-pulse rounded-3xl bg-surface-2" aria-hidden />;

  if (!learner) {
    return (
      <WelcomeCard
        className="mx-auto"
        onReady={(kind) => router.push(kind === "existing" ? "/dashboard" : prefs.onboarded ? "/dashboard" : "/onboarding")}
      />
    );
  }

  const s = syncLabel(status);
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8" data-testid="welcome-back">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-guitar to-piano text-lg font-semibold text-white" aria-hidden>
          {initials(learner.name)}
        </span>
        <div>
          <p className="text-sm text-muted">Welcome back</p>
          <h2 className="font-display text-3xl tracking-tight">{learner.name}</h2>
        </div>
      </div>
      <p className={`mt-4 flex items-center gap-1.5 text-sm ${s.tone}`}>
        <s.icon className="h-4 w-4" aria-hidden /> {s.text}
      </p>
      <Link href={prefs.onboarded ? "/dashboard" : "/onboarding"} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-medium text-accent-fg hover:bg-accent-hover" data-testid="continue-learning">
        Continue learning <ArrowRight className="h-4 w-4" />
      </Link>
      <button type="button" onClick={() => void switchLearner()} className="mt-3 w-full rounded-xl py-2 text-sm text-muted hover:bg-surface-2 hover:text-text">
        Not {learner.name}? Switch learner
      </button>
    </div>
  );
}
