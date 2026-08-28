/**
 * Client-safe metric types. Shared by the server engine and the UI so no route
 * has to import from a `.server` module.
 */
import type { Database } from "@/integrations/supabase/types";

export type MetricDirection = Database["public"]["Enums"]["metric_direction"];
export type MetricFrequency = Database["public"]["Enums"]["metric_frequency"];
export type MetricSource = Database["public"]["Enums"]["metric_source"];

export type MetricTrend =
  | "improving"
  | "declining"
  | "stable"
  | "target_achieved"
  | "target_missed"
  | "insufficient_data";

export type MetricConfidence = "high" | "medium" | "low" | "unknown";

export type MetricObservation = {
  id: string;
  value: number | null;
  recordedAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  source: string | null;
  notes: string | null;
};

export type MetricLinks = {
  goal: { id: string; name: string } | null;
  diagnosisItem: { id: string; title: string } | null;
  task: { id: string; title: string; status: string } | null;
  process: { id: string; name: string; status: string } | null;
};

export type MetricAlert = {
  metricId: string;
  metricName: string;
  kind: "declining" | "target_at_risk" | "target_achieved" | "unexpected_change" | "stale";
  message: string;
  severity: "info" | "warning" | "critical";
};

export type MetricView = {
  id: string;
  name: string;
  metricKey: string;
  category: string | null;
  unit: string | null;
  description: string | null;
  rationale: string | null;
  source: MetricSource;
  direction: MetricDirection;
  frequency: MetricFrequency;
  active: boolean;
  baselineValue: number | null;
  baselineAt: string | null;
  targetValue: number | null;
  currentValue: number | null;
  currentRecordedAt: string | null;
  previousValue: number | null;
  observationCount: number;
  changeFromBaseline: number | null;
  changeFromBaselinePercent: number | null;
  changeFromPrevious: number | null;
  distanceToTarget: number | null;
  targetProgressPercent: number | null;
  trend: MetricTrend;
  trendLabel: string;
  outcomeSummary: string;
  freshnessDays: number | null;
  confidence: MetricConfidence;
  links: MetricLinks;
  hypothesis: string | null;
  intervention: string | null;
};

export type MetricsPayload = {
  metrics: MetricView[];
  alerts: MetricAlert[];
  summary: {
    total: number;
    withBaseline: number;
    improving: number;
    declining: number;
    onTarget: number;
    needsAttention: number;
  };
};
