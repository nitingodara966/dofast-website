import type { HTMLAttributes } from "react";

/* Card, Badge, StatusIndicator, Alert, Progress — DESIGN_SYSTEM §2.1.
   Server-compatible (no hooks). */

type CardProps = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
};

export function Card({ interactive, className = "", ...rest }: CardProps) {
  return (
    <div
      className={`rounded-card border border-line bg-surface ${
        interactive ? "transition-colors hover:border-line-strong hover:bg-sunken" : ""
      } ${className}`}
      {...rest}
    />
  );
}

export type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-secondary border-line",
  success: "bg-success-subtle text-success border-success/20",
  warning: "bg-warning-subtle text-warning border-warning/20",
  danger: "bg-danger-subtle text-danger border-danger/20",
  accent: "bg-accent-subtle text-accent-strong border-accent-border",
};

/** Badges state verifiable facts only (checklist #11). */
export function Badge({
  tone = "neutral",
  className = "",
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-control border px-2 py-0.5 text-xs uppercase tracking-wide ${badgeTones[tone]} ${className}`}
      {...rest}
    />
  );
}

const dotTones: Record<Tone, string> = {
  neutral: "bg-ink-tertiary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  accent: "bg-accent",
};

/** Status = dot + word; color never carries meaning alone (§1.10). */
export function StatusIndicator({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-secondary">
      <span aria-hidden className={`size-2 rounded-full ${dotTones[tone]}`} />
      {children}
    </span>
  );
}

const alertTones: Record<Exclude<Tone, "accent">, string> = {
  neutral: "border-line bg-sunken text-ink-secondary",
  success: "border-success/25 bg-success-subtle text-success",
  warning: "border-warning/25 bg-warning-subtle text-warning",
  danger: "border-danger/25 bg-danger-subtle text-danger",
};

export function Alert({
  tone = "neutral",
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: Exclude<Tone, "accent"> }) {
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : undefined}
      className={`rounded-card border px-4 py-3 text-sm ${alertTones[tone]} ${className}`}
      {...rest}
    />
  );
}

/** Progress always carries a label (§1.8). */
export function Progress({
  label,
  value,
}: {
  label: string;
  value?: number; // 0..1; omitted = indeterminate
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm text-ink-secondary">{label}</p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value !== undefined ? Math.round(value * 100) : undefined}
        className="h-1 w-full overflow-hidden rounded-full bg-sunken"
      >
        <div
          className={`h-full rounded-full bg-accent ${
            value === undefined ? "w-1/3 animate-pulse" : "transition-[width]"
          }`}
          style={value !== undefined ? { width: `${value * 100}%` } : undefined}
        />
      </div>
    </div>
  );
}
