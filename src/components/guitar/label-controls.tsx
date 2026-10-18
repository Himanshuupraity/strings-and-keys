"use client";

import { usePrefs } from "@/hooks/use-prefs";
import { Segmented, Select } from "@/components/ui";
import { pcDualName } from "@/lib/music/notes";
import type { LabelMode } from "@/lib/music/sargam";

/** Western / Sargam / Both switch plus the movable-Sa selector, saved in preferences. */
export function LabelControls({ compact = false }: { compact?: boolean }) {
  const [prefs, setPrefs] = usePrefs();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented<LabelMode>
        label="Note labels"
        size="sm"
        value={prefs.labelMode}
        onChange={(labelMode) => setPrefs({ labelMode })}
        options={[
          { value: "western", label: "Western" },
          { value: "sargam", label: "Sargam" },
          { value: "both", label: "Both" },
        ]}
      />
      {prefs.labelMode !== "western" && (
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted">{compact ? "Sa" : "Sa (tonic)"}</span>
          <Select aria-label="Sa tonic note" className="h-8 py-0" value={prefs.tonicPc} onChange={(e) => setPrefs({ tonicPc: Number(e.target.value) })}>
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
