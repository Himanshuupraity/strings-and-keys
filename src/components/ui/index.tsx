"use client";
import { useT } from "@/lib/i18n";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { forwardRef, useId, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ---------------- Button ---------------- */

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover shadow-sm",
  secondary: "bg-surface-2 text-text hover:bg-surface-3 border border-border",
  outline: "border border-border-strong text-text hover:bg-surface-2",
  ghost: "text-text hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
  success: "bg-success text-white hover:opacity-90 dark:text-black",
};
const SIZES: Record<Size, string> = {
  sm: "h-10 sm:h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 sm:h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
  icon: "h-11 w-11 sm:h-10 sm:w-10 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/* ---------------- Card ---------------- */

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-surface shadow-card", className)} {...rest} />;
}

export function CardHeader({ title, description, icon, action, className }: { title: ReactNode; description?: ReactNode; icon?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 p-5 pb-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{title}</h3>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2", className)} {...rest} />;
}

/* ---------------- Badge ---------------- */

const BADGE: Record<string, string> = {
  neutral: "bg-surface-2 text-muted border-border",
  accent: "bg-accent-soft text-accent border-transparent",
  guitar: "bg-guitar-soft text-guitar border-transparent",
  piano: "bg-piano-soft text-piano border-transparent",
  theory: "bg-theory-soft text-theory border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

export function Badge({ tone = "neutral", className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof BADGE }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", BADGE[tone], className)} {...rest} />;
}

/* ---------------- Segmented control ---------------- */

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode; activeClass?: string; testId?: string }[];
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-xl border border-border bg-surface-2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={o.testId}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all",
              size === "sm" && "h-9 px-2.5 text-xs sm:h-7",
              size === "md" && "h-10 px-3 text-sm sm:h-8",
              size === "lg" && "h-11 px-5 text-base",
              active ? cn("bg-surface text-text shadow-sm", o.activeClass) : "text-muted hover:text-text",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Form controls ---------------- */

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn("h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm placeholder:text-subtle focus:border-accent focus:outline-none", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("h-10 rounded-xl border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none", className)} {...rest}>
      {children}
    </select>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format, className, id }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string; className?: string; id?: string }) {
  const autoId = useId();
  const sid = id ?? autoId;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={sid} className="font-medium">
          {label}
        </label>
        <span className="tabular-nums text-muted">{format ? format(value) : value}</span>
      </div>
      <input id={sid} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
    </div>
  );
}

export function Switch({ checked, onChange, label, description, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; id?: string }) {
  const autoId = useId();
  const sid = id ?? autoId;
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <label htmlFor={sid} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      <button
        id={sid}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-surface-3")}
      >
        <span className={cn("absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

/* ---------------- Feedback ---------------- */

export function ProgressBar({ value, className, tone = "accent", label }: { value: number; className?: string; tone?: "accent" | "guitar" | "piano" | "success" | "theory"; label?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color = { accent: "bg-accent", guitar: "bg-guitar", piano: "bg-piano", success: "bg-success", theory: "bg-theory" }[tone];
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-surface-3", className)} aria-hidden />;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center">
      {icon && <div className="mb-3 text-subtle">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Callout({ tone = "neutral", title, children, icon, className }: { tone?: "neutral" | "warn" | "danger" | "success" | "info"; title?: ReactNode; children?: ReactNode; icon?: ReactNode; className?: string }) {
  const tones = {
    neutral: "border-border bg-surface-2",
    info: "border-transparent bg-piano-soft",
    warn: "border-transparent bg-warn-soft",
    danger: "border-transparent bg-danger-soft",
    success: "border-transparent bg-success-soft",
  };
  return (
    <div className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", tones[tone], className)} role={tone === "danger" ? "alert" : undefined}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn("text-muted", title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, eyebrow, actions }: { title: ReactNode; description?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</div>}
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Small label that tells the student whether a number was measured or self-reported / AI-generated. */
export function SourceTag({ source }: { source: "measured" | "self-reported" | "rules" | "sample" }) {
  const tr = useT();
  const map = {
    measured: { tone: "success", text: tr("ui.measured") },
    "self-reported": { tone: "warn", text: tr("ui.self_reported") },
    rules: { tone: "theory", text: tr("ui.coaching_tip") },
    sample: { tone: "neutral", text: tr("ui.sample_data") },
  } as const;
  const m = map[source];
  return <Badge tone={m.tone}>{m.text}</Badge>;
}
