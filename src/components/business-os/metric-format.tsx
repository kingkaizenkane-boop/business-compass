import type { MetricTrend } from "@/lib/metrics-types";

export function formatMetricValue(value: number | null | undefined, unit: string | null) {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatSignedPercent(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function trendTone(trend: MetricTrend) {
  switch (trend) {
    case "improving":
      return "border-positive/40 text-positive";
    case "target_achieved":
      return "border-positive/40 text-positive";
    case "declining":
    case "target_missed":
      return "border-destructive/40 text-destructive";
    case "stable":
      return "border-signal/40 text-signal";
    default:
      return "border-border text-muted-foreground";
  }
}
