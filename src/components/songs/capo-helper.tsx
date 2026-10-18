"use client";

import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { bestCapoArrangement } from "@/lib/music/transpose";
import { ChordDiagram } from "@/components/instruments/chord-diagram";
import { Badge, Callout } from "@/components/ui";

/**
 * Inline capo suggestion using the same transposition utilities as the Guitar Lab simulator.
 * The arrangement keeps the SOUNDING chords identical to the song; only the shapes change.
 */
export function CapoHelper({ chords, songKey }: { chords: string[]; songKey: string }) {
  const unique = Array.from(new Set(chords));
  if (!unique.length) return null;
  const best = bestCapoArrangement(unique, songKey.endsWith("m") ? undefined : songKey);
  const href = `/guitar-lab?tab=capo&prog=${encodeURIComponent(unique.join(","))}&key=${encodeURIComponent(songKey)}`;
  return (
    <div className="space-y-3">
      {best.capo === 0 ? (
        <Callout tone="success" title="No capo needed">These chords are already the easiest shapes for this key.</Callout>
      ) : (
        <>
          <p className="text-sm">
            Put a capo on <strong>fret {best.capo}</strong> and play these shapes — the song still sounds in{" "}
            <strong>{songKey}</strong>.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 pr-3 font-medium">Sounding chord</th>
                  {best.sounding.map((c) => (
                    <td key={c} className="px-2 py-1 font-semibold text-text">{c}</td>
                  ))}
                </tr>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 pr-3 font-medium">Shape you play</th>
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
            {best.verified && <Badge tone="success">Verified: shapes + capo = original chords</Badge>}
            {best.requiresBarre && <Badge tone="warn">Needs a barre chord</Badge>}
            {best.notes.map((n) => (
              <Badge key={n}>{n}</Badge>
            ))}
          </div>
        </>
      )}
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> A capo raises every string by one semitone per fret, so a G shape at capo 2 sounds as A.
      </p>
      <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
        Open in the capo simulator <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
