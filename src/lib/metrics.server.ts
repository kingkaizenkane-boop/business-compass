/**
 * Server-only Metrics & Outcome engine.
 *
 * Metrics are never decoration: every definition can point at the goal,
 * diagnosis finding, action-plan task or process it exists to measure.
 * Observations are append-only — history is never rewritten.
 *
 * Outcome language is deliberately non-causal. We say performance improved
 * *after* an intervention, never that the intervention caused it, unless
 * causal evidence exists (which only the Experiments module will supply).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAudit } from "./audit.server";
import type { Database } from "@/integrations/supabase/types";
import type {
  MetricAlert,
  MetricConfidence,
  MetricDirection,
  MetricFrequency,
  MetricLinks,
  MetricObservation,
  MetricSource,
  MetricTrend,
  MetricView,
  MetricsPayload,
} from "./metrics-types";

type Client = SupabaseClient<Database>;

export type {
  MetricAlert,
  MetricConfidence,
  MetricDirection,
  MetricFrequency,
  MetricLinks,
  MetricObservation,
  MetricSource,
  MetricTrend,
  MetricView,
  MetricsPayload,
} from "./metrics-types";


/* ------------------------------------------------------------------ math */

const FRESHNESS_WINDOW_DAYS: Record<MetricFrequency, number> = {
  daily: 2,
  weekly: 10,
  monthly: 40,
  quarterly: 120,
  custom: 45,
};

function daysSince(iso: string | null) {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function betterThan(direction: MetricDirection, a: number, b: number) {
  return direction === "lower_is_better" ? a < b : a > b;
}

/** Deterministic outcome classification. No AI, no guessing. */
export function classifyTrend(input: {
  direction: MetricDirection;
  baseline: number | null;
  previous: number | null;
  current: number | null;
  target: number | null;
  observationCount: number;
}): { trend: MetricTrend; label: string } {
  const { direction, baseline, previous, current, target, observationCount } = input;
  if (current == null || observationCount === 0) {
    return { trend: "insufficient_data", label: "Not enough data" };
  }

  if (target != null) {
    const reached =
      direction === "lower_is_better" ? current <= target : current >= target;
    if (reached) return { trend: "target_achieved", label: "Target achieved" };
  }

  const reference = previous ?? baseline;
  if (reference == null) return { trend: "insufficient_data", label: "Baseline not set" };

  const delta = Math.abs(current - reference);
  const scale = Math.max(Math.abs(reference), 1);
  if (delta / scale < 0.02) return { trend: "stable", label: "Holding steady" };

  if (betterThan(direction, current, reference)) {
    return { trend: "improving", label: "Improving" };
  }

  if (target != null && baseline != null && betterThan(direction, baseline, current)) {
    return { trend: "target_missed", label: "Below baseline" };
  }
  return { trend: "declining", label: "Declining" };
}

function outcomeSentence(view: {
  name: string;
  unit: string | null;
  baseline: number | null;
  current: number | null;
  target: number | null;
  trend: MetricTrend;
  percent: number | null;
}) {
  const fmt = (value: number | null) =>
    value == null ? "—" : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}${view.unit ? ` ${view.unit}` : ""}`;

  switch (view.trend) {
    case "insufficient_data":
      return "Not enough observations yet to read an outcome. Record at least one value against a baseline.";
    case "target_achieved":
      return `${view.name} reached its target (${fmt(view.target)}); current reading is ${fmt(view.current)}.`;
    case "improving":
      return `${view.name} improved to ${fmt(view.current)} from a baseline of ${fmt(view.baseline)}${
        view.percent == null ? "" : ` (${view.percent > 0 ? "+" : ""}${view.percent.toFixed(1)}%)`
      }. Performance moved in the intended direction over this period — this is an observed change, not proven causation.`;
    case "declining":
      return `${view.name} moved against its intended direction, now ${fmt(view.current)} versus a baseline of ${fmt(view.baseline)}. Worth investigating before drawing conclusions.`;
    case "target_missed":
      return `${view.name} is currently ${fmt(view.current)}, below the ${fmt(view.baseline)} baseline and short of the ${fmt(view.target)} target.`;
    default:
      return `${view.name} is broadly flat at ${fmt(view.current)}. No meaningful movement in this period.`;
  }
}

/* ------------------------------------------------------------------ load */

type DefRow = Database["public"]["Tables"]["metric_definitions"]["Row"];

function buildView(
  row: DefRow,
  observations: MetricObservation[],
  links: MetricLinks,
): MetricView {
  const withValues = observations.filter((o) => o.value != null);
  const latest = withValues[0] ?? null;
  const prior = withValues[1] ?? null;
  const current = row.current_value ?? latest?.value ?? null;
  const previous = prior?.value ?? null;
  const baseline = row.baseline_value;
  const target = row.target_value;

  const changeFromBaseline = current != null && baseline != null ? current - baseline : null;
  const changeFromBaselinePercent =
    changeFromBaseline != null && baseline != null && baseline !== 0
      ? (changeFromBaseline / Math.abs(baseline)) * 100
      : null;
  const changeFromPrevious = current != null && previous != null ? current - previous : null;
  const distanceToTarget = current != null && target != null ? target - current : null;

  let targetProgressPercent: number | null = null;
  if (current != null && target != null && baseline != null && target !== baseline) {
    targetProgressPercent = Math.max(
      0,
      Math.min(100, ((current - baseline) / (target - baseline)) * 100),
    );
  }

  const { trend, label } = classifyTrend({
    direction: row.direction,
    baseline,
    previous,
    current,
    target,
    observationCount: withValues.length,
  });

  const freshnessDays = daysSince(row.current_recorded_at ?? latest?.recordedAt ?? null);
  const window = FRESHNESS_WINDOW_DAYS[row.frequency];
  const confidence: MetricConfidence =
    withValues.length === 0 || freshnessDays == null
      ? "unknown"
      : freshnessDays > window * 2 || withValues.length < 2
        ? "low"
        : freshnessDays > window || withValues.length < 4
          ? "medium"
          : "high";

  return {
    id: row.id,
    name: row.name,
    metricKey: row.metric_key,
    category: row.category,
    unit: row.unit,
    description: row.description,
    rationale: row.rationale,
    source: row.source,
    direction: row.direction,
    frequency: row.frequency,
    active: row.active,
    baselineValue: baseline,
    baselineAt: row.baseline_at,
    targetValue: target,
    currentValue: current,
    currentRecordedAt: row.current_recorded_at ?? latest?.recordedAt ?? null,
    previousValue: previous,
    observationCount: withValues.length,
    changeFromBaseline,
    changeFromBaselinePercent,
    changeFromPrevious,
    distanceToTarget,
    targetProgressPercent,
    trend,
    trendLabel: label,
    outcomeSummary: outcomeSentence({
      name: row.name,
      unit: row.unit,
      baseline,
      current,
      target,
      trend,
      percent: changeFromBaselinePercent,
    }),
    freshnessDays,
    confidence,
    links,
    hypothesis: row.hypothesis,
    intervention: row.intervention,
  };
}

/** Alerts are deliberately quiet: only structural signals, never noise. */
function buildAlerts(view: MetricView, observations: MetricObservation[]): MetricAlert[] {
  const alerts: MetricAlert[] = [];
  const base = { metricId: view.id, metricName: view.name };
  const values = observations.filter((o) => o.value != null).map((o) => o.value!);

  if (view.trend === "target_achieved") {
    alerts.push({ ...base, kind: "target_achieved", severity: "info", message: `${view.name} has reached its target.` });
  }

  // Three consecutive readings moving the wrong way.
  if (values.length >= 4) {
    const recent = values.slice(0, 4);
    let consecutive = 0;
    for (let i = 0; i < 3; i += 1) {
      if (betterThan(view.direction, recent[i + 1]!, recent[i]!)) consecutive += 1;
    }
    if (consecutive === 3) {
      alerts.push({
        ...base,
        kind: "declining",
        severity: "critical",
        message: `${view.name} has moved against its intended direction for three consecutive periods.`,
      });
    }
  }

  if (
    view.trend === "declining" &&
    view.targetValue != null &&
    (view.targetProgressPercent ?? 0) < 35
  ) {
    alerts.push({
      ...base,
      kind: "target_at_risk",
      severity: "warning",
      message: `${view.name} is under 35% of the way to target and currently moving the wrong way.`,
    });
  }

  if (view.changeFromPrevious != null && view.previousValue) {
    const swing = Math.abs(view.changeFromPrevious / Math.abs(view.previousValue));
    if (swing >= 0.4) {
      alerts.push({
        ...base,
        kind: "unexpected_change",
        severity: "warning",
        message: `${view.name} changed by ${(swing * 100).toFixed(0)}% versus the previous period — verify the data before acting on it.`,
      });
    }
  }

  if (
    view.observationCount > 0 &&
    view.freshnessDays != null &&
    view.freshnessDays > FRESHNESS_WINDOW_DAYS[view.frequency] * 2
  ) {
    alerts.push({
      ...base,
      kind: "stale",
      severity: "info",
      message: `${view.name} has not been updated in ${view.freshnessDays} days.`,
    });
  }

  return alerts;
}

const EMPTY_LINKS: MetricLinks = { goal: null, diagnosisItem: null, task: null, process: null };

async function loadObservations(supabase: Client, metricIds: string[]) {
  const map = new Map<string, MetricObservation[]>();
  if (metricIds.length === 0) return map;
  const { data, error } = await supabase
    .from("business_metrics")
    .select("id, metric_id, value, recorded_at, period_start, period_end, source, notes")
    .in("metric_id", metricIds)
    .order("recorded_at", { ascending: false });
  if (error) throw error;
  for (const row of data ?? []) {
    if (!row.metric_id) continue;
    const list = map.get(row.metric_id) ?? [];
    list.push({
      id: row.id,
      value: row.value,
      recordedAt: row.recorded_at,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      source: row.source,
      notes: row.notes,
    });
    map.set(row.metric_id, list);
  }
  return map;
}

async function resolveLinks(supabase: Client, rows: DefRow[]) {
  const links = new Map<string, MetricLinks>();
  const ids = <K extends keyof DefRow>(key: K) =>
    Array.from(new Set(rows.map((r) => r[key]).filter((v): v is string => typeof v === "string")));

  const goalIds = ids("goal_id");
  const diagIds = ids("diagnosis_item_id");
  const taskIds = ids("task_id");
  const processIds = ids("process_id");

  const [goals, diags, tasks, processes] = await Promise.all([
    goalIds.length
      ? supabase.from("business_goals").select("id, name").in("id", goalIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    diagIds.length
      ? supabase.from("diagnosis_items").select("id, title").in("id", diagIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    taskIds.length
      ? supabase.from("tasks").select("id, title, status").in("id", taskIds)
      : Promise.resolve({ data: [] as { id: string; title: string; status: string }[] }),
    processIds.length
      ? supabase.from("processes").select("id, name, status").in("id", processIds)
      : Promise.resolve({ data: [] as { id: string; name: string; status: string }[] }),
  ]);

  const byId = <T extends { id: string }>(list: T[] | null | undefined) =>
    new Map((list ?? []).map((item) => [item.id, item]));
  const goalMap = byId(goals.data);
  const diagMap = byId(diags.data);
  const taskMap = byId(tasks.data);
  const processMap = byId(processes.data);

  for (const row of rows) {
    links.set(row.id, {
      goal: (row.goal_id && goalMap.get(row.goal_id)) || null,
      diagnosisItem: (row.diagnosis_item_id && diagMap.get(row.diagnosis_item_id)) || null,
      task: (row.task_id && taskMap.get(row.task_id)) || null,
      process: (row.process_id && processMap.get(row.process_id)) || null,
    });
  }
  return links;
}

export async function loadMetrics(supabase: Client, businessId: string): Promise<MetricsPayload> {
  const { data: rows, error } = await supabase
    .from("metric_definitions")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const defs = rows ?? [];
  const [observations, links] = await Promise.all([
    loadObservations(supabase, defs.map((d) => d.id)),
    resolveLinks(supabase, defs),
  ]);

  const metrics = defs.map((row) =>
    buildView(row, observations.get(row.id) ?? [], links.get(row.id) ?? EMPTY_LINKS),
  );

  const alerts = metrics.flatMap((view) => buildAlerts(view, observations.get(view.id) ?? []));

  return {
    metrics,
    alerts,
    summary: {
      total: metrics.length,
      withBaseline: metrics.filter((m) => m.baselineValue != null).length,
      improving: metrics.filter((m) => m.trend === "improving").length,
      declining: metrics.filter((m) => m.trend === "declining" || m.trend === "target_missed").length,
      onTarget: metrics.filter((m) => m.trend === "target_achieved").length,
      needsAttention: metrics.filter(
        (m) => m.trend === "declining" || m.trend === "target_missed" || m.confidence === "low",
      ).length,
    },
  };
}

export async function loadMetric(supabase: Client, businessId: string, metricId: string) {
  const { data: row, error } = await supabase
    .from("metric_definitions")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", metricId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const [observations, links] = await Promise.all([
    loadObservations(supabase, [row.id]),
    resolveLinks(supabase, [row]),
  ]);
  const list = observations.get(row.id) ?? [];
  const metric = buildView(row, list, links.get(row.id) ?? EMPTY_LINKS);
  return { metric, observations: list, alerts: buildAlerts(metric, list) };
}

/** Metrics attached to one process — used by the process detail page. */
export async function loadProcessMetrics(
  supabase: Client,
  businessId: string,
  processId: string,
): Promise<MetricView[]> {
  const payload = await loadMetrics(supabase, businessId);
  return payload.metrics.filter((m) => m.links.process?.id === processId);
}

/* ------------------------------------------------------------------ writes */

export type MetricUpsertInput = {
  businessId: string;
  metricId?: string;
  name: string;
  metricKey?: string;
  category?: string | null;
  unit?: string | null;
  description?: string | null;
  rationale?: string | null;
  source?: MetricSource;
  direction?: MetricDirection;
  frequency?: MetricFrequency;
  baselineValue?: number | null;
  targetValue?: number | null;
  active?: boolean;
  goalId?: string | null;
  diagnosisItemId?: string | null;
  taskId?: string | null;
  processId?: string | null;
  hypothesis?: string | null;
  intervention?: string | null;
};

function slugKey(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 48) || "metric"
  );
}

export async function upsertMetric(options: {
  supabase: Client;
  userId: string;
  input: MetricUpsertInput;
}) {
  const { supabase, userId, input } = options;

  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("id, organization_id")
    .eq("id", input.businessId)
    .maybeSingle();
  if (bizError) throw bizError;
  if (!business) throw new Error("Business not found or not accessible.");

  const patch = {
    business_id: input.businessId,
    organization_id: business.organization_id,
    name: input.name,
    category: input.category ?? null,
    unit: input.unit ?? null,
    description: input.description ?? null,
    rationale: input.rationale ?? null,
    source: input.source ?? "manual",
    direction: input.direction ?? "higher_is_better",
    frequency: input.frequency ?? "monthly",
    baseline_value: input.baselineValue ?? null,
    target_value: input.targetValue ?? null,
    active: input.active ?? true,
    goal_id: input.goalId ?? null,
    diagnosis_item_id: input.diagnosisItemId ?? null,
    task_id: input.taskId ?? null,
    process_id: input.processId ?? null,
    hypothesis: input.hypothesis ?? null,
    intervention: input.intervention ?? null,
  };

  if (input.metricId) {
    const { data: before, error: readError } = await supabase
      .from("metric_definitions")
      .select("*")
      .eq("id", input.metricId)
      .eq("business_id", input.businessId)
      .maybeSingle();
    if (readError) throw readError;
    if (!before) throw new Error("Metric not found.");

    const baselineChanged = before.baseline_value !== patch.baseline_value;
    const targetChanged = before.target_value !== patch.target_value;

    const { data: updated, error } = await supabase
      .from("metric_definitions")
      .update({
        ...patch,
        ...(baselineChanged && patch.baseline_value != null
          ? { baseline_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", input.metricId)
      .select("id")
      .single();
    if (error) throw error;

    await writeAudit({
      supabase,
      action: "metric.updated",
      organizationId: business.organization_id,
      businessId: input.businessId,
      userId,
      entity: "metric_definitions",
      entityId: updated.id,
      before: { baseline: before.baseline_value, target: before.target_value, name: before.name },
      after: { baseline: patch.baseline_value, target: patch.target_value, name: patch.name },
    });
    if (baselineChanged && patch.baseline_value != null) {
      await writeAudit({
        supabase,
        action: "metric.baseline_established",
        organizationId: business.organization_id,
        businessId: input.businessId,
        userId,
        entity: "metric_definitions",
        entityId: updated.id,
        after: { baseline: patch.baseline_value },
      });
    }
    if (targetChanged) {
      await writeAudit({
        supabase,
        action: "metric.target_changed",
        organizationId: business.organization_id,
        businessId: input.businessId,
        userId,
        entity: "metric_definitions",
        entityId: updated.id,
        before: { target: before.target_value },
        after: { target: patch.target_value },
      });
    }
    if (before.active && patch.active === false) {
      await writeAudit({
        supabase,
        action: "metric.archived",
        organizationId: business.organization_id,
        businessId: input.businessId,
        userId,
        entity: "metric_definitions",
        entityId: updated.id,
      });
    }
    return { metricId: updated.id };
  }

  const baseKey = input.metricKey ? slugKey(input.metricKey) : slugKey(input.name);
  let key = baseKey;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: clash } = await supabase
      .from("metric_definitions")
      .select("id")
      .eq("business_id", input.businessId)
      .eq("metric_key", key)
      .maybeSingle();
    if (!clash) break;
    key = `${baseKey}_${attempt + 2}`;
  }

  const { data: created, error } = await supabase
    .from("metric_definitions")
    .insert({
      ...patch,
      metric_key: key,
      baseline_at: patch.baseline_value != null ? new Date().toISOString() : null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;

  await writeAudit({
    supabase,
    action: "metric.created",
    organizationId: business.organization_id,
    businessId: input.businessId,
    userId,
    entity: "metric_definitions",
    entityId: created.id,
    after: { name: patch.name, key, baseline: patch.baseline_value, target: patch.target_value },
  });
  if (patch.baseline_value != null) {
    await writeAudit({
      supabase,
      action: "metric.baseline_established",
      organizationId: business.organization_id,
      businessId: input.businessId,
      userId,
      entity: "metric_definitions",
      entityId: created.id,
      after: { baseline: patch.baseline_value },
    });
  }

  return { metricId: created.id };
}

export type ObservationInput = {
  businessId: string;
  metricId: string;
  value: number;
  recordedAt?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  notes?: string | null;
  source?: MetricSource;
  processExecutionId?: string | null;
};

/**
 * Appends one observation. History is never mutated; only the definition's
 * denormalised `current_value` snapshot moves forward.
 */
export async function recordObservation(options: {
  supabase: Client;
  userId: string;
  input: ObservationInput;
}) {
  const { supabase, userId, input } = options;
  if (!Number.isFinite(input.value)) throw new Error("Value must be a number.");

  const { data: def, error: defError } = await supabase
    .from("metric_definitions")
    .select("*")
    .eq("id", input.metricId)
    .eq("business_id", input.businessId)
    .maybeSingle();
  if (defError) throw defError;
  if (!def) throw new Error("Metric not found for this business.");

  const recordedAt = input.recordedAt ? new Date(input.recordedAt) : new Date();
  if (Number.isNaN(recordedAt.getTime())) throw new Error("Invalid observation date.");

  const { data: observation, error } = await supabase
    .from("business_metrics")
    .insert({
      business_id: input.businessId,
      metric_id: def.id,
      metric_key: def.metric_key,
      metric_name: def.name,
      value: input.value,
      unit: def.unit,
      recorded_at: recordedAt.toISOString(),
      period_start: input.periodStart ?? null,
      period_end: input.periodEnd ?? null,
      source: input.source ?? def.source,
      notes: input.notes ?? null,
      created_by: userId,
      metadata: input.processExecutionId
        ? { process_execution_id: input.processExecutionId }
        : {},
    })
    .select("id")
    .single();
  if (error) throw error;

  // Refresh the snapshot from the newest observation on record.
  const { data: newest } = await supabase
    .from("business_metrics")
    .select("value, recorded_at")
    .eq("metric_id", def.id)
    .not("value", "is", null)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const baselinePatch =
    def.baseline_value == null
      ? { baseline_value: input.value, baseline_at: recordedAt.toISOString() }
      : {};

  await supabase
    .from("metric_definitions")
    .update({
      current_value: newest?.value ?? input.value,
      current_recorded_at: newest?.recorded_at ?? recordedAt.toISOString(),
      ...baselinePatch,
    })
    .eq("id", def.id);

  await writeAudit({
    supabase,
    action: "metric.observation_added",
    organizationId: def.organization_id,
    businessId: input.businessId,
    userId,
    entity: "business_metrics",
    entityId: observation.id,
    after: { metric: def.name, value: input.value, recordedAt: recordedAt.toISOString() },
  });

  const detail = await loadMetric(supabase, input.businessId, def.id);
  let memoryWritten = false;
  if (detail) {
    memoryWritten = await maybeWriteOutcomeMemory({
      supabase,
      businessId: input.businessId,
      view: detail.metric,
    });
  }

  return {
    observationId: observation.id,
    metric: detail?.metric ?? null,
    alerts: detail?.alerts ?? [],
    memoryWritten,
  };
}

/**
 * Durable Brain memory for meaningful outcomes only. Stored as an observation,
 * never as a verified causal fact.
 */
async function maybeWriteOutcomeMemory(options: {
  supabase: Client;
  businessId: string;
  view: MetricView;
}): Promise<boolean> {
  const { supabase, businessId, view } = options;
  if (view.observationCount < 2) return false;
  if (view.baselineValue == null || view.currentValue == null) return false;
  const percent = view.changeFromBaselinePercent;
  if (percent == null || Math.abs(percent) < 10) return false;
  if (view.trend === "insufficient_data" || view.trend === "stable") return false;

  const fmt = (value: number) =>
    `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}${view.unit ? ` ${view.unit}` : ""}`;

  const contextParts = [
    view.links.process ? `process "${view.links.process.name}"` : null,
    view.links.task ? `action "${view.links.task.title}"` : null,
  ].filter(Boolean);

  const content = [
    `${view.name} moved from a baseline of ${fmt(view.baselineValue)} to ${fmt(view.currentValue)} (${percent > 0 ? "+" : ""}${percent.toFixed(1)}%) across ${view.observationCount} recorded observations.`,
    contextParts.length
      ? `Observed after work on ${contextParts.join(" and ")}. This is an observed association over the same period, not established causation.`
      : "No intervention is linked to this metric, so the change is unexplained so far.",
  ].join(" ");

  const { writeMemory } = await import("./memory.server");
  const result = await writeMemory({
    supabase,
    memory: {
      businessId,
      memoryType: "metric_outcome",
      title: `${view.name} outcome`,
      content,
      sourceTable: "metric_definitions",
      sourceId: view.id,
      importance: Math.min(90, 45 + Math.abs(percent)),
      confidence: view.confidence === "high" ? 75 : view.confidence === "medium" ? 60 : 45,
      metadata: {
        source: "metric",
        metric_id: view.id,
        metric_key: view.metricKey,
        related_process_id: view.links.process?.id ?? null,
        related_task_id: view.links.task?.id ?? null,
        related_diagnosis_item_id: view.links.diagnosisItem?.id ?? null,
        baseline: view.baselineValue,
        current_value: view.currentValue,
        target: view.targetValue,
        change_percent: Number(percent.toFixed(2)),
        trend: view.trend,
        period: { from: view.baselineAt, to: view.currentRecordedAt },
        causal_evidence: false,
      },
    },
  });
  return result.ok;
}
