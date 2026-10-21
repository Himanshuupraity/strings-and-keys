"use client";
import { useT } from "@/lib/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";

/**
 * Arrow buttons and a draggable bar for a horizontally scrolling instrument. On a phone, swiping
 * across keys or frets plays notes instead of scrolling (and the native scrollbar is hidden), so
 * this is how you reach the rest of the instrument. Renders nothing when everything fits.
 */
export function ScrollControls({ target, step }: { target: RefObject<HTMLElement | null>; step?: number }) {
  const tr = useT();
  const [view, setView] = useState({ overflow: false, start: 0, size: 1 });

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const update = () => {
      const sw = el.scrollWidth;
      setView({ overflow: sw > el.clientWidth + 1, start: el.scrollLeft / sw, size: el.clientWidth / sw });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [target]);

  if (!view.overflow) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = target.current;
    el?.scrollBy({ left: dir * (step ?? el.clientWidth * 0.6), behavior: "smooth" });
  };
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = target.current;
    if (!el || (e.type === "pointermove" && !e.currentTarget.hasPointerCapture(e.pointerId))) return;
    if (e.type === "pointerdown") e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    // Centre the visible window on the finger.
    el.scrollTo({ left: ((e.clientX - r.left) / r.width) * el.scrollWidth - el.clientWidth / 2 });
  };
  const arrow = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-muted hover:text-text disabled:opacity-40";

  return (
    <div className="mt-2 flex items-center gap-2">
      <button type="button" onClick={() => scrollBy(-1)} disabled={view.start <= 0.001} aria-label={tr("ui.scroll_left")} className={arrow}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div
        aria-hidden
        title={tr("ui.drag_to_scroll")}
        className="relative h-8 flex-1 cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={drag}
        onPointerMove={drag}
      >
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-2" />
        <div className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-accent/70" style={{ left: `${view.start * 100}%`, width: `${view.size * 100}%` }} />
      </div>
      <button type="button" onClick={() => scrollBy(1)} disabled={view.start + view.size >= 0.999} aria-label={tr("ui.scroll_right")} className={arrow}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
