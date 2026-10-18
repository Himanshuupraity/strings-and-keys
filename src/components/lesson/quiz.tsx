"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import type { Lesson } from "@/content/types";
import { Button, Callout, ProgressBar, cn } from "@/components/ui";
import { PlayExample } from "./play-example";
import { VisualRenderer } from "./visual";
import type { Inst } from "./utils";

/** One question at a time with immediate feedback and explanations. */
export function LessonQuiz({ lesson, instrument, best, onFinish, onActivity }: { lesson: Lesson; instrument: Inst; best: number | null; onFinish: (score: number, total: number, wrongIds: string[]) => void; onActivity?: () => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const total = lesson.quiz.length;
  const q = lesson.quiz[i];

  const restart = () => {
    setI(0);
    setPicked(null);
    setWrong([]);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    const frac = score / total;
    const passed = frac >= lesson.passScore;
    return (
      <div className="space-y-4" data-testid="quiz-result">
        <Callout tone={passed ? "success" : "warn"} title={passed ? `Quiz passed: ${score}/${total}` : `${score}/${total} — you need ${Math.ceil(lesson.passScore * total)} to pass`} icon={passed ? <CheckCircle2 className="h-5 w-5 text-success" /> : <RotateCcw className="h-5 w-5 text-warn" />}>
          {passed ? "Great work. Your best score is saved." : "Review the explanations and try again — retries are unlimited and your best score counts."}
        </Callout>
        {wrong.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Worth reviewing:</p>
            {lesson.quiz
              .filter((qq) => wrong.includes(qq.id))
              .map((qq) => (
                <div key={qq.id} className="rounded-xl border border-border bg-surface-2 p-3 text-sm">
                  <p className="font-medium">{qq.question}</p>
                  <p className="mt-1 text-muted">
                    Answer: <strong className="text-text">{qq.options[qq.answer]}</strong> — {qq.explanation}
                  </p>
                </div>
              ))}
          </div>
        )}
        <Button variant="secondary" onClick={restart}>
          <RotateCcw className="h-4 w-4" /> Retake quiz
        </Button>
      </div>
    );
  }

  const answer = (k: number) => {
    if (picked !== null) return;
    onActivity?.();
    setPicked(k);
    if (k === q.answer) setScore((s) => s + 1);
    else setWrong((w) => [...w, q.id]);
  };

  const next = () => {
    if (i === total - 1) {
      setFinished(true);
      onFinish(score, total, wrong);
      return;
    }
    setI(i + 1);
    setPicked(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Question {i + 1} of {total}
        </span>
        {best !== null && <span>Best so far: {Math.round(best * 100)}%</span>}
      </div>
      <ProgressBar value={i / total} label="Quiz progress" />
      <h3 className="text-lg font-semibold">{q.question}</h3>
      {q.visual && <VisualRenderer visual={q.visual} />}
      {q.audio && <PlayExample audio={q.audio} instrument={instrument} />}
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Answers">
        {q.options.map((o, k) => {
          const isAns = k === q.answer;
          return (
            <button
              key={k}
              type="button"
              onClick={() => answer(k)}
              disabled={picked !== null}
              data-testid={`quiz-option-${k}`}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-xl border px-4 py-2 text-left text-sm font-medium transition-colors",
                picked === null ? "border-border bg-surface hover:border-accent hover:bg-accent-soft" : isAns ? "border-success bg-success-soft text-success" : picked === k ? "border-danger bg-danger-soft text-danger" : "border-border opacity-60",
              )}
            >
              {picked !== null && isAns && <CheckCircle2 className="h-4 w-4 shrink-0" />}
              {picked === k && !isAns && <XCircle className="h-4 w-4 shrink-0" />}
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div aria-live="polite" className="space-y-3">
          <p className={cn("text-sm", picked === q.answer ? "text-success" : "text-danger")}>
            <strong>{picked === q.answer ? "Correct." : "Not quite."}</strong> <span className="text-muted">{q.explanation}</span>
          </p>
          <Button onClick={next} data-testid="quiz-next">
            {i === total - 1 ? "See result" : "Next question"}
          </Button>
        </div>
      )}
    </div>
  );
}
