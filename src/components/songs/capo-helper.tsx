"use client";
import { useT } from "@/lib/i18n";

import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { bestCapoArrangement, capoArrangements } from "@/lib/music/transpose";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { Badge, Callout } from "@/components/ui";

/**
 * Inline capo suggestion using the same transposition utilities as the Guitar Lab simulator.
 * The arrangement keeps the SOUNDING chords identical to the song; only the shapes change.
 */
export function CapoHelper({ chords, songKey, preferCapo }: { chords: string[]; songKey: string; preferCapo?: number }) {
  const tl = useT();
  const unique = Array.from(new Set(chords));
  if (!unique.length) return null;
  const keyArg = songKey.endsWith("m") ? undefined : songKey;
  // Prefer the capo most chord sources use (so it matches lessons and videos), if it really works.
  const preferred = preferCapo ? capoArrangements(unique, keyArg).find((a) => a.capo === preferCapo && a.verified) : undefined;
  const best = preferred ?? bestCapoArrangement(unique, keyArg);
  const href = `/guitar-lab?tab=capo&prog=${encodeURIComponent(unique.join(","))}&key=${encodeURIComponent(songKey)}`;
  return (
    <div className="space-y-3">
      {best.capo === 0 ? (
        <Callout tone="success" title={tl("ui.no_capo_needed")}>{tl("ui.these_chords_are_already_the_easiest_shapes_for")}</Callout>
      ) : (
        <>
          <p className="text-sm">
            {tl("ui.put_a_capo_on")} <strong>{tl("ui.capo_fret_play_shapes", { n: best.capo })}</strong> {tl("ui.capo_play_shapes_tail")}{" "}
            <strong>{songKey}</strong>.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 pr-3 font-medium">{tl("ui.sounding_chord")}</th>
                  {best.sounding.map((c) => (
                    <td key={c} className="px-2 py-1 font-semibold text-text">{c}</td>
                  ))}
                </tr>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 pr-3 font-medium">{tl("ui.shape_you_play")}</th>
                  {best.shapes.map((c, i) => (
                    <td key={i} className="px-2 py-1 font-semibold text-accent">{c}</td>
                  ))}
                </tr>
              </thead>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            {best.shapeDetails.map((d, i) => (
              <ChordDiagram key={i} shape={d} title={best.shapes[i]} subtitle={`sounds ${best.sounding[i]}`} capo={best.capo} size="sm" />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {best.verified && <Badge tone="success">{tl("ui.verified_capo_eq")}</Badge>}
            {best.requiresBarre && <Badge tone="warn">{tl("ui.needs_a_barre_chord")}</Badge>}
            {best.notes.map((n) => (
              <Badge key={n}>{n}</Badge>
            ))}
          </div>
        </>
      )}
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {tl("ui.a_capo_raises_every_string_by_one_semitone_per_f")}
      </p>
      <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
        {tl("ui.open_in_the_capo_simulator")} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
