/**
 * Server-only Experiments & Learning engine.
 *
 * An experiment is a deliberate, measured business change:
 *   Diagnosis → Hypothesis → Intervention → Measurement → Result → Learning → Brain.
 *
 * Hard rules enforced here:
 *  - Every numeric fact (baseline, change, target status, trend, confidence) is
 *    computed deterministically. AI never does arithmetic.
 *  - Measurements are owned by the Metrics engine. Experiments reference metric
 *    definitions and observations; they never store their own numbers as truth.
 *  - Once an experiment starts, hypothesis / baseline / type / primary metric
 *    are frozen so historical definitions stay reproducible.
 *  - Outcome language is non-causal unless a controlled design supports it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { AI_MODELS, resolveOrganizationId } from "./ai-usage.server";
import { chatJsonResult } from "./ai.server";
import { writeAudit } from "./audit.server";
import { assertBusinessAccess } from "./diagnosis.server";
import {
  ACTION_TARGET,
  EXPERIMENT_STATUS_LABEL,
  EXPERIMENT_TYPE_CAVEAT,
  EXPERIMENT_TYPE_LABEL,
  LEARNING_STATUS_LABEL,
  canTransition,
  formatHypothesis,
  isDefinitionLocked,
  type ExperimentAction,
  type ExperimentConfidenceLevel,
  type ExperimentDetail,
  type ExperimentEvidence,
  type ExperimentLearningStatus,
  type ExperimentMetricRole,
  type ExperimentMetricView,
  type ExperimentReadiness,
  type ExperimentResult,
  type ExperimentType,
  type ExperimentView,
  type ExperimentsPayload,
} from "./experiments-types";
import { classifyTrend, loadMetric, loadMetrics, recordObservation } from "./metrics.server";
import type { MetricTrend, MetricView } from "./metrics-types";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["experiments"]["Row"];

export type { ExperimentView, ExperimentsPayload, ExperimentDetail } from "./experiments-types";

/* ------------------------------------------------------------------ math */

const EXPECTED_PER_DAY: Record<string, number> = {
  daily: 1,
  weekly: 1 / 7,
  monthly: 1 / 30,
  quarterly: 1 / 90,
  custom: 1 / 14,
};

function daysBetween(from: string | null, to: string | null) {
  if (!from) return null;
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function levelFor(score: number): ExperimentConfidenceLevel {
  if (score < 25) return "very_low";
  if (score < 45) return "low";
  if (score < 65) return "medium";
  if (score < 82) return "high";
  return "very_high";
}

/**
 * The deterministic heart of the engine. No AI, no rounding tricks, no
 * causal claims. Given numbers in, one classification out.
 */
export function computeOutcome(input: {
  direction: "higher_is_better" | "lower_is_better" | "target_range";
  baseline: number | null;
  final: number | null;
  target: number | null;
  observationsInPeriod: number;
  durationDays: number | null;
  frequency: string;
  experimentType: ExperimentType;
  hasComparison: boolean;
  baselineFromObservation: boolean;
  metricConfidence: "high" | "medium" | "low" | "unknown";
  metricName: string;
  unit: string | null;
}): ExperimentResult {
  const {
    direction,
    baseline,
    final,
    target,
    observationsInPeriod,
    durationDays,
    frequency,
    experimentType,
    hasComparison,
    baselineFromObservation,
    metricConfidence,
  } = input;

  const fmt = (value: number | null) =>
    value == null
      ? "—"
      : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}${
          input.unit ? ` ${input.unit}` : ""
        }`;

  const absoluteChange = baseline != null && final != null ? round(final - baseline, 4) : null;
  const percentChange =
    absoluteChange != null && baseline != null && baseline !== 0
      ? round((absoluteChange / Math.abs(baseline)) * 100, 1)
      : null;

  const targetAchieved =
    target == null || final == null
      ? null
      : direction === "lower_is_better"
        ? final <= target
        : final >= target;

  const expected = Math.max(
    1,
    Math.round((durationDays ?? 0) * (EXPECTED_PER_DAY[frequency] ?? EXPECTED_PER_DAY["custom"]!)),
  );
  const dataCompleteness = Math.min(100, Math.round((observationsInPeriod / expected) * 100));

  const { trend } = classifyTrend({
    direction,
    baseline,
    previous: null,
    current: final,
    target,
    observationCount: observationsInPeriod,
  });

  // Signed gain expressed in the metric's intended direction.
  const signedGain =
    baseline != null && final != null && baseline !== 0
      ? (direction === "lower_is_better" ? baseline - final : final - baseline) / Math.abs(baseline)
      : null;

  let learningStatus: ExperimentLearningStatus = "inconclusive";
  if (baseline == null || final == null || observationsInPeriod < 1 || signedGain == null) {
    learningStatus = "inconclusive";
  } else if (observationsInPeriod >= 2 && (targetAchieved === true || signedGain >= 0.1)) {
    learningStatus = "positive";
  } else if (observationsInPeriod >= 2 && signedGain <= -0.05) {
    learningStatus = "negative";
  }

  /* Confidence is earned, never asserted. */
  let confidence: number | null = null;
  if (baseline != null && final != null && observationsInPeriod >= 1) {
    let score = 30;
    if (observationsInPeriod >= 3) score += 12;
    if (observationsInPeriod >= 6) score += 10;
    if (baselineFromObservation) score += 10;
    if (dataCompleteness >= 70) score += 8;
    if (metricConfidence === "high") score += 8;
    else if (metricConfidence === "medium") score += 4;
    else if (metricConfidence === "unknown") score -= 8;
    if (Math.abs(signedGain ?? 0) >= 0.2) score += 6;
    if (experimentType === "controlled" && hasComparison) score += 12;
    if (experimentType === "observational") score -= 12;
    if (learningStatus === "inconclusive") score -= 10;
    // No control means no strong claim, ever.
    const ceiling = experimentType === "controlled" && hasComparison ? 88 : 70;
    confidence = Math.max(5, Math.min(ceiling, Math.round(score)));
  }

  const changeText =
    percentChange == null
      ? absoluteChange == null
        ? "No measured change is available yet."
        : `${input.metricName} moved by ${fmt(absoluteChange)} from ${fmt(baseline)} to ${fmt(final)}.`
      : `${input.metricName} moved from ${fmt(baseline)} to ${fmt(final)} (${percentChange > 0 ? "+" : ""}${percentChange}%) during the measurement period.`;

  const targetText =
    target == null
      ? ""
      : targetAchieved
        ? ` The ${fmt(target)} target was reached.`
        : ` The ${fmt(target)} target was not reached.`;

  const caveat =
    experimentType === "controlled" && hasComparison
      ? " A comparison group or period was defined, which strengthens the inference."
      : " No controlled comparison was available, so this is an observed change over the period, not proven causation.";

  return {
    baselineValue: baseline,
    finalValue: final,
    absoluteChange,
    percentChange,
    targetValue: target,
    targetAchieved,
    observationsInPeriod,
    dataCompleteness,
    trend: trend as MetricTrend,
    learningStatus,
    confidence,
    confidenceLevel: confidence == null ? null : levelFor(confidence),
    statement: `${changeText}${targetText}${caveat}`,
  };
}

/* ------------------------------------------------------------------ views */

function toMetricView(metric: MetricView, role: ExperimentMetricRole): ExperimentMetricView {
  return {
    id: metric.id,
    name: metric.name,
    unit: metric.unit,
    direction: metric.direction,
    role,
    baselineValue: metric.baselineValue,
    currentValue: metric.currentValue,
    targetValue: metric.targetValue,
    trend: metric.trend,
    trendLabel: metric.trendLabel,
    observationCount: metric.observationCount,
  };
}

function evaluateReadiness(row: Row, primary: MetricView | null): ExperimentReadiness {
  const blockers: string[] = [];
  if (!row.hypothesis_intervention || !row.hypothesis_expected_change) {
    blockers.push("A hypothesis is required: what will change, and what you expect to happen.");
  }
  if (!row.intervention_summary) {
    blockers.push("An intervention is required — describe exactly what is changing.");
  }
  if (!row.primary_metric_id || !primary) {
    blockers.push("A primary metric is required so the result can be measured.");
  }
  if (row.baseline_value == null) {
    blockers.push("A baseline is required before this experiment can begin.");
  }
  if (row.target_value == null) {
    blockers.push("A target is required so success can be judged against something stated up front.");
  }
  if (!row.start_date || !row.end_date) {
    blockers.push("A start date and an end date are required.");
  } else if (new Date(row.end_date).getTime() <= new Date(row.start_date).getTime()) {
    blockers.push("The end date must fall after the start date.");
  }
  if (row.experiment_type === "controlled" && !row.comparison_definition) {
    blockers.push("A controlled experiment needs its comparison group or period defined.");
  }
  return { ready: blockers.length === 0, blockers };
}

function periodBounds(row: Row) {
  const from = row.started_at ?? (row.start_date ? `${row.start_date}T00:00:00.000Z` : null);
  const to = row.completed_at ?? row.cancelled_at ?? null;
  return { from, to };
}

function buildView(
  row: Row,
  metrics: Map<string, MetricView>,
  attachments: Array<{ metric_id: string; role: string }>,
  links: ExperimentView["links"],
  observationsInPeriod: number,
  finalValue: number | null,
): ExperimentView {
  const primaryMetric = row.primary_metric_id ? (metrics.get(row.primary_metric_id) ?? null) : null;
  const secondary = attachments
    .filter((a) => a.role !== "primary" && a.metric_id !== row.primary_metric_id)
    .map((a) => {
      const view = metrics.get(a.metric_id);
      return view ? toMetricView(view, a.role as ExperimentMetricRole) : null;
    })
    .filter((v): v is ExperimentMetricView => v !== null);

  const { to } = periodBounds(row);
  const durationDays =
    row.start_date && row.end_date ? daysBetween(`${row.start_date}T00:00:00.000Z`, `${row.end_date}T00:00:00.000Z`) : null;
  const elapsedDays = row.started_at ? daysBetween(row.started_at, to) : null;
  const remainingDays =
    row.end_date && row.status === "running"
      ? Math.max(0, Math.round((new Date(`${row.end_date}T00:00:00.000Z`).getTime() - Date.now()) / 86_400_000))
      : null;

  const observed = row.status === "completed" ? row.final_value : (finalValue ?? primaryMetric?.currentValue ?? null);

  const result: ExperimentResult =
    primaryMetric == null
      ? {
          baselineValue: row.baseline_value == null ? null : Number(row.baseline_value),
          finalValue: null,
          absoluteChange: null,
          percentChange: null,
          targetValue: row.target_value == null ? null : Number(row.target_value),
          targetAchieved: null,
          observationsInPeriod: 0,
          dataCompleteness: 0,
          trend: "insufficient_data",
          learningStatus: row.learning_status,
          confidence: null,
          confidenceLevel: null,
          statement: "No primary metric is attached yet, so no result can be measured.",
        }
      : computeOutcome({
          direction: primaryMetric.direction,
          baseline: row.baseline_value == null ? null : Number(row.baseline_value),
          final: observed == null ? null : Number(observed),
          target: row.target_value == null ? null : Number(row.target_value),
          observationsInPeriod,
          durationDays,
          frequency: primaryMetric.frequency,
          experimentType: row.experiment_type,
          hasComparison: Boolean(row.comparison_definition),
          baselineFromObservation: Boolean(row.baseline_observation_id),
          metricConfidence: primaryMetric.confidence,
          metricName: primaryMetric.name,
          unit: primaryMetric.unit,
        });

  const baseline = row.baseline_value == null ? null : Number(row.baseline_value);
  const target = row.target_value == null ? null : Number(row.target_value);
  const expectedChangePercent =
    baseline != null && target != null && baseline !== 0
      ? round(((target - baseline) / Math.abs(baseline)) * 100, 1)
      : null;

  let targetProgressPercent: number | null = null;
  if (baseline != null && target != null && observed != null && target !== baseline) {
    targetProgressPercent = Math.max(
      0,
      Math.min(100, ((Number(observed) - baseline) / (target - baseline)) * 100),
    );
  }

  const timeProgressPercent =
    durationDays && elapsedDays != null ? Math.max(0, Math.min(100, (elapsedDays / durationDays) * 100)) : null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    statusLabel: EXPERIMENT_STATUS_LABEL[row.status],
    experimentType: row.experiment_type,
    experimentTypeLabel: EXPERIMENT_TYPE_LABEL[row.experiment_type],
    typeCaveat: EXPERIMENT_TYPE_CAVEAT[row.experiment_type],
    hypothesis:
      row.hypothesis ??
      formatHypothesis({
        intervention: row.hypothesis_intervention,
        expectedChange: row.hypothesis_expected_change,
        rationale: row.hypothesis_rationale,
      }),
    hypothesisIntervention: row.hypothesis_intervention,
    hypothesisExpectedChange: row.hypothesis_expected_change,
    hypothesisRationale: row.hypothesis_rationale,
    rationale: row.rationale,
    interventionSummary: row.intervention_summary,
    comparisonDefinition: row.comparison_definition,
    startDate: row.start_date,
    endDate: row.end_date,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    baselineValue: baseline,
    baselinePeriodStart: row.baseline_period_start,
    baselinePeriodEnd: row.baseline_period_end,
    baselineSource: row.baseline_source,
    targetValue: target,
    expectedChangePercent,
    primaryMetric: primaryMetric ? toMetricView(primaryMetric, "primary") : null,
    secondaryMetrics: secondary,
    links,
    evidence: Array.isArray(row.evidence) ? (row.evidence as unknown as ExperimentEvidence[]) : [],
    result,
    conclusion: row.conclusion,
    learning: row.learning,
    limitation: row.limitation,
    recommendation: row.recommendation,
    learningStatus: row.learning_status,
    learningStatusLabel: LEARNING_STATUS_LABEL[row.learning_status],
    learningGeneratedAt: row.learning_generated_at,
    confidence: row.confidence == null ? result.confidence : Number(row.confidence),
    confidenceLevel: row.confidence_level ?? result.confidenceLevel,
    elapsedDays,
    remainingDays,
    timeProgressPercent,
    targetProgressPercent,
    definitionLocked: isDefinitionLocked(row.status) || row.definition_locked_at != null,
    readiness: evaluateReadiness(row, primaryMetric),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ------------------------------------------------------------------ loading */

async function countObservationsInPeriod(supabase: Client, row: Row) {
  if (!row.primary_metric_id) return { count: 0, latest: null as number | null };
  const { from, to } = periodBounds(row);
  let query = supabase
    .from("business_metrics")
    .select("value, recorded_at")
    .eq("metric_id", row.primary_metric_id)
    .not("value", "is", null)
    .order("recorded_at", { ascending: false });
  if (from) query = query.gte("recorded_at", from);
  if (to) query = query.lte("recorded_at", to);
  const { data } = await query.limit(500);
  const rows = data ?? [];
  return { count: rows.length, latest: rows[0]?.value ?? null };
}

async function resolveLinks(supabase: Client, rows: Row[]) {
  const map = new Map<string, ExperimentView["links"]>();
  const collect = (key: keyof Row) =>
    Array.from(
      new Set(rows.map((r) => r[key]).filter((v): v is string => typeof v === "string" && v.length > 0)),
    );

  const diagIds = collect("source_diagnosis_item_id");
  const taskIds = collect("source_task_id");
  const processIds = collect("process_id");
  const blueprintIds = collect("source_blueprint_id");

  const [diag, tasks, processes, blueprints] = await Promise.all([
    diagIds.length
      ? supabase.from("diagnosis_items").select("id, title").in("id", diagIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    taskIds.length
      ? supabase.from("tasks").select("id, title, status").in("id", taskIds)
      : Promise.resolve({ data: [] as { id: string; title: string; status: string }[] }),
    processIds.length
      ? supabase.from("processes").select("id, name, status, version").in("id", processIds)
      : Promise.resolve({ data: [] as { id: string; name: string; status: string; version: number }[] }),
    blueprintIds.length
      ? supabase.from("business_blueprints").select("id, version").in("id", blueprintIds)
      : Promise.resolve({ data: [] as { id: string; version: number }[] }),
  ]);

  const index = <T extends { id: string }>(list: T[] | null | undefined) =>
    new Map((list ?? []).map((item) => [item.id, item]));
  const diagMap = index(diag.data);
  const taskMap = index(tasks.data);
  const processMap = index(processes.data);
  const blueprintMap = index(blueprints.data);

  for (const row of rows) {
    const process = row.process_id ? (processMap.get(row.process_id) ?? null) : null;
    map.set(row.id, {
      diagnosisItem: (row.source_diagnosis_item_id && diagMap.get(row.source_diagnosis_item_id)) || null,
      diagnosisRunId: row.source_diagnosis_run_id,
      blueprint: (row.source_blueprint_id && blueprintMap.get(row.source_blueprint_id)) || null,
      task: (row.source_task_id && taskMap.get(row.source_task_id)) || null,
      process: process
        ? {
            id: process.id,
            name: process.name,
            status: process.status,
            version: row.process_version ?? process.version ?? null,
          }
        : null,
      processExecutionId: row.process_execution_id,
    });
  }
  return map;
}

const EMPTY_LINKS: ExperimentView["links"] = {
  diagnosisItem: null,
  diagnosisRunId: null,
  blueprint: null,
  task: null,
  process: null,
  processExecutionId: null,
};

export async function loadExperiments(supabase: Client, businessId: string): Promise<ExperimentsPayload> {
  await assertBusinessAccess(supabase, businessId);

  const { data, error } = await supabase
    .from("experiments")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];

  if (rows.length === 0) {
    return {
      experiments: [],
      summary: {
        total: 0,
        draft: 0,
        planned: 0,
        running: 0,
        paused: 0,
        completed: 0,
        cancelled: 0,
        positive: 0,
        negative: 0,
        inconclusive: 0,
      },
    };
  }

  const [{ metrics }, attachmentRows, links] = await Promise.all([
    loadMetrics(supabase, businessId),
    supabase
      .from("experiment_metrics")
      .select("experiment_id, metric_id, role")
      .in("experiment_id", rows.map((r) => r.id)),
    resolveLinks(supabase, rows),
  ]);

  const metricMap = new Map(metrics.map((m) => [m.id, m]));
  const byExperiment = new Map<string, Array<{ metric_id: string; role: string }>>();
  for (const attachment of attachmentRows.data ?? []) {
    const list = byExperiment.get(attachment.experiment_id) ?? [];
    list.push({ metric_id: attachment.metric_id, role: attachment.role });
    byExperiment.set(attachment.experiment_id, list);
  }

  const periods = await Promise.all(rows.map((row) => countObservationsInPeriod(supabase, row)));

  const experiments = rows.map((row, index) =>
    buildView(
      row,
      metricMap,
      byExperiment.get(row.id) ?? [],
      links.get(row.id) ?? EMPTY_LINKS,
      periods[index]!.count,
      periods[index]!.latest,
    ),
  );

  const count = (predicate: (e: ExperimentView) => boolean) => experiments.filter(predicate).length;

  return {
    experiments,
    summary: {
      total: experiments.length,
      draft: count((e) => e.status === "draft"),
      planned: count((e) => e.status === "planned"),
      running: count((e) => e.status === "running"),
      paused: count((e) => e.status === "paused"),
      completed: count((e) => e.status === "completed"),
      cancelled: count((e) => e.status === "cancelled"),
      positive: count((e) => e.status === "completed" && e.learningStatus === "positive"),
      negative: count((e) => e.status === "completed" && e.learningStatus === "negative"),
      inconclusive: count((e) => e.status === "completed" && e.learningStatus === "inconclusive"),
    },
  };
}

async function readRow(supabase: Client, businessId: string, experimentId: string) {
  const { data, error } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", experimentId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Experiment not found for this business.");
  return data;
}

export async function loadExperiment(
  supabase: Client,
  businessId: string,
  experimentId: string,
): Promise<ExperimentDetail | null> {
  await assertBusinessAccess(supabase, businessId);
  const { data: row, error } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", experimentId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const [{ metrics }, attachments, links, period] = await Promise.all([
    loadMetrics(supabase, businessId),
    supabase.from("experiment_metrics").select("metric_id, role").eq("experiment_id", row.id),
    resolveLinks(supabase, [row]),
    countObservationsInPeriod(supabase, row),
  ]);

  const experiment = buildView(
    row,
    new Map(metrics.map((m) => [m.id, m])),
    attachments.data ?? [],
    links.get(row.id) ?? EMPTY_LINKS,
    period.count,
    period.latest,
  );

  let observations: ExperimentDetail["observations"] = [];
  if (row.primary_metric_id) {
    const detail = await loadMetric(supabase, businessId, row.primary_metric_id);
    const { from, to } = periodBounds(row);
    observations = (detail?.observations ?? []).map((o) => {
      const at = new Date(o.recordedAt).getTime();
      const inPeriod =
        (!from || at >= new Date(from).getTime()) && (!to || at <= new Date(to).getTime());
      return {
        id: o.id,
        value: o.value,
        recordedAt: o.recordedAt,
        notes: o.notes,
        source: o.source,
        inPeriod,
      };
    });
  }

  return { experiment, observations };
}

/* ------------------------------------------------------------------ writes */

export type ExperimentInput = {
  businessId: string;
  experimentId?: string | undefined;
  name: string;
  description?: string | null | undefined;
  hypothesisIntervention?: string | null | undefined;
  hypothesisExpectedChange?: string | null | undefined;
  hypothesisRationale?: string | null | undefined;
  rationale?: string | null | undefined;
  experimentType?: ExperimentType | undefined;
  interventionSummary?: string | null | undefined;
  comparisonDefinition?: string | null | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  primaryMetricId?: string | null | undefined;
  secondaryMetricIds?: string[] | undefined;
  baselineValue?: number | null | undefined;
  baselinePeriodStart?: string | null | undefined;
  baselinePeriodEnd?: string | null | undefined;
  baselineSource?: string | null | undefined;
  targetValue?: number | null | undefined;
  sourceDiagnosisItemId?: string | null | undefined;
  sourceDiagnosisRunId?: string | null | undefined;
  sourceBlueprintId?: string | null | undefined;
  sourceTaskId?: string | null | undefined;
  processId?: string | null | undefined;
  processExecutionId?: string | null | undefined;
  evidence?: ExperimentEvidence[] | undefined;
};

async function syncSecondaryMetrics(
  supabase: Client,
  experimentId: string,
  primaryMetricId: string | null,
  metricIds: string[] | undefined,
) {
  if (!metricIds) return;
  const wanted = Array.from(new Set(metricIds.filter((id) => id && id !== primaryMetricId)));
  const { data: existing } = await supabase
    .from("experiment_metrics")
    .select("id, metric_id")
    .eq("experiment_id", experimentId)
    .neq("role", "primary");
  const current = existing ?? [];

  const toRemove = current.filter((row) => !wanted.includes(row.metric_id)).map((row) => row.id);
  if (toRemove.length) {
    await supabase.from("experiment_metrics").delete().in("id", toRemove);
  }
  const currentIds = new Set(current.map((row) => row.metric_id));
  const toAdd = wanted.filter((id) => !currentIds.has(id));
  if (toAdd.length) {
    await supabase
      .from("experiment_metrics")
      .insert(toAdd.map((metric_id) => ({ experiment_id: experimentId, metric_id, role: "secondary" })));
  }
}

/**
 * Pulls a real baseline from the metric's recorded history. Numbers are never
 * invented — if the metric has no observation, no baseline is returned.
 */
export async function suggestBaseline(supabase: Client, businessId: string, metricId: string) {
  const detail = await loadMetric(supabase, businessId, metricId);
  if (!detail) return null;
  const observation = detail.observations.find((o) => o.value != null) ?? null;
  if (observation) {
    return {
      value: observation.value!,
      observationId: observation.id,
      periodStart: observation.periodStart,
      periodEnd: observation.periodEnd ?? observation.recordedAt.slice(0, 10),
      source: `Recorded observation on ${observation.recordedAt.slice(0, 10)}`,
    };
  }
  if (detail.metric.baselineValue != null) {
    return {
      value: detail.metric.baselineValue,
      observationId: null,
      periodStart: null,
      periodEnd: detail.metric.baselineAt?.slice(0, 10) ?? null,
      source: "Metric baseline",
    };
  }
  return null;
}

export async function saveExperiment(options: {
  supabase: Client;
  userId: string;
  input: ExperimentInput;
}) {
  const { supabase, userId, input } = options;
  await assertBusinessAccess(supabase, input.businessId);
  const organizationId = await resolveOrganizationId(supabase, input.businessId);

  const hypothesis = formatHypothesis({
    intervention: input.hypothesisIntervention ?? null,
    expectedChange: input.hypothesisExpectedChange ?? null,
    rationale: input.hypothesisRationale ?? null,
  });

  const editable = {
    name: input.name,
    description: input.description ?? null,
    rationale: input.rationale ?? null,
    intervention_summary: input.interventionSummary ?? null,
    comparison_definition: input.comparisonDefinition ?? null,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    target_value: input.targetValue ?? null,
  };

  /** Frozen once the experiment starts (§26). */
  const definitional = {
    hypothesis,
    hypothesis_intervention: input.hypothesisIntervention ?? null,
    hypothesis_expected_change: input.hypothesisExpectedChange ?? null,
    hypothesis_rationale: input.hypothesisRationale ?? null,
    experiment_type: input.experimentType ?? ("before_after" as ExperimentType),
    primary_metric_id: input.primaryMetricId ?? null,
    baseline_value: input.baselineValue ?? null,
    baseline_period_start: input.baselinePeriodStart ?? null,
    baseline_period_end: input.baselinePeriodEnd ?? null,
    baseline_source: input.baselineSource ?? null,
  };

  if (input.experimentId) {
    const before = await readRow(supabase, input.businessId, input.experimentId);
    if (before.status === "completed" || before.status === "cancelled") {
      throw new Error("A completed or cancelled experiment cannot be edited. Create a new experiment instead.");
    }
    const locked = isDefinitionLocked(before.status) || before.definition_locked_at != null;

    if (locked) {
      const changedDefinition =
        definitional.hypothesis !== before.hypothesis ||
        definitional.experiment_type !== before.experiment_type ||
        definitional.primary_metric_id !== before.primary_metric_id ||
        Number(definitional.baseline_value ?? NaN) !== Number(before.baseline_value ?? NaN);
      if (changedDefinition) {
        throw new Error(
          "This experiment has started. Hypothesis, baseline, type and primary metric are frozen — create a new experiment to test a different idea.",
        );
      }
    }

    const { error } = await supabase
      .from("experiments")
      .update(locked ? editable : { ...editable, ...definitional })
      .eq("id", input.experimentId)
      .eq("business_id", input.businessId);
    if (error) throw error;

    if (!locked) {
      await syncSecondaryMetrics(
        supabase,
        input.experimentId,
        definitional.primary_metric_id,
        input.secondaryMetricIds,
      );
    }

    await writeAudit({
      supabase,
      action: "experiment.updated",
      organizationId,
      businessId: input.businessId,
      userId,
      entity: "experiments",
      entityId: input.experimentId,
      before: { name: before.name, target: before.target_value, status: before.status },
      after: { name: editable.name, target: editable.target_value },
    });

    return { experimentId: input.experimentId };
  }

  const { data: created, error } = await supabase
    .from("experiments")
    .insert({
      business_id: input.businessId,
      organization_id: organizationId,
      created_by: userId,
      status: "draft",
      learning_status: "pending",
      source_diagnosis_item_id: input.sourceDiagnosisItemId ?? null,
      source_diagnosis_run_id: input.sourceDiagnosisRunId ?? null,
      source_blueprint_id: input.sourceBlueprintId ?? null,
      source_task_id: input.sourceTaskId ?? null,
      process_id: input.processId ?? null,
      process_execution_id: input.processExecutionId ?? null,
      evidence: (input.evidence ?? []) as never,
      ...editable,
      ...definitional,
    })
    .select("id, process_id")
    .single();
  if (error) throw error;

  // Freeze the process version the intervention refers to (§30).
  if (created.process_id) {
    const { data: process } = await supabase
      .from("processes")
      .select("version")
      .eq("id", created.process_id)
      .maybeSingle();
    if (process) {
      await supabase.from("experiments").update({ process_version: process.version }).eq("id", created.id);
    }
  }

  if (definitional.primary_metric_id) {
    await supabase.from("experiment_metrics").insert({
      experiment_id: created.id,
      metric_id: definitional.primary_metric_id,
      role: "primary",
    });
  }
  await syncSecondaryMetrics(supabase, created.id, definitional.primary_metric_id, input.secondaryMetricIds);

  await writeAudit({
    supabase,
    action: "experiment.created",
    organizationId,
    businessId: input.businessId,
    userId,
    entity: "experiments",
    entityId: created.id,
    after: {
      name: editable.name,
      type: definitional.experiment_type,
      baseline: definitional.baseline_value,
      target: editable.target_value,
    },
  });

  return { experimentId: created.id };
}

/* ------------------------------------------------------------------ lifecycle */

const ACTION_AUDIT = {
  plan: "experiment.planned",
  unplan: "experiment.updated",
  start: "experiment.started",
  pause: "experiment.paused",
  resume: "experiment.resumed",
  complete: "experiment.completed",
  cancel: "experiment.cancelled",
} as const;

export async function transitionExperiment(options: {
  supabase: Client;
  userId: string;
  businessId: string;
  experimentId: string;
  action: ExperimentAction;
  note?: string | null;
}) {
  const { supabase, userId, businessId, experimentId, action } = options;
  await assertBusinessAccess(supabase, businessId);
  const organizationId = await resolveOrganizationId(supabase, businessId);
  const row = await readRow(supabase, businessId, experimentId);

  if (!canTransition(row.status, action)) {
    throw new Error(
      `An experiment that is ${EXPERIMENT_STATUS_LABEL[row.status].toLowerCase()} cannot be ${action}ed.`,
    );
  }

  const now = new Date().toISOString();
  const target = ACTION_TARGET[action];
  const patch: Database["public"]["Tables"]["experiments"]["Update"] = { status: target };

  if (action === "start" || action === "plan") {
    const { metrics } = await loadMetrics(supabase, businessId);
    const primary = row.primary_metric_id
      ? (metrics.find((m) => m.id === row.primary_metric_id) ?? null)
      : null;
    const readiness = evaluateReadiness(row, primary);
    if (!readiness.ready) {
      throw new Error(readiness.blockers[0] ?? "This experiment is not ready yet.");
    }
  }

  if (action === "start") {
    patch.started_at = row.started_at ?? now;
    patch.definition_locked_at = row.definition_locked_at ?? now;
    patch.paused_at = null;
  }
  if (action === "pause") patch.paused_at = now;
  if (action === "resume") patch.paused_at = null;
  if (action === "cancel") patch.cancelled_at = now;

  let completion: Awaited<ReturnType<typeof finaliseExperiment>> | null = null;
  if (action === "complete") {
    completion = await finaliseExperiment({ supabase, businessId, row });
    Object.assign(patch, completion.patch, { completed_at: now });
  }

  const { error } = await supabase
    .from("experiments")
    .update(patch)
    .eq("id", experimentId)
    .eq("business_id", businessId);
  if (error) throw error;

  await writeAudit({
    supabase,
    action: ACTION_AUDIT[action],
    organizationId,
    businessId,
    userId,
    entity: "experiments",
    entityId: experimentId,
    before: { status: row.status },
    after: { status: target, ...(completion ? completion.audit : {}) },
    ...(options.note ? { metadata: { note: options.note } } : {}),
  });

  return {
    status: target,
    ...(completion ? { result: completion.result } : {}),
  };
}

/**
 * Deterministic completion: reads the numbers, classifies the outcome, and
 * stores the numeric facts separately from any narrative.
 */
async function finaliseExperiment(options: { supabase: Client; businessId: string; row: Row }) {
  const { supabase, businessId, row } = options;
  const { metrics } = await loadMetrics(supabase, businessId);
  const primary = row.primary_metric_id ? metrics.find((m) => m.id === row.primary_metric_id) : undefined;
  const period = await countObservationsInPeriod(supabase, row);

  const durationDays =
    row.start_date && row.end_date
      ? daysBetween(`${row.start_date}T00:00:00.000Z`, `${row.end_date}T00:00:00.000Z`)
      : daysBetween(row.started_at, null);

  const finalValue = period.latest ?? primary?.currentValue ?? null;

  const result = computeOutcome({
    direction: primary?.direction ?? "higher_is_better",
    baseline: row.baseline_value == null ? null : Number(row.baseline_value),
    final: finalValue == null ? null : Number(finalValue),
    target: row.target_value == null ? null : Number(row.target_value),
    observationsInPeriod: period.count,
    durationDays,
    frequency: primary?.frequency ?? "monthly",
    experimentType: row.experiment_type,
    hasComparison: Boolean(row.comparison_definition),
    baselineFromObservation: Boolean(row.baseline_observation_id),
    metricConfidence: primary?.confidence ?? "unknown",
    metricName: primary?.name ?? "The primary metric",
    unit: primary?.unit ?? null,
  });

  return {
    result,
    patch: {
      final_value: result.finalValue,
      absolute_change: result.absoluteChange,
      percent_change: result.percentChange,
      target_achieved: result.targetAchieved,
      learning_status: result.learningStatus,
      confidence: result.confidence,
      confidence_level: result.confidenceLevel,
      conclusion: result.statement,
      result_data: {
        baseline: result.baselineValue,
        final: result.finalValue,
        absolute_change: result.absoluteChange,
        percent_change: result.percentChange,
        target: result.targetValue,
        target_achieved: result.targetAchieved,
        observations_in_period: result.observationsInPeriod,
        data_completeness: result.dataCompleteness,
        trend: result.trend,
        experiment_type: row.experiment_type,
        computed_at: new Date().toISOString(),
        computed_by: "deterministic",
      } as never,
    },
    audit: {
      baseline: result.baselineValue,
      final: result.finalValue,
      percentChange: result.percentChange,
      targetAchieved: result.targetAchieved,
      outcome: result.learningStatus,
    },
  };
}

/** Records an observation against an experiment metric — via the Metrics engine. */
export async function recordExperimentObservation(options: {
  supabase: Client;
  userId: string;
  businessId: string;
  experimentId: string;
  metricId?: string | null;
  value: number;
  recordedAt?: string;
  notes?: string | null;
}) {
  const { supabase, userId, businessId, experimentId } = options;
  const row = await readRow(supabase, businessId, experimentId);
  if (row.status !== "running" && row.status !== "paused") {
    throw new Error("Observations can only be recorded while an experiment is running or paused.");
  }

  const metricId = options.metricId ?? row.primary_metric_id;
  if (!metricId) throw new Error("This experiment has no metric to record against.");

  if (metricId !== row.primary_metric_id) {
    const { data: attached } = await supabase
      .from("experiment_metrics")
      .select("id")
      .eq("experiment_id", experimentId)
      .eq("metric_id", metricId)
      .maybeSingle();
    if (!attached) throw new Error("That metric is not attached to this experiment.");
  }

  const outcome = await recordObservation({
    supabase,
    userId,
    input: {
      businessId,
      metricId,
      value: options.value,
      ...(options.recordedAt ? { recordedAt: options.recordedAt } : {}),
      notes: options.notes ?? `Recorded during experiment "${row.name}".`,
      source: "manual",
    },
  });

  await writeAudit({
    supabase,
    action: "experiment.observation_recorded",
    organizationId: row.organization_id,
    businessId,
    userId,
    entity: "experiments",
    entityId: experimentId,
    after: { metricId, value: options.value },
  });

  return outcome;
}

/* ------------------------------------------------------------------ AI drafting */

type DraftShape = {
  name?: string;
  intervention?: string;
  expected_change?: string;
  rationale?: string;
  intervention_summary?: string;
  metric_suggestion?: string;
  description?: string;
};

/**
 * Drafts an experiment from a diagnosis finding, an action or a process.
 * AI writes the *language*; every number stays deterministic and the result is
 * only ever a DRAFT — nothing starts automatically (§11).
 */
export async function draftExperiment(options: {
  supabase: Client;
  userId: string;
  businessId: string;
  from: { diagnosisItemId?: string; taskId?: string; processId?: string };
}) {
  const { supabase, userId, businessId, from } = options;
  await assertBusinessAccess(supabase, businessId);
  const organizationId = await resolveOrganizationId(supabase, businessId);

  let seedTitle = "Business improvement test";
  let seedContext = "";
  let evidence: ExperimentEvidence[] = [];
  let sourceDiagnosisRunId: string | null = null;
  let suggestedMetricId: string | null = null;

  if (from.diagnosisItemId) {
    const { data: item } = await supabase
      .from("diagnosis_items")
      .select("id, title, description, recommendation, category, evidence, diagnosis_run_id")
      .eq("id", from.diagnosisItemId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!item) throw new Error("Diagnosis finding not found.");
    seedTitle = item.title;
    seedContext = [
      `Diagnosis finding (${item.category}): ${item.title}`,
      item.description ?? "",
      item.recommendation ? `Recommended direction: ${item.recommendation}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    sourceDiagnosisRunId = item.diagnosis_run_id;
    const raw = item.evidence;
    if (Array.isArray(raw)) {
      evidence = (raw as unknown as Array<Record<string, unknown>>).slice(0, 8).map((e) => ({
        factId: (e["factId"] as string) ?? null,
        factKey: String(e["factKey"] ?? "fact"),
        value: String(e["value"] ?? ""),
        quality: String(e["quality"] ?? "stated"),
      }));
    }
  } else if (from.taskId) {
    const { data: task } = await supabase
      .from("tasks")
      .select("id, title, description")
      .eq("id", from.taskId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!task) throw new Error("Action not found.");
    seedTitle = task.title;
    seedContext = `Action plan item: ${task.title}\n${task.description ?? ""}`;
  } else if (from.processId) {
    const { data: process } = await supabase
      .from("processes")
      .select("id, name, purpose, description, success_definition")
      .eq("id", from.processId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!process) throw new Error("Process not found.");
    seedTitle = process.name;
    seedContext = [
      `Process: ${process.name}`,
      process.purpose ?? process.description ?? "",
      process.success_definition ? `Intended outcome: ${process.success_definition}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else {
    throw new Error("An experiment draft needs a diagnosis finding, an action or a process to start from.");
  }

  const { metrics } = await loadMetrics(supabase, businessId);
  const metricCatalogue = metrics
    .slice(0, 40)
    .map((m) => `- ${m.id} | ${m.name} | unit: ${m.unit ?? "none"} | baseline: ${m.baselineValue ?? "none"}`)
    .join("\n");

  const business = await assertBusinessAccess(supabase, businessId);

  const draft = await chatJsonResult<DraftShape>({
    model: AI_MODELS.planning,
    maxTokens: 1200,
    accounting: {
      supabase,
      context: { organizationId, businessId, operation: "experiment_draft" },
    },
    messages: [
      {
        role: "system",
        content:
          "You draft business-improvement experiments for a small business operating system. You write only language: a name, an intervention, an expected change, and a rationale grounded in the supplied evidence. Never invent numbers, percentages, currency amounts or dates — the system computes those. Return strict JSON with keys: name, intervention, expected_change, rationale, intervention_summary, metric_suggestion, description.",
      },
      {
        role: "user",
        content: [
          `Business: ${business.name}${business.industry ? ` (${business.industry})` : ""}`,
          business.description ? `About: ${business.description}` : "",
          "",
          seedContext,
          "",
          evidence.length
            ? `Supporting Brain facts:\n${evidence.map((e) => `- ${e.factKey}: ${e.value} (${e.quality})`).join("\n")}`
            : "",
          "",
          metricCatalogue ? `Existing metrics (id | name):\n${metricCatalogue}` : "No metrics exist yet.",
          "",
          "Draft one focused experiment. 'metric_suggestion' must be the id of an existing metric if a suitable one exists, otherwise the name of the metric that should be created. 'expected_change' should describe the direction and nature of the expected movement in words, not numbers.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  const drafted = draft.ok ? draft.data : {};
  const suggestion = drafted.metric_suggestion?.trim() ?? "";
  if (suggestion && metrics.some((m) => m.id === suggestion)) suggestedMetricId = suggestion;

  // Deterministic baseline — pulled from real observations, never invented.
  let baseline: Awaited<ReturnType<typeof suggestBaseline>> = null;
  if (suggestedMetricId) baseline = await suggestBaseline(supabase, businessId, suggestedMetricId);

  const today = new Date();
  const end = new Date(today.getTime() + 30 * 86_400_000);

  const saved = await saveExperiment({
    supabase,
    userId,
    input: {
      businessId,
      name: drafted.name?.slice(0, 160) || `Test: ${seedTitle}`.slice(0, 160),
      description: drafted.description ?? null,
      hypothesisIntervention: drafted.intervention ?? null,
      hypothesisExpectedChange: drafted.expected_change ?? null,
      hypothesisRationale: drafted.rationale ?? null,
      rationale: drafted.rationale ?? null,
      interventionSummary: drafted.intervention_summary ?? drafted.intervention ?? null,
      experimentType: "before_after",
      startDate: today.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      primaryMetricId: suggestedMetricId,
      baselineValue: baseline?.value ?? null,
      baselinePeriodStart: baseline?.periodStart ?? null,
      baselinePeriodEnd: baseline?.periodEnd ?? null,
      baselineSource: baseline?.source ?? null,
      targetValue: null,
      evidence,
      ...(from.diagnosisItemId ? { sourceDiagnosisItemId: from.diagnosisItemId } : {}),
      ...(sourceDiagnosisRunId ? { sourceDiagnosisRunId } : {}),
      ...(from.taskId ? { sourceTaskId: from.taskId } : {}),
      ...(from.processId ? { processId: from.processId } : {}),
    },
  });

  if (baseline?.observationId) {
    await supabase
      .from("experiments")
      .update({ baseline_observation_id: baseline.observationId })
      .eq("id", saved.experimentId);
  }

  return {
    experimentId: saved.experimentId,
    aiUsed: draft.ok,
    metricSuggestionText: suggestedMetricId ? null : suggestion || null,
    needsBaseline: baseline == null,
  };
}

/* ------------------------------------------------------------------ learning */

type LearningShape = {
  learning?: string;
  limitation?: string;
  recommendation?: string;
};

/**
 * Synthesises the narrative for a completed experiment and writes durable Brain
 * memory. Numbers come from `result_data`; AI only phrases them.
 */
export async function generateExperimentLearning(options: {
  supabase: Client;
  businessId: string;
  experimentId: string;
  userId?: string | null;
  organizationId?: string | null;
  jobId?: string | null;
}) {
  const { supabase, businessId, experimentId } = options;
  const row = await readRow(supabase, businessId, experimentId);
  if (row.status !== "completed") {
    throw new Error("Learning is generated once an experiment is completed.");
  }
  const organizationId =
    options.organizationId ?? row.organization_id ?? (await resolveOrganizationId(supabase, businessId));

  const primary = row.primary_metric_id
    ? await loadMetric(supabase, businessId, row.primary_metric_id)
    : null;
  const metricName = primary?.metric.name ?? "the primary metric";
  const unit = primary?.metric.unit ?? null;
  const facts = (row.result_data ?? {}) as Record<string, unknown>;

  const fmt = (value: unknown) =>
    value == null || Number.isNaN(Number(value))
      ? "—"
      : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value))}${unit ? ` ${unit}` : ""}`;

  const controlled = row.experiment_type === "controlled" && Boolean(row.comparison_definition);
  const numericSummary = [
    `Experiment: ${row.name}`,
    `Design: ${EXPERIMENT_TYPE_LABEL[row.experiment_type]}`,
    `Intervention: ${row.intervention_summary ?? "not recorded"}`,
    `Metric: ${metricName}`,
    `Baseline: ${fmt(facts["baseline"])}`,
    `Final: ${fmt(facts["final"])}`,
    `Change: ${facts["percent_change"] == null ? "—" : `${Number(facts["percent_change"]) > 0 ? "+" : ""}${facts["percent_change"]}%`}`,
    `Target: ${fmt(facts["target"])} — ${facts["target_achieved"] === true ? "achieved" : facts["target_achieved"] === false ? "not achieved" : "no target set"}`,
    `Observations in period: ${facts["observations_in_period"] ?? 0} (data completeness ${facts["data_completeness"] ?? 0}%)`,
    `Deterministic outcome: ${row.learning_status.toUpperCase()} at ${row.confidence ?? "—"}% confidence`,
    `Controlled comparison: ${controlled ? row.comparison_definition : "none"}`,
  ].join("\n");

  const synthesis = await chatJsonResult<LearningShape>({
    model: AI_MODELS.planning,
    maxTokens: 900,
    accounting: {
      supabase,
      context: {
        organizationId,
        businessId,
        operation: "experiment_learning",
        ...(options.jobId ? { jobId: options.jobId } : {}),
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You write the learning record for a completed business experiment. The numbers and the outcome classification are already decided and must not be recalculated, contradicted or restated inaccurately. Never claim causation unless a controlled comparison is stated. Prefer 'X increased during the intervention period' over 'the intervention caused X'. Return strict JSON: { learning, limitation, recommendation }. Each field is 1-3 plain sentences addressed to a business owner.",
      },
      { role: "user", content: numericSummary },
    ],
  });

  const fallbackLearning = `${row.conclusion ?? "The experiment completed."} Business OS records this as a ${row.learning_status} result.`;
  const learning = synthesis.ok ? (synthesis.data.learning ?? fallbackLearning) : fallbackLearning;
  const limitation = synthesis.ok
    ? (synthesis.data.limitation ??
      (controlled ? "The comparison was defined but not randomised." : "No controlled comparison was available."))
    : controlled
      ? "The comparison was defined but not randomised."
      : "No controlled comparison was available.";
  const recommendation = synthesis.ok ? (synthesis.data.recommendation ?? null) : null;

  await supabase
    .from("experiments")
    .update({
      learning,
      limitation,
      recommendation,
      learning_generated_at: new Date().toISOString(),
    })
    .eq("id", experimentId)
    .eq("business_id", businessId);

  /* Durable Brain memory — an observation, never a verified causal fact (§23). */
  const memoryContent = [
    `Experiment "${row.name}" ran as a ${EXPERIMENT_TYPE_LABEL[row.experiment_type].toLowerCase()} test${row.start_date && row.end_date ? ` from ${row.start_date} to ${row.end_date}` : ""}.`,
    row.intervention_summary ? `Intervention: ${row.intervention_summary}.` : "",
    `${metricName} moved from ${fmt(facts["baseline"])} to ${fmt(facts["final"])}${
      facts["percent_change"] == null
        ? ""
        : ` (${Number(facts["percent_change"]) > 0 ? "+" : ""}${facts["percent_change"]}%)`
    }.`,
    `Outcome: ${row.learning_status}. ${limitation}`,
    learning,
  ]
    .filter(Boolean)
    .join(" ");

  const { writeMemory } = await import("./memory.server");
  const memory = await writeMemory({
    supabase,
    memory: {
      businessId,
      memoryType: "experiment_outcome",
      title: `Experiment outcome — ${row.name}`,
      content: memoryContent,
      sourceTable: "experiments",
      sourceId: row.id,
      importance: row.learning_status === "inconclusive" ? 55 : 80,
      confidence: row.confidence == null ? 45 : Number(row.confidence),
      metadata: {
        source: "experiment",
        experiment_id: row.id,
        primary_metric_id: row.primary_metric_id,
        baseline: facts["baseline"] ?? null,
        final_value: facts["final"] ?? null,
        absolute_change: facts["absolute_change"] ?? null,
        percent_change: facts["percent_change"] ?? null,
        target: facts["target"] ?? null,
        target_achieved: facts["target_achieved"] ?? null,
        outcome: row.learning_status,
        confidence: row.confidence,
        confidence_level: row.confidence_level,
        limitation,
        recommendation,
        experiment_type: row.experiment_type,
        causal_evidence: controlled,
        related_task_id: row.source_task_id,
        related_process_id: row.process_id,
        related_diagnosis_item_id: row.source_diagnosis_item_id,
        period: { from: row.start_date, to: row.end_date },
      },
    },
    accounting: {
      supabase,
      context: {
        organizationId,
        businessId,
        operation: "experiment_memory",
        ...(options.jobId ? { jobId: options.jobId } : {}),
      },
    },
  });

  await writeAudit({
    supabase,
    action: "experiment.learning_generated",
    organizationId,
    businessId,
    userId: options.userId ?? null,
    actor: options.jobId ? "system" : "user",
    entity: "experiments",
    entityId: experimentId,
    after: { outcome: row.learning_status, memoryWritten: memory.ok, aiUsed: synthesis.ok },
  });

  return { learning, limitation, recommendation, memoryWritten: memory.ok, aiUsed: synthesis.ok };
}
