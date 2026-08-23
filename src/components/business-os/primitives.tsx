import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  AUTONOMY_LABEL,
  CONFIDENCE_LABEL,
  VERIFICATION_LABEL,
  type AutonomyLevel,
  type Confidence,
  type VerificationState,
} from "@/lib/business-os";

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const tone =
    confidence === "high"
      ? "border-positive/40 text-positive"
      : confidence === "medium"
        ? "border-signal/40 text-signal"
        : confidence === "low"
          ? "border-caution/50 text-caution-foreground"
          : "border-border text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-full font-medium", tone)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {CONFIDENCE_LABEL[confidence]}
    </Badge>
  );
}

export function VerificationBadge({ state }: { state: VerificationState }) {
  const tone =
    state === "verified"
      ? "border-positive/40 text-positive"
      : state === "conflicted"
        ? "border-destructive/40 text-destructive"
        : state === "obsolete"
          ? "border-border text-muted-foreground line-through"
          : "border-caution/50 text-caution-foreground";

  return (
    <Badge variant="outline" className={cn("rounded-full font-medium", tone)}>
      {VERIFICATION_LABEL[state]}
    </Badge>
  );
}

export function AutonomyBadge({ level }: { level: AutonomyLevel }) {
  return (
    <Badge variant="outline" className="gap-1.5 rounded-full font-medium text-muted-foreground">
      <span className="numeric text-[0.7rem]">L{level}</span>
      {AUTONOMY_LABEL[level]}
    </Badge>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
        <h1 className="display-lg text-foreground">{title}</h1>
        {subtitle ? (
          <p className="mt-3 text-[0.975rem] leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <p className="eyebrow">{children}</p>
      {aside ? <span className="text-xs text-muted-foreground">{aside}</span> : null}
    </div>
  );
}

/**
 * Intelligent empty state. Used wherever real business data does not exist yet —
 * never a blank screen, never fabricated metrics.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  primary,
  secondary,
  note,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  primary?: { label: string; to: string };
  secondary?: { label: string; to: string };
  note?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-border bg-card px-6 py-14 text-center shadow-quiet md:px-16"
    >
      <span className="mx-auto flex size-11 items-center justify-center rounded-full border border-border bg-surface text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="mt-6 text-2xl text-foreground">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {primary || secondary ? (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {primary ? (
            <Button asChild>
              <Link to={primary.to}>{primary.label}</Link>
            </Button>
          ) : null}
          {secondary ? (
            <Button asChild variant="outline">
              <Link to={secondary.to}>{secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      {note ? (
        <p className="mx-auto mt-7 max-w-md border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
          {note}
        </p>
      ) : null}
    </motion.div>
  );
}

/** WHAT / WHY / WHAT NEXT — the product's core explanatory pattern. */
export function InsightTriad({
  what,
  why,
  next,
  action,
}: {
  what: string;
  why: string;
  next: string;
  action?: ReactNode;
}) {
  const rows: Array<[string, string]> = [
    ["What", what],
    ["Why", why],
    ["What next", next],
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-quiet">
      <dl className="space-y-5">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 md:grid-cols-[7.5rem_1fr] md:gap-6">
            <dt className="eyebrow pt-0.5">{label}</dt>
            <dd className="text-sm leading-relaxed text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {action ? <div className="mt-6 border-t border-border pt-5">{action}</div> : null}
    </div>
  );
}

export function MeterRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-foreground">{label}</span>
        <span className="numeric text-sm text-muted-foreground">
          {value === null ? "—" : `${value}%`}
        </span>
      </div>
      <Progress value={value ?? 0} className="mt-2 h-1.5" />
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StatBlock({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-quiet">
      <p className="eyebrow">{label}</p>
      <p className="numeric mt-3 text-3xl text-foreground">{value}</p>
      {caption ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{caption}</p> : null}
    </div>
  );
}
