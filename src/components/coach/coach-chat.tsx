"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Send, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, SourceTag, cn } from "@/components/ui";
import { useData } from "@/hooks/use-data";
import { usePrefs } from "@/hooks/use-prefs";
import { coachRepo, exerciseRepo } from "@/lib/storage/repositories";
import { weakSkills } from "@/lib/progress/engine";
import { ruleReply } from "@/lib/coach/rules";
import { MAX_MESSAGE_CHARS, type CoachContext, type LastExercise } from "@/lib/coach/schema";
import type { CoachMessage } from "@/lib/storage/schemas";

const STARTERS = ["What notes are in a G major chord?", "Which chord should I learn first?", "Capo for F Bb C", "My strings are buzzing — why?", "How long should I practise each day?", "How did I do?"];

export function CoachChat({ lastExercise, lessonTitle }: { lastExercise?: LastExercise; lessonTitle?: string }) {
  const [prefs] = usePrefs();
  const { data: history, loading } = useData(() => coachRepo.list(), ["coachHistory"], [] as CoachMessage[]);
  const { data: results } = useData(() => exerciseRepo.list(), ["exerciseResults"], []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [history.length, busy]);

  const send = async (raw: string) => {
    const q = raw.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!q || busy) return;
    setText("");
    setBusy(true);
    const context: CoachContext = {
      instrument: prefs.instrument,
      lessonTitle,
      lastExercise,
      skillsWeak: weakSkills(results).map((w) => w.skill).slice(0, 5),
      hinglish: prefs.hinglish,
    };
    try {
      await coachRepo.add({ role: "user", content: q });
      // The built-in coach runs entirely in the browser — no API key or network needed.
      const r = ruleReply(q, { ...context, tonicPc: prefs.tonicPc });
      await coachRepo.add({ role: "assistant", content: r.text, source: r.source });
    } catch {
      toast.error("Couldn't save the conversation on this device.");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  return (
    <Card className="flex h-[640px] max-h-[80vh] flex-col">
      <CardHeader
        icon={<Bot className="h-5 w-5" />}
        title="Ask your coach"
        description="Questions about anything you're learning."
        action={
          history.length > 0 && (
            <Button size="icon" variant="ghost" aria-label="Clear chat history" title="Clear chat history" onClick={() => void coachRepo.clear()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )
        }
      />
      <div ref={scroller} className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-5 pb-3" aria-live="polite" data-testid="coach-chat-log">
        {!loading && history.length === 0 && (
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-left text-sm hover:border-accent hover:text-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((m) => (
          <div key={m.id} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
            <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-accent-soft text-accent" : "bg-surface-3 text-text")} aria-hidden>
              {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "bg-accent text-accent-fg" : "bg-surface-2")}>
              <span className="sr-only">{m.role === "user" ? "You said:" : "Coach said:"}</span>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === "assistant" && m.source && (
                <div className="mt-2">
                  <SourceTag source={m.source === "measured" ? "measured" : "rules"} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-3">
        <label htmlFor="coach-input" className="sr-only">
          Message your coach
        </label>
        <input
          id="coach-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_MESSAGE_CHARS}
          placeholder="Ask anything, e.g. “notes in A minor”"
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim() || busy}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
