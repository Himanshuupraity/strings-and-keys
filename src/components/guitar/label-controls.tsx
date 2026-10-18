"use client";
import { useT } from "@/lib/i18n";

import { usePrefs } from "@/hooks/use-prefs";
import { Segmented, Select } from "@/components/ui";
import { pcDualName } from "@/lib/music/notes";
import type { LabelMode } from "@/lib/music/sargam";

/** Western / Sargam / Both switch plus the movable-Sa selector, saved in preferences. */
export function LabelControls({ compact = false }: { compact?: boolean }) {
  const tr = useT();
  const [prefs, setPrefs] = usePrefs();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented<LabelMode>
        label={tr("ui.note_labels")}
        size="sm"
        value={prefs.labelMode}
        onChange={(labelMode) => setPrefs({ labelMode })}
        options={[
          { value: "western", label: tr("ui.western") },
          { value: "sargam", label: tr("ui.sargam") },
          { value: "both", label: tr("ui.both") },
        ]}
      />
      {prefs.labelMode !== "western" && (
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted">{compact ? "Sa" : tr("ui.sa_tonic")}</span>
          <Select aria-label={tr("ui.sa_tonic_note")} className="h-8 py-0" value={prefs.tonicPc} onChange={(e) => setPrefs({ tonicPc: Number(e.target.value) })}>
            {Array.from({ length: 12 }, (_, pc) => (
              <option key={pc} value={pc}>
                {pcDualName(pc)}
              </option>
            ))}
          </Select>
        </label>
      )}
    </div>
  );
}
