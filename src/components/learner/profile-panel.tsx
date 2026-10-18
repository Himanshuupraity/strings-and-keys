"use client";

import { Cloud, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button, Callout, Card, CardBody, CardHeader, cn } from "@/components/ui";
import { useLearner } from "@/hooks/use-learner";
import { initials } from "@/lib/learner/names";
import { pushNow, switchLearner } from "@/lib/learner/sync";
import { syncLabel } from "./learner-menu";

/** Settings card: who is learning on this device and whether progress syncs to Supabase. */
export function ProfileSyncPanel() {
  const { learner, status } = useLearner();
  if (!learner) return null;
  const s = syncLabel(status);
  return (
    <Card id="profile" className="scroll-mt-24">
      <CardHeader icon={<Cloud className="h-5 w-5" />} title="Your profile & sync" description="Your progress is saved under your name." />
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
          <Callout tone="info" title="Sync across devices">
            Progress is saved in this browser only. When the site&apos;s Supabase database is set up, your progress uploads automatically and you can pick your name on any device to continue.
          </Callout>
        ) : (
          <p className="text-sm text-muted">
            Changes upload a couple of seconds after you practise. On another device, open the site and pick <strong className="text-text">{learner.name}</strong> to continue where you left off.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {learner.id && (
            <Button variant="secondary" onClick={async () => { await pushNow(); toast.success("Progress saved to your profile"); }}>
              <RefreshCw className="h-4 w-4" /> Sync now
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={async () => {
              const r = await switchLearner();
              if (!r.ok) toast.error(r.message);
            }}
          >
            <LogOut className="h-4 w-4" /> Switch learner
          </Button>
        </div>
        <p className="text-xs text-muted">
          Note: profiles use only a name — there&apos;s no password — so anyone who opens this site can pick any name on the list. Don&apos;t store anything private here.
        </p>
      </CardBody>
    </Card>
  );
}
