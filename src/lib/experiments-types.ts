/**
 * Client-safe experiment vocabulary. Shared by the server engine and the UI so
 * no route ever imports from a `.server` module.
 *
 * Experiments are the deliberate learning layer of Business OS:
 * Diagnosis → Hypothesis → Intervention → Measurement → Result → Learning → Brain.
 */
import type { Database } from "@/integrations/supabase/types";
import type { MetricDirection, MetricTrend } from "./metrics-types";

export type ExperimentStatus = Database["public"]["Enums"]["experiment_status"];
export type ExperimentType = Database["public"]["Enums"]["experiment_type"];
export type ExperimentLearningStatus = Database["public"]["Enums"]["experiment_learning_status"];
export type ExperimentConfidenceLevel = Database["public"]["Enums"]["confidence_level"];

export const EXPERIMENT_STATUS_LABEL: Record<ExperimentStatus, string> = {
  draft: "Draft",
  planned: "Planned",
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const EXPERIMENT_TYPE_LABEL: Record<ExperimentType, string> = {
  before_after: "Before / after",
  controlled: "Controlled comparison",
  observational: "Observational",
};

export const EXPERIMENT_TYPE_CAVEAT: Record<ExperimentType, string> = {
  before_after:
    "Compares the metric before and after the intervention. Movement is an observed change over the same period, not proven causation.",
  controlled:
    "Compares against a defined comparison group or period, which makes the inference stronger — but still not a laboratory result.",
  observational:
    "Records what changed alongside the intervention. No causal claim can be made from this design.",
};

export const LEARNING_STATUS_LABEL: Record<ExperimentLearningStatus, string> = {
  pending: "Awaiting result",
  positive: "Positive",
  negative: "Negative",
  inconclusive: "Inconclusive",
};

/** The only legal lifecycle moves. Anything else is rejected server-side. */
export const EXPERIMENT_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  draft: ["planned", "cancelled"],
  planned: ["running", "draft", "cancelled"],
  running: ["paused", "completed", "cancelled"],
  paused: ["running", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export type ExperimentAction = "plan" | "unplan" | "start" | "pause" | "resume" | "complete" | "cancel";

export const ACTION_TARGET: Record<ExperimentAction, ExperimentStatus> = {
  plan: "planned",
  unplan: "draft",
  start: "running",
  pause: "paused",
  resume: "running",
  complete: "completed",
  cancel: "cancelled",
};

export function canTransition(from: ExperimentStatus, action: ExperimentAction) {
  return EXPERIMENT_TRANSITIONS[from].includes(ACTION_TARGET[action]);
}

/** True once the definition is frozen — hypothesis, baseline, metric, type. */
export function isDefinitionLocked(status: ExperimentStatus) {
  return status === "running" || status === "paused" || status === "completed" || status === "cancelled";
}

export type ExperimentMetricRole = "primary" | "secondary" | "guardrail";

export type ExperimentMetricView = {
  id: string;
  name: string;
  unit: string | null;
  direction: MetricDirection;
  role: ExperimentMetricRole;
  baselineValue: number | null;
  currentValue: number | null;
  targetValue: number | null;
  trend: MetricTrend;
  trendLabel: string;
  observationCount: number;
};

export type ExperimentLinks = {
  diagnosisItem: { id: string; title: string } | null;
  diagnosisRunId: string | null;
  blueprint: { id: string; version: number } | null;
  task: { id: string; title: string; status: string } | null;
  process: { id: string; name: string; status: string; version: number | null } | null;
  processExecutionId: string | null;
};

export type ExperimentEvidence = {
  factId: string | null;
  factKey: string;
  value: string;
  quality: string;
};

export type ExperimentResult = {
  baselineValue: number | null;
  finalValue: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
  targetValue: number | null;
  targetAchieved: boolean | null;
  observationsInPeriod: number;
  dataCompleteness: number;
  trend: MetricTrend;
  learningStatus: ExperimentLearningStatus;
  confidence: number | null;
  confidenceLevel: ExperimentConfidenceLevel | null;
  /** Deterministic, non-causal sentence. Never AI-written. */
  statement: string;
};

export type ExperimentReadiness = {
  ready: boolean;
  blockers: string[];
};

export type ExperimentView = {
  id: string;
  name: string;
  description: string | null;
  status: ExperimentStatus;
  statusLabel: string;
  experimentType: ExperimentType;
  experimentTypeLabel: string;
  typeCaveat: string;
  hypothesis: string | null;
  hypothesisIntervention: string | null;
  hypothesisExpectedChange: string | null;
  hypothesisRationale: string | null;
  rationale: string | null;
  interventionSummary: string | null;
  comparisonDefinition: string | null;
  startDate: string | null;
  endDate: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  baselineValue: number | null;
  baselinePeriodStart: string | null;
  baselinePeriodEnd: string | null;
  baselineSource: string | null;
  targetValue: number | null;
  expectedChangePercent: number | null;
  primaryMetric: ExperimentMetricView | null;
  secondaryMetrics: ExperimentMetricView[];
  links: ExperimentLinks;
  evidence: ExperimentEvidence[];
  result: ExperimentResult;
  conclusion: string | null;
  learning: string | null;
  limitation: string | null;
  recommendation: string | null;
  learningStatus: ExperimentLearningStatus;
  learningStatusLabel: string;
  learningGeneratedAt: string | null;
  confidence: number | null;
  confidenceLevel: ExperimentConfidenceLevel | null;
  elapsedDays: number | null;
  remainingDays: number | null;
  timeProgressPercent: number | null;
  targetProgressPercent: number | null;
  definitionLocked: boolean;
  readiness: ExperimentReadiness;
  createdAt: string;
  updatedAt: string;
};

export type ExperimentsSummary = {
  total: number;
  draft: number;
  planned: number;
  running: number;
  paused: number;
  completed: number;
  cancelled: number;
  positive: number;
  negative: number;
  inconclusive: number;
};

export type ExperimentsPayload = {
  experiments: ExperimentView[];
  summary: ExperimentsSummary;
};

export type ExperimentDetail = {
  experiment: ExperimentView;
  /** Primary-metric history, newest first. Owned by the Metrics engine. */
  observations: Array<{
    id: string;
    value: number | null;
    recordedAt: string;
    notes: string | null;
    source: string | null;
    inPeriod: boolean;
  }>;
};

export function formatHypothesis(input: {
  intervention: string | null;
  expectedChange: string | null;
  rationale: string | null;
}) {
  if (!input.intervention && !input.expectedChange) return null;
  return [
    `IF ${input.intervention ?? "…"}`,
    `THEN ${input.expectedChange ?? "…"}`,
    `BECAUSE ${input.rationale ?? "…"}`,
  ].join("\n");
}
