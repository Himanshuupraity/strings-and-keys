"use client";

import { useEffect, useRef, useState } from "react";
import { Delete, Lock } from "lucide-react";
import { Button, cn } from "@/components/ui";

/**
 * 4-digit PIN entry with big touch keys (phones) that also accepts typing (hidden numeric input,
 * so mobile keyboards show digits). `mode="set"` asks twice to confirm.
 */
export function PinPad({
  title,
  subtitle,
  mode = "enter",
  onSubmit,
  onCancel,
  cancelLabel = "Cancel",
  busy = false,
}: {
  title: string;
  subtitle?: string;
  mode?: "enter" | "set";
  /** Return an error message to show (and clear the dots), or nothing on success. */
  onSubmit: (pin: string) => Promise<string | void> | string | void;
  onCancel?: () => void;
  cancelLabel?: string;
  busy?: boolean;
}) {
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  const submit = async (value: string) => {
    if (mode === "set" && first === null) {
      setFirst(value);
      setPin("");
      setError(null);
      return;
    }
    if (mode === "set" && first !== value) {
      setFirst(null);
      setPin("");
      setError("The PINs didn't match. Try again.");
      return;
    }
    setWorking(true);
    try {
      const err = await onSubmit(value);
      if (err) {
        setError(err);
        setPin("");
        if (mode === "set") setFirst(null);
      }
    } finally {
      setWorking(false);
    }
  };

  const type = (d: string) => {
    if (working || busy) return;
    setError(null);
    setPin((p) => {
      const next = (p + d).slice(0, 4);
      if (next.length === 4) void submit(next);
      return next;
    });
  };
  const back = () => setPin((p) => p.slice(0, -1));

  const heading = mode === "set" ? (first === null ? title : "Enter it again to confirm") : title;

  return (
    <div className="space-y-4" data-testid="pin-pad">
      <div className="text-center">
        <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Lock className="h-5 w-5" aria-hidden />
        </span>
        <p className="font-semibold">{heading}</p>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>

      {/* Typing support (desktop keyboards, mobile numeric keyboards, password managers). */}
      <input
        ref={input}
        aria-label={heading}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={4}
        value={pin}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
          setError(null);
          setPin(digits);
          if (digits.length === 4) void submit(digits);
        }}
        onKeyDown={(e) => e.key === "Escape" && onCancel?.()}
        className="sr-only"
        data-testid="pin-input"
      />

      <div className="flex justify-center gap-4" aria-hidden onClick={() => input.current?.focus()}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-4 w-4 rounded-full border-2 transition-colors", i < pin.length ? "border-accent bg-accent" : "border-border-strong")} />
        ))}
      </div>

      <p className={cn("min-h-5 text-center text-sm", error ? "text-danger" : "text-transparent")} role="alert" data-testid="pin-error">
        {error ?? "·"}
      </p>

      <div className="mx-auto grid max-w-[16rem] grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => type(d)} disabled={working || busy} className="h-14 rounded-2xl bg-surface-2 text-xl font-semibold transition-colors hover:bg-surface-3 active:bg-accent-soft disabled:opacity-50" aria-label={`Digit ${d}`}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => type("0")} disabled={working || busy} className="h-14 rounded-2xl bg-surface-2 text-xl font-semibold transition-colors hover:bg-surface-3 active:bg-accent-soft disabled:opacity-50" aria-label="Digit 0">
          0
        </button>
        <button type="button" onClick={back} disabled={working || busy || !pin} className="flex h-14 items-center justify-center rounded-2xl text-muted hover:bg-surface-2 disabled:opacity-30" aria-label="Delete last digit">
          <Delete className="h-5 w-5" />
        </button>
      </div>

      {onCancel && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
