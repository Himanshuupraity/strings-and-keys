"use client";

import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Download, HardDrive, Languages, Laptop, Mic, Moon, Music, Piano, ShieldCheck, Sun, Target, Trash2, Upload, User } from "lucide-react";
import { Button, Callout, Card, CardBody, CardHeader, Field, PageHeader, Segmented, Select, Slider, Switch } from "@/components/ui";
import { useHydrated, usePrefs } from "@/hooks/use-prefs";
import { useT } from "@/lib/i18n";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { PianoSoundSetting } from "./piano-sound-setting";
import { ReminderSetting } from "./reminder-setting";
import { useData } from "@/hooks/use-data";
import { applyImport, exportAll, goalsRepo, planImport, resetAllData, type ImportPlan } from "@/lib/storage/repositories";
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
  const t = useT();
  const [prefs, setPrefs] = usePrefs();
  const goals = useData(() => goalsRepo.get(), ["goals"], DEFAULT_GOALS);
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
    toast.success(t("ui.backup_downloaded"));
  };

  const onFile = async (f: File) => {
    try {
      const bundle = JSON.parse(await f.text());
      const plan = await planImport(bundle);
      setPending({ bundle, plan });
    } catch {
      toast.error(t("ui.that_file_isn_t_a_valid_melody_masters_backup"));
    }
  };

  return (
    <div>
      <PageHeader eyebrow={t("settings.eyebrow")} title={t("settings.title")} description={t("settings.description")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={<Languages className="h-5 w-5" />} title={t("settings.languageTitle")} description={t("settings.languageHint")}>
          <LanguageSwitch />
        </Section>

        <Section icon={<User className="h-5 w-5" />} title={t("settings.profile")}>
          <Field label={t("settings.instrumentMode")}>
            <Segmented<Prefs["instrument"]> label={t("ui.instrument")} value={prefs.instrument} onChange={(instrument) => setPrefs({ instrument })} options={[{ value: "guitar", label: t("shell.guitar") }, { value: "piano", label: t("ui.piano_keyboard") }]} />
          </Field>
          <Switch checked={prefs.hinglish} onChange={(hinglish) => setPrefs({ hinglish })} label={t("settings.hinglish")} description={t("settings.hinglishHint")} />
          <Switch checked={!prefs.onboarded} onChange={(v) => setPrefs({ onboarded: !v })} label={t("ui.show_onboarding_prompt_again")} />
        </Section>

        <Section icon={prefs.theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />} title={t("settings.appearance")}>
          <Field label={t("settings.theme")} hint={t("settings.themeHint")}>
            <Segmented<Prefs["theme"]>
              label={t("settings.theme")}
              value={prefs.theme}
              onChange={(theme) => setPrefs({ theme })}
              options={[
                { value: "light", label: t("settings.light"), icon: <Sun className="h-4 w-4" />, testId: "theme-light" },
                { value: "dark", label: t("settings.dark"), icon: <Moon className="h-4 w-4" />, testId: "theme-dark" },
                { value: "system", label: t("settings.system"), icon: <Laptop className="h-4 w-4" />, testId: "theme-system" },
              ]}
            />
          </Field>
        </Section>

        <Section icon={<Music className="h-5 w-5" />} title={t("settings.noteNames")} description={t("ui.used_on_the_keyboard_fretboard_tuner_scales_and")}>
          <Field label={t("ui.label_style")}>
            <Segmented<Prefs["labelMode"]> label={t("ui.label_style")} value={prefs.labelMode} onChange={(labelMode) => setPrefs({ labelMode })} options={[{ value: "western", label: t("ui.western"), testId: "label-western" }, { value: "sargam", label: t("ui.sargam"), testId: "label-sargam" }, { value: "both", label: t("ui.both"), testId: "label-both" }]} />
          </Field>
          <Field label={t("ui.sa_tonic")} htmlFor="tonic" hint={t("ui.in_indian_music_sa_is_movable_pick_the_note_you")}>
            <Select id="tonic" value={prefs.tonicPc} onChange={(e) => setPrefs({ tonicPc: Number(e.target.value) })} data-testid="tonic-select">
              {Array.from({ length: 12 }, (_, pc) => <option key={pc} value={pc}>{tonicName(pc)}</option>)}
            </Select>
          </Field>
          <div className="rounded-xl bg-surface-2 p-3 text-sm">
            <p className="mb-2 text-xs font-medium text-muted">{t("ui.preview_with_sa", { note: tonicName(prefs.tonicPc) })}</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 12 }, (_, i) => 60 + prefs.tonicPc + i).map((m) => (
                <span key={m} className="rounded-md border border-border bg-surface px-2 py-1 text-xs">{labelNote(m, { mode: "both", tonicPc: prefs.tonicPc, spelling: prefs.spelling }).text}</span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{t("ui.this_uses_equal_temperament_hindustani_intonatio")}</p>
          </div>
          <Field label={t("ui.sharps_or_flats_for_black_keys")}>
            <Segmented<Prefs["spelling"]> label={t("ui.accidental_spelling")} value={prefs.spelling} onChange={(spelling) => setPrefs({ spelling })} options={[{ value: "sharp", label: "C# D# F#…" }, { value: "flat", label: "Db Eb Gb…" }]} />
          </Field>
        </Section>

        <Section icon={<Piano className="h-5 w-5" />} title={t("settings.instruments")}>
          <Field label={t("ui.virtual_piano_size")}>
            <Segmented<KeyboardSize> label={t("ui.keyboard_size")} value={prefs.keyboardSize} onChange={(keyboardSize) => setPrefs({ keyboardSize: keyboardSize as 49 | 61 | 88 })} options={SELECTABLE_SIZES.map((s) => ({ value: s, label: KEYBOARD_PRESETS[s].label }))} />
          </Field>
          <Switch checked={prefs.showBlackKeyLabels} onChange={(showBlackKeyLabels) => setPrefs({ showBlackKeyLabels })} label={t("ui.label_black_keys")} />
          <Switch checked={prefs.leftHanded} onChange={(leftHanded) => setPrefs({ leftHanded })} label={t("ui.left_handed_guitar_view")} description={t("ui.mirrors_the_fretboard_so_the_nut_is_on_the_right")} />
          <Slider label={t("ui.frets_shown")} min={12} max={24} value={prefs.fretCount} onChange={(fretCount) => setPrefs({ fretCount })} />
          <Slider label={t("ui.tuning_reference_a4")} min={430} max={450} value={prefs.a4} onChange={(a4) => setPrefs({ a4 })} format={(v) => `${v} Hz`} />
          <Slider label={t("ui.volume")} min={0} max={1} step={0.05} value={prefs.volume} onChange={(volume) => setPrefs({ volume })} format={(v) => `${Math.round(v * 100)}%`} />
        </Section>

        <PianoSoundSetting />
        <ReminderSetting />

        <Section id="goals" icon={<Target className="h-5 w-5" />} title={t("settings.goals")}>
          <Slider label={t("ui.daily_practice")} min={5} max={60} step={5} value={goals.data.dailyMinutes} onChange={(dailyMinutes) => saveGoals({ dailyMinutes })} format={(v) => t("common.min", { n: v })} />
          <Slider label={t("ui.practice_days_per_week")} min={1} max={7} value={goals.data.weeklyPracticeDays} onChange={(weeklyPracticeDays) => saveGoals({ weeklyPracticeDays })} />
          <Slider label={t("ui.chord_change_drills_per_week")} min={0} max={20} value={goals.data.weeklyChordDrills} onChange={(weeklyChordDrills) => saveGoals({ weeklyChordDrills })} />
          <p className="text-xs text-muted">{t("ui.for_beginners_10_30_minutes_a_day_is_plenty_sess")}</p>
        </Section>

        <Section icon={<HardDrive className="h-5 w-5" />} title={t("settings.data")} description={t("profile.description")}>
          <p className="text-sm text-muted">
            {t("ui.storage_in_use")} <strong className="text-text">{env.storage === "indexedDB" ? "this browser (IndexedDB)" : env.storage === "localStorage" ? "this browser (localStorage)" : env.storage === "memory" ? "temporary memory only — storage is blocked" : env.storage}</strong>{t("ui.clearing_your_browser_data_erases_it_so_download")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={doExport}><Download className="h-4 w-4" /> {t("ui.download_backup")}</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> {t("ui.import_backup")}</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
          {pending && (
            <Callout tone="info" title={t("ui.review_import_before_applying")}>
              <p>{t("ui.import_plan", { added: pending.plan.added, identical: pending.plan.identical, conflicts: pending.plan.conflicts.length })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={async () => { await applyImport(pending.bundle, "keep-local"); setPending(null); toast.success(t("ui.imported_new_records_kept_this_device_s_versions")); }}>{t("ui.import_keep_this_device_on_conflicts")}</Button>
                {pending.plan.conflicts.length > 0 && (
                  <Button size="sm" variant="secondary" onClick={async () => { await applyImport(pending.bundle, "keep-imported"); setPending(null); toast.success(t("ui.imported_backup_versions_replaced_conflicts")); }}>{t("ui.import_prefer_backup_on_conflicts")}</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setPending(null)}>{t("common.cancel")}</Button>
              </div>
            </Callout>
          )}
          <div className="border-t border-border pt-4">
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (!window.confirm(t("ui.erase_all_lesson_progress_practice_history_and_s"))) return;
                await resetAllData();
                toast.success(t("ui.progress_erased"));
              }}
            >
              <Trash2 className="h-4 w-4" /> {t("ui.erase_progress_on_this_device")}
            </Button>
          </div>
        </Section>

        {accountPanel}

        <Section icon={<ShieldCheck className="h-5 w-5" />} title={t("settings.privacy")}>
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex gap-2"><Mic className="mt-0.5 h-4 w-4 shrink-0" />{t("ui.the_microphone_is_used_only_after_you_press_a_li")}</li>
            <li>{t("ui.the_coach_runs_entirely_in_your_browser_your_que")}</li>
            <li>{t(env.mic ? "ui.mic_supported" : "ui.mic_unavailable")}</li>
            <li>{t(env.midi ? "ui.midi_supported" : "ui.midi_unsupported")}</li>
            <li>{t("ui.best_experience_a_recent_chromium_browser_chrome")}</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
