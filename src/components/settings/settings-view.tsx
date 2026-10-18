"use client";

import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Download, HardDrive, Laptop, Mic, Moon, Music, Piano, ShieldCheck, Sun, Target, Trash2, Upload, User } from "lucide-react";
import { Button, Callout, Card, CardBody, CardHeader, Field, Input, PageHeader, Segmented, Select, Slider, Switch } from "@/components/ui";
import { useHydrated, usePrefs } from "@/hooks/use-prefs";
import { useData } from "@/hooks/use-data";
import { applyImport, exportAll, goalsRepo, planImport, profileRepo, resetAllData, type ImportPlan } from "@/lib/storage/repositories";
import { getAdapter } from "@/lib/storage/db";
import { KEYBOARD_PRESETS, SELECTABLE_SIZES, type KeyboardSize } from "@/lib/music/keyboard";
import { SHARP_NAMES, FLAT_NAMES } from "@/lib/music/notes";
import { labelNote } from "@/lib/music/sargam";
import { midiSupported } from "@/lib/audio/midi";
import { micSupported } from "@/lib/audio/microphone";
import { DEFAULT_GOALS, type Goals, type Prefs } from "@/lib/storage/schemas";

function Section({ id, icon, title, description, children }: { id?: string; icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader icon={icon} title={title} description={description} />
      <CardBody className="space-y-5">{children}</CardBody>
    </Card>
  );
}

export function SettingsView({ accountPanel }: { accountPanel?: ReactNode }) {
  const [prefs, setPrefs] = usePrefs();
  const profile = useData(() => profileRepo.get(), ["profile"], undefined);
  const goals = useData(() => goalsRepo.get(), ["goals"], DEFAULT_GOALS);
  const [nameDraft, setName] = useState<string | null>(null);
  const name = nameDraft ?? profile.data?.name ?? "";
  const hydrated = useHydrated();
  const env = hydrated ? { mic: micSupported(), midi: midiSupported(), storage: getAdapter().kind as string } : { mic: false, midi: false, storage: "…" };
  const [pending, setPending] = useState<{ bundle: unknown; plan: ImportPlan } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);


  const saveGoals = (patch: Partial<Goals>) => void goalsRepo.save({ ...goals.data, ...patch });
  const tonicName = (pc: number) => (prefs.spelling === "flat" ? FLAT_NAMES : SHARP_NAMES)[pc];

  const doExport = async () => {
    const bundle = await exportAll();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `melody-masters-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Backup downloaded");
  };

  const onFile = async (f: File) => {
    try {
      const bundle = JSON.parse(await f.text());
      const plan = await planImport(bundle);
      setPending({ bundle, plan });
    } catch {
      toast.error("That file isn't a valid Melody Masters backup.");
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Settings" description="Preferences are saved on this device automatically." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={<User className="h-5 w-5" />} title="Profile">
          <Field label="Your name (optional)" htmlFor="name" hint="Only used for the greeting. It stays on this device.">
            <div className="flex gap-2">
              <Input id="name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Asha" />
              <Button variant="secondary" onClick={() => profileRepo.save({ ...(profile.data ?? {}), name }).then(() => toast.success("Saved"))}>Save</Button>
            </div>
          </Field>
          <Field label="Instrument mode">
            <Segmented<Prefs["instrument"]> label="Instrument" value={prefs.instrument} onChange={(instrument) => setPrefs({ instrument })} options={[{ value: "guitar", label: "Guitar" }, { value: "piano", label: "Piano / keyboard" }]} />
          </Field>
          <Switch checked={prefs.hinglish} onChange={(hinglish) => setPrefs({ hinglish })} label="Show Hinglish explanations" description="Adds Roman-script Hindi-English explanations where lessons provide them." />
          <Switch checked={!prefs.onboarded} onChange={(v) => setPrefs({ onboarded: !v })} label="Show onboarding prompt again" />
        </Section>

        <Section icon={prefs.theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />} title="Appearance">
          <Field label="Theme" hint="“System” follows your device's light/dark setting.">
            <Segmented<Prefs["theme"]>
              label="Theme"
              value={prefs.theme}
              onChange={(theme) => setPrefs({ theme })}
              options={[
                { value: "light", label: "Light", icon: <Sun className="h-4 w-4" />, testId: "theme-light" },
                { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" />, testId: "theme-dark" },
                { value: "system", label: "System", icon: <Laptop className="h-4 w-4" />, testId: "theme-system" },
              ]}
            />
          </Field>
        </Section>

        <Section icon={<Music className="h-5 w-5" />} title="Note names: Western & Sargam" description="Used on the keyboard, fretboard, tuner, scales and lessons.">
          <Field label="Label style">
            <Segmented<Prefs["labelMode"]> label="Label style" value={prefs.labelMode} onChange={(labelMode) => setPrefs({ labelMode })} options={[{ value: "western", label: "Western", testId: "label-western" }, { value: "sargam", label: "Sargam", testId: "label-sargam" }, { value: "both", label: "Both", testId: "label-both" }]} />
          </Field>
          <Field label="Sa (tonic)" htmlFor="tonic" hint="In Indian music Sa is movable — pick the note you want to call Sa. Harmonium players often use C or C#; many singers choose a Sa that suits their voice.">
            <Select id="tonic" value={prefs.tonicPc} onChange={(e) => setPrefs({ tonicPc: Number(e.target.value) })} data-testid="tonic-select">
              {Array.from({ length: 12 }, (_, pc) => <option key={pc} value={pc}>{tonicName(pc)}</option>)}
            </Select>
          </Field>
          <div className="rounded-xl bg-surface-2 p-3 text-sm">
            <p className="mb-2 text-xs font-medium text-muted">Preview with Sa = {tonicName(prefs.tonicPc)}</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 12 }, (_, i) => 60 + prefs.tonicPc + i).map((m) => (
                <span key={m} className="rounded-md border border-border bg-surface px-2 py-1 text-xs">{labelNote(m, { mode: "both", tonicPc: prefs.tonicPc, spelling: prefs.spelling }).text}</span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">This uses equal temperament. Hindustani intonation (shruti) and raga-specific treatment of notes can differ slightly.</p>
          </div>
          <Field label="Sharps or flats for black keys">
            <Segmented<Prefs["spelling"]> label="Accidental spelling" value={prefs.spelling} onChange={(spelling) => setPrefs({ spelling })} options={[{ value: "sharp", label: "C# D# F#…" }, { value: "flat", label: "Db Eb Gb…" }]} />
          </Field>
        </Section>

        <Section icon={<Piano className="h-5 w-5" />} title="Instruments & audio">
          <Field label="Virtual piano size">
            <Segmented<KeyboardSize> label="Keyboard size" value={prefs.keyboardSize} onChange={(keyboardSize) => setPrefs({ keyboardSize: keyboardSize as 49 | 61 | 88 })} options={SELECTABLE_SIZES.map((s) => ({ value: s, label: KEYBOARD_PRESETS[s].label }))} />
          </Field>
          <Switch checked={prefs.showBlackKeyLabels} onChange={(showBlackKeyLabels) => setPrefs({ showBlackKeyLabels })} label="Label black keys" />
          <Switch checked={prefs.leftHanded} onChange={(leftHanded) => setPrefs({ leftHanded })} label="Left-handed guitar view" description="Mirrors the fretboard so the nut is on the right." />
          <Slider label="Frets shown" min={12} max={24} value={prefs.fretCount} onChange={(fretCount) => setPrefs({ fretCount })} />
          <Slider label="Tuning reference (A4)" min={430} max={450} value={prefs.a4} onChange={(a4) => setPrefs({ a4 })} format={(v) => `${v} Hz`} />
          <Slider label="Volume" min={0} max={1} step={0.05} value={prefs.volume} onChange={(volume) => setPrefs({ volume })} format={(v) => `${Math.round(v * 100)}%`} />
        </Section>

        <Section id="goals" icon={<Target className="h-5 w-5" />} title="Practice goals">
          <Slider label="Daily practice" min={5} max={60} step={5} value={goals.data.dailyMinutes} onChange={(dailyMinutes) => saveGoals({ dailyMinutes })} format={(v) => `${v} min`} />
          <Slider label="Practice days per week" min={1} max={7} value={goals.data.weeklyPracticeDays} onChange={(weeklyPracticeDays) => saveGoals({ weeklyPracticeDays })} />
          <Slider label="Chord-change drills per week" min={0} max={20} value={goals.data.weeklyChordDrills} onChange={(weeklyChordDrills) => saveGoals({ weeklyChordDrills })} />
          <p className="text-xs text-muted">For beginners, 10–30 minutes a day is plenty. Sessions over 30 minutes include a short break. Stop if anything hurts.</p>
        </Section>

        <Section icon={<HardDrive className="h-5 w-5" />} title="Your data" description="Your progress is saved on this device.">
          <p className="text-sm text-muted">
            Storage in use: <strong className="text-text">{env.storage === "indexedDB" ? "this browser (IndexedDB)" : env.storage === "localStorage" ? "this browser (localStorage)" : env.storage === "memory" ? "temporary memory only — storage is blocked" : env.storage}</strong>. Clearing your browser data erases it, so download a backup now and then.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={doExport}><Download className="h-4 w-4" /> Download backup</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Import backup</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
          {pending && (
            <Callout tone="info" title="Review import before applying">
              <p>{pending.plan.added} new records, {pending.plan.identical} identical, {pending.plan.conflicts.length} that differ from what&apos;s on this device.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={async () => { await applyImport(pending.bundle, "keep-local"); setPending(null); toast.success("Imported new records; kept this device's versions of conflicts"); }}>Import, keep this device on conflicts</Button>
                {pending.plan.conflicts.length > 0 && (
                  <Button size="sm" variant="secondary" onClick={async () => { await applyImport(pending.bundle, "keep-imported"); setPending(null); toast.success("Imported; backup versions replaced conflicts"); }}>Import, prefer backup on conflicts</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
              </div>
            </Callout>
          )}
          <div className="border-t border-border pt-4">
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (!window.confirm("Erase all lesson progress, practice history and saved items on this device? Preferences are kept.")) return;
                await resetAllData();
                toast.success("Progress erased");
              }}
            >
              <Trash2 className="h-4 w-4" /> Erase progress on this device
            </Button>
          </div>
        </Section>

        {accountPanel}

        <Section icon={<ShieldCheck className="h-5 w-5" />} title="Privacy, microphone & browser support">
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex gap-2"><Mic className="mt-0.5 h-4 w-4 shrink-0" />The microphone is used only after you press a “Listen” button, a red indicator shows while it&apos;s on, and audio is analysed on your device. Nothing is recorded or uploaded.</li>
            <li>The coach runs entirely in your browser — your questions are never sent anywhere.</li>
            <li>Microphone: {env.mic ? "supported in this browser." : "not available in this browser or page."}</li>
            <li>Web MIDI: {env.midi ? "supported — connect a keyboard in the Piano Lab." : "not supported here. Use Chrome or Edge on desktop for MIDI keyboards (Safari doesn't support Web MIDI)."}</li>
            <li>Best experience: a recent Chromium browser (Chrome, Edge). Safari works for the virtual instruments and microphone but not MIDI.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
