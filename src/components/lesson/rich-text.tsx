"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui";

export type Glossary = { term: string; meaning: string }[];

/** A term that opens a small definition popover. */
export function GlossaryTerm({ term, meaning, children }: { term: string; meaning: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="font-semibold text-text underline decoration-accent decoration-dotted decoration-2 underline-offset-4 hover:text-accent"
      >
        {children}
      </button>
      {open && (
        <span id={id} role="tooltip" className="absolute left-0 top-full z-30 mt-1 block w-64 rounded-xl border border-border bg-surface p-3 text-left text-sm font-normal text-muted shadow-card">
          <span className="mb-1 block font-semibold text-text">{term}</span>
          {meaning}
        </span>
      )}
    </span>
  );
}

function findTerm(text: string, glossary: Glossary) {
  const t = text.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  return glossary.find((g) => {
    const gt = g.term.toLowerCase();
    const head = gt.split(/[ (/]/)[0];
    return t === gt.replace(/[^a-z0-9 ]/g, "") || t === head || t === head + "s" || gt.startsWith(t + " ");
  });
}

/** Inline formatting: **bold** (glossary-aware), *italic*, [links](/path). */
function inline(text: string, glossary: Glossary): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      const inner = tok.slice(2, -2);
      const g = findTerm(inner, glossary);
      out.push(g ? <GlossaryTerm key={k++} term={g.term} meaning={g.meaning}>{inner}</GlossaryTerm> : <strong key={k++} className="font-semibold text-text">{inner}</strong>);
    } else if (tok.startsWith("[")) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      out.push(
        <Link key={k++} href={mm[2]} className="font-medium text-accent underline underline-offset-2">
          {mm[1]}
        </Link>,
      );
    } else out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Tiny markdown-ish renderer for lesson bodies: paragraphs, "- " bullets, "1. " lists. */
export function RichText({ text, glossary = [], className }: { text: string; glossary?: Glossary; className?: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className={cn("space-y-3 leading-relaxed text-muted", className)}>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const bullets = lines.every((l) => /^- /.test(l) || /^\d+\. /.test(l));
        if (bullets) {
          const ordered = /^\d+\. /.test(lines[0]);
          const List = ordered ? "ol" : "ul";
          return (
            <List key={i} className={cn("space-y-1.5 pl-5", ordered ? "list-decimal" : "list-disc marker:text-accent")}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^(- |\d+\. )/, ""), glossary)}</li>
              ))}
            </List>
          );
        }
        // Mixed: leading paragraph lines then bullets.
        const firstBullet = lines.findIndex((l) => /^(- |\d+\. )/.test(l));
        if (firstBullet > 0) {
          return (
            <Fragment key={i}>
              <p>{inline(lines.slice(0, firstBullet).join(" "), glossary)}</p>
              <ul className="list-disc space-y-1.5 pl-5 marker:text-accent">
                {lines.slice(firstBullet).map((l, j) => (
                  <li key={j}>{inline(l.replace(/^(- |\d+\. )/, ""), glossary)}</li>
                ))}
              </ul>
            </Fragment>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {inline(b, glossary)}
          </p>
        );
      })}
    </div>
  );
}
