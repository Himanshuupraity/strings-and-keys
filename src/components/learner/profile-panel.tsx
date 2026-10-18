"use client";

import { useT } from "@/lib/i18n";
import { useState } from "react";
import { Cloud, KeyRound, Lock, LogOut, RefreshCw, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button, Callout, Card, CardBody, CardHeader, cn } from "@/components/ui";
import { useLearner } from "@/hooks/use-learner";
import { initials } from "@/lib/learner/names";
import { pushNow, resumeAfterUnlock, switchLearner } from "@/lib/learner/sync";
import { changePin, unlockLearner } from "@/lib/learner/pin-client";
import { patchLearner } from "@/lib/learner/store";
import { PinDialog } from "./pin-dialog";
import { syncLabel } from "./learner-menu";

/** Settings card: who is learning on this device and whether progress syncs to Supabase. */
export function ProfileSyncPanel() {
  const t = useT();
  const { learner, status } = useLearner();
  const [dialog, setDialog] = useState<null | "set" | "unlock">(null);
  if (!learner) return null;
  const id = learner.id;
  const s = syncLabel(status, t);
  return (
    <Card id="profile" className="scroll-mt-24">
      <CardHeader icon={<Cloud className="h-5 w-5" />} title={t("profile.title")} description={t("profile.description")} />
      <CardBody className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-guitar to-piano font-semibold text-white" aria-hidden>
            {initials(learner.name)}
          </span>
          <div>
            <p className="font-semibold">{learner.name}</p>
            <p className={cn("flex items-center gap-1.5 text-sm", s.tone)} role="status">
              <s.icon className={cn("h-4 w-4", status.state === "saving" && "animate-spin")} /> {s.text}
            </p>
          </div>
        </div>
        {status.state === "local-only" ? (
          <Callout tone="info" title={t("profile.syncTitle")}>
            {t("profile.syncLocalBody")}
          </Callout>
        ) : (
          <p className="text-sm text-muted">
            {t("profile.syncOnBody", { name: learner.name })}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {learner.id && (
            <Button variant="secondary" onClick={async () => { await pushNow(); toast.success(t("sync.savedToast")); }}>
              <RefreshCw className="h-4 w-4" /> {t("sync.syncNow")}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={async () => {
              const r = await switchLearner();
              if (!r.ok) toast.error(r.message);
            }}
          >
            <LogOut className="h-4 w-4" /> {t("sync.switchLearner")}
          </Button>
        </div>
        <div className="space-y-2 border-t border-border pt-4" data-testid="pin-settings">
          <p className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-muted" /> PIN protection
          </p>
          {!id ? (
            <p className="text-sm text-muted">{t("profile.pinNeedsDb")}</p>
          ) : status.state === "locked" ? (
            <>
              <p className="text-sm text-muted">{t("profile.pinChangedElsewhere")}</p>
              <Button onClick={() => setDialog("unlock")} data-testid="pin-unlock"><Unlock className="h-4 w-4" /> {t("profile.enterPin")}</Button>
            </>
          ) : learner.hasPin ? (
            <>
              <p className="flex items-center gap-1.5 text-sm text-muted"><Lock className="h-3.5 w-3.5" /> {t("profile.protected")}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setDialog("set")} data-testid="pin-change">{t("profile.changePin")}</Button>
                <Button
                  variant="ghost"
                  data-testid="pin-remove"
                  onClick={async () => {
                    if (!window.confirm("Remove the PIN? Anyone opening this site could then open your profile.")) return;
                    const r = await changePin(id, null);
                    if (!r.ok) return void toast.error(r.message);
                    patchLearner({ hasPin: false });
                    toast.success("PIN removed");
                  }}
                >
                  {t("profile.removePin")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">{t("profile.privacyNote")}</p>
              <Button variant="secondary" onClick={() => setDialog("set")} data-testid="pin-set"><Lock className="h-4 w-4" /> {t("profile.protectWithPin")}</Button>
            </>
          )}
        </div>
        {id && (
          <PinDialog
            open={dialog !== null}
            onClose={() => setDialog(null)}
            mode={dialog === "unlock" ? "enter" : "set"}
            title={dialog === "unlock" ? "Enter your PIN" : learner.hasPin ? "Choose a new PIN" : "Choose a 4-digit PIN"}
            subtitle={dialog === "unlock" ? undefined : "You'll need it to open your profile on a new device."}
            onSubmit={async (pin) => {
              if (dialog === "unlock") {
                const r = await unlockLearner(id, pin);
                if (!r.ok) return r.message;
                setDialog(null);
                toast.success("Unlocked — syncing again");
                await resumeAfterUnlock();
                return;
              }
              const r = await changePin(id, pin);
              if (!r.ok) return r.message;
              patchLearner({ hasPin: true });
              setDialog(null);
              toast.success(learner.hasPin ? "PIN changed" : "PIN set — your profile is protected");
            }}
          />
        )}
      </CardBody>
    </Card>
  );
}
