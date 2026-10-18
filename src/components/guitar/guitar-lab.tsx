"use client";

import { useT } from "@/lib/i18n";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dumbbell, Gauge, Grip, Layers, Music2, Waves } from "lucide-react";
import { PageHeader, Segmented } from "@/components/ui";
import { MetronomeWidget } from "@/components/practice/metronome-widget";
import { parseChord } from "@/lib/music/chords";
import { FretboardExplorer } from "./fretboard-explorer";
import { ChordExplorer } from "./chord-explorer";
import { ScaleExplorer } from "./scale-explorer";
import { CapoSimulator } from "./capo-simulator";
import { Transposer } from "./transposer";
import { GuitarExercises } from "./guitar-exercises";
import { TuningReference } from "./tuning-reference";

const TABS = [
  { value: "fretboard", label: "Fretboard", icon: Music2 },
  { value: "chords", label: "Chords", icon: Layers },
  { value: "scales", label: "Scales", icon: Waves },
  { value: "capo", label: "Capo & transposer", icon: Grip },
  { value: "exercises", label: "Exercises", icon: Dumbbell },
  { value: "tuning", label: "Tuning", icon: Gauge },
] as const;
type Tab = (typeof TABS)[number]["value"];

export function GuitarLab() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : "fretboard";
  const prog = (params.get("prog") ?? "").split(",").map((c) => c.trim()).filter((c) => c && parseChord(c));
  const key = params.get("key") ?? undefined;

  const setTab = (t: Tab) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", t);
    if (t !== "capo") {
      q.delete("prog");
      q.delete("key");
    }
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <div>
      <PageHeader
        eyebrow={t("nav./guitar-lab")}
        title={t("guitarLab.title")}
        description="Explore notes, chords and scales, simulate a capo, transpose songs into easy shapes and practise with instant feedback."
        actions={<MetronomeWidget />}
      />
      <div className="scrollbar-thin -mx-1 mb-6 overflow-x-auto px-1">
        <Segmented<Tab> label="Guitar Lab sections" value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t.value, label: t.label, icon: <t.icon className="h-4 w-4" aria-hidden />, testId: `tab-${t.value}` }))} />
      </div>
      <div className="space-y-6">
        {tab === "fretboard" && <FretboardExplorer />}
        {tab === "chords" && <ChordExplorer />}
        {tab === "scales" && <ScaleExplorer />}
        {tab === "capo" && (
          <>
            <CapoSimulator />
            <Transposer key={`${prog.join(",")}|${key ?? ""}`} initialProgression={prog} initialKey={key} />
          </>
        )}
        {tab === "exercises" && <GuitarExercises />}
        {tab === "tuning" && <TuningReference />}
      </div>
    </div>
  );
}
