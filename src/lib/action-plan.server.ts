/**
 * Server-only Action Plan Engine.
 * Converts the Business Brain + latest diagnosis + active blueprint into a
 * sequenced 90-day plan persisted in `tasks`. Never imported by client code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { chatJsonResult } from "./ai.server";
import { AI_MODELS } from "./ai-usage.server";
import { formatMemoryDigest, recallMemory } from "./memory.server";
import { assertBusinessAccess, assessReadiness, loadBrain } from "./diagnosis.server";
import type { BrainReadiness } from "./diagnosis.server";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
type TaskPriority = Database["public"]["Enums"]["task_priority"];
type TaskStatus = Database["public"]["Enums"]["task_status"];

export const HORIZONS = ["now", "next", "later"] as const;
export type Horizon = (typeof HORIZONS)[number];

export const HORIZON_META: Record<Horizon, { label: string; range: string; note: string }> = {
  now: {
    label: "Now",
    range: "Days 1–30",
    note: "Constraint removal and quick structural wins.",
  },
  next: {
    label: "Next",
    range: "Days 31–60",
    note: "Systems, automation and offer changes.",
  },
  later: {
    label: "Later",
    range: "Days 61–90",
    note: "Growth moves that depend on the earlier work.",
  },
};

/* ------------------------------------------------------------------ AI schema */

const actionSchema = z.object({
  title: z.string().min(3).max(200),
  horizon: z.enum(HORIZONS),
  outcome: z.string().max(1000).default(""),
  why: z.string().max(1000).default(""),
  first_steps: z.array(z.string().max(300)).default([]),
  impact: z.number().min(1).max(10),
  effort: z.number().min(1).max(10),
  owner: z.string().max(120).default("Owner"),
  success_metric: z.string().max(300).default(""),
  evidence_fact_ids: z.array(z.string()).default([]),
  diagnosis_titles: z.array(z.string().max(200)).default([]),
});

const aiSchema = z.object({
  summary: z.string().min(1).max(3000),
  actions: z.array(actionSchema).min(3).max(18),
});

/* ------------------------------------------------------------------ views */

export type ActionFactRef = {
  factId: string;
  factKey: string;
  category: string;
  value: string;
  factType: string;
  verified: boolean;
};

export type ActionView = {
  id: string;
  title: string;
  horizon: Horizon;
  status: TaskStatus;
  priority: TaskPriority;
  approved: boolean;
  outcome: string;
  why: string;
  firstSteps: string[];
  impact: number | null;
  effort: number | null;
  score: number | null;
  owner: string;
  successMetric: string;
  dueAt: string | null;
  completedAt: string | null;
  planVersion: number | null;
  diagnosisTitles: string[];
  facts: ActionFactRef[];
  /** Process created from this action, when one exists. */
  process: { id: string; name: string; status: string; version: number } | null;
};

export type ActionPlanPayload = {
  status: "ready" | "empty" | "insufficient";
  readiness: BrainReadiness;
  hasDiagnosis: boolean;
  hasBlueprint: boolean;
  planVersion: number | null;
  summary: string | null;
  generatedAt: string | null;
  actions: ActionView[];
};

/* ------------------------------------------------------------------ helpers */

type FactRow = Awaited<ReturnType<typeof loadBrain>>["facts"][number];

function factValue(fact: FactRow) {
  if (fact.value_text) return fact.value_text;
  if (fact.value_number != null) return String(fact.value_number);
  return "—";
}

function toRef(fact: FactRow): ActionFactRef {
  return {
    factId: fact.id,
    factKey: fact.fact_key,
    category: fact.category,
    value: factValue(fact),
    factType: fact.fact_type,
    verified: fact.verified,
  };
}

/** Deterministic sequencing: impact dominates, effort penalised, earlier horizons first. */
function scoreAction(impact: number, effort: number, horizon: Horizon) {
  const horizonBoost = horizon === "now" ? 1 : horizon === "next" ? 0.6 : 0.3;
  const raw = impact * 0.62 - effort * 0.18 + horizonBoost * 1.2;
  return Math.round(Math.max(0, Math.min(100, (raw / 7.4) * 100)));
}

function priorityFor(score: number, horizon: Horizon): TaskPriority {
  if (horizon === "now" && score >= 78) return "urgent";
  if (score >= 66) return "high";
  if (score >= 42) return "medium";
  return "low";
}

function dueDateFor(horizon: Horizon) {
  const days = horizon === "now" ? 30 : horizon === "next" ? 60 : 90;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toView(row: Database["public"]["Tables"]["tasks"]["Row"]): ActionView {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const horizonRaw = str(meta["horizon"], "now");
  const horizon = (HORIZONS as readonly string[]).includes(horizonRaw)
    ? (horizonRaw as Horizon)
    : "now";
  return {
    id: row.id,
    title: row.title,
    horizon,
    status: row.status,
    priority: row.priority,
    approved: meta["approved"] === true,
    outcome: str(meta["outcome"]),
    why: str(meta["why"]) || (row.description ?? ""),
    firstSteps: strList(meta["first_steps"]),
    impact: num(meta["impact"]),
    effort: num(meta["effort"]),
    score: num(meta["score"]),
    owner: str(meta["owner"], "Owner"),
    successMetric: str(meta["success_metric"]),
    dueAt: row.due_at,
    completedAt: row.completed_at,
    planVersion: num(meta["plan_version"]),
    diagnosisTitles: strList(meta["diagnosis_titles"]),
    facts: Array.isArray(meta["facts"]) ? (meta["facts"] as ActionFactRef[]) : [],
    process: null,
  };
}

const SYSTEM_PROMPT = [
  "You are the Business OS Execution Intelligence. You turn a diagnosis and blueprint into a sequenced 90-day action plan.",
  "Only use the supplied Brain facts, diagnosis findings and blueprint. Never invent numbers, channels, tools or people that were not supplied.",
  "Each action must be a concrete piece of work the owner can start, not advice. Titles read like work orders ('Rewrite the pricing page around outcome tiers').",
  "Each action MUST reference the ids of the Brain facts that justify it in evidence_fact_ids, copied verbatim from the supplied ids.",
  "Sequence honestly: 'now' removes the binding constraint, 'next' builds systems, 'later' depends on earlier work being done.",
  "impact and effort are 1-10 integers. success_metric names the number that should move.",
  "Between 6 and 12 actions total. Return ONLY JSON in the requested shape.",
].join("\n");

const SHAPE = `{
  "summary": string,
  "actions": [{
    "title": string, "horizon": "now"|"next"|"later", "outcome": string, "why": string,
    "first_steps": string[], "impact": number, "effort": number, "owner": string,
    "success_metric": string, "evidence_fact_ids": string[], "diagnosis_titles": string[]
  }]
}`;

/* ------------------------------------------------------------------ generate */

export async function generateActionPlan(options: {
  supabase: Client;
  businessId: string;
  userId: string;
  organizationId?: string | null;
  jobId?: string | null;
}): Promise<ActionPlanPayload> {
  const { supabase, businessId } = options;
  const business = await assertBusinessAccess(supabase, businessId);
  const { facts } = await loadBrain(supabase, businessId);
  const readiness = assessReadiness(facts);

  if (!readiness.ready) {
    return loadActionPlan(supabase, businessId, readiness);
  }

  const { data: runRow } = await supabase
    .from("diagnosis_runs")
    .select("id, overall_score, summary")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let diagnosisDigest = "No diagnosis run exists yet.";
  if (runRow) {
    const { data: itemRows } = await supabase
      .from("diagnosis_items")
      .select("category, title, description, recommendation, priority_score, priority_level")
      .eq("diagnosis_run_id", runRow.id)
      .order("priority_score", { ascending: false, nullsFirst: false })
      .limit(30);
    diagnosisDigest = [
      `Overall health score: ${runRow.overall_score ?? "unknown"}`,
      runRow.summary ? `Summary: ${runRow.summary}` : "",
      ...(itemRows ?? []).map(
        (item) =>
          `- [${item.priority_level ?? "medium"}] (${item.category}) ${item.title}: ${item.description ?? ""}${item.recommendation ? ` | direction: ${item.recommendation}` : ""}`,
      ),
    ]
      .filter(Boolean)
      .join("\n");
  }

  const { data: blueprintRow } = await supabase
    .from("business_blueprints")
    .select(
      "id, version, executive_summary, positioning, ideal_customer, core_problem, transformation, differentiation, methodology, pricing_strategy, acquisition_strategy, retention_strategy, operating_model, owner_role",
    )
    .eq("business_id", businessId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const blueprintDigest = blueprintRow
    ? [
        `Blueprint v${blueprintRow.version}`,
        blueprintRow.executive_summary ? `Summary: ${blueprintRow.executive_summary}` : "",
        `Positioning: ${blueprintRow.positioning ?? "unknown"}`,
        `Ideal customer: ${blueprintRow.ideal_customer ?? "unknown"}`,
        `Core problem: ${blueprintRow.core_problem ?? "unknown"}`,
        `Offer & methodology: ${blueprintRow.methodology ?? "unknown"}`,
        `Pricing: ${blueprintRow.pricing_strategy ?? "unknown"}`,
        `Acquisition: ${blueprintRow.acquisition_strategy ?? "unknown"}`,
        `Retention: ${blueprintRow.retention_strategy ?? "unknown"}`,
        `Operating model: ${blueprintRow.operating_model ?? "unknown"}`,
        `Owner role: ${blueprintRow.owner_role ?? "unknown"}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "No blueprint exists yet.";

  const accounting =
    options.organizationId != null
      ? {
          supabase,
          context: {
            organizationId: options.organizationId,
            businessId,
            jobId: options.jobId ?? null,
            operation: "action_plan_run",
          },
        }
      : undefined;

  const memories = await recallMemory({
    supabase,
    businessId,
    query: "action plan run — constraints, revenue, customers, offers, operations, goals",
    matchCount: 12,
    threshold: 0.5,
    ...(accounting ? { accounting } : {}),
  });
  const memoryDigest = formatMemoryDigest(memories);

  const aiResult = await chatJsonResult<unknown>({
    model: AI_MODELS.planning,
    ...(accounting ? { accounting } : {}),
    maxTokens: 9000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          memoryDigest
            ? `LONG-TERM MEMORY OF THIS BUSINESS:\n${memoryDigest}\n`
            : "",
          `BUSINESS: ${business.name}`,
          `Industry: ${business.industry ?? "unknown"} | Model: ${business.business_model ?? "unknown"} | Customers: ${business.customer_model ?? "unknown"} | Team size: ${business.employee_count ?? "unknown"}`,
          "",
          `BRAIN COVERAGE: ${readiness.coverage}% (${readiness.factCount} facts, ${readiness.verifiedCount} verified)`,
          readiness.missingMetrics.length > 0
            ? `NUMBERS STILL UNKNOWN: ${readiness.missingMetrics.join(", ")}`
            : "",
          "",
          "BUSINESS BRAIN FACTS:",
          facts
            .map(
              (f) =>
                `- id=${f.id} [${f.verified ? "VERIFIED" : f.fact_type.toUpperCase()}] (${f.category}) ${f.fact_key}: ${factValue(f)}`,
            )
            .join("\n"),
          "",
          "LATEST DIAGNOSIS:",
          diagnosisDigest,
          "",
          "ACTIVE BLUEPRINT:",
          blueprintDigest,
          "",
          "Produce the 90-day action plan as JSON in exactly this shape:",
          SHAPE,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  if (!aiResult.ok) throw new Error(aiResult.reason);

  const parsed = aiSchema.safeParse(aiResult.data);
  if (!parsed.success) {
    console.error("[action-plan] schema mismatch", parsed.error.issues.slice(0, 6));
    throw new Error("The action plan came back in an unexpected shape. Please try again.");
  }
  const output = parsed.data;

  const factById = new Map(facts.map((f) => [f.id, f]));
  const resolve = (ids: string[]) =>
    ids.map((id) => factById.get(id)).filter((f): f is FactRow => f !== undefined);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  /* Determine the next plan version from previously generated actions. */
  const { data: priorRows } = await supabaseAdmin
    .from("tasks")
    .select("id, metadata, status")
    .eq("business_id", businessId);

  const priorPlanVersions = (priorRows ?? [])
    .map((row) => num(((row.metadata ?? {}) as Record<string, unknown>)["plan_version"]))
    .filter((v): v is number => v !== null);
  const planVersion = (priorPlanVersions.length > 0 ? Math.max(...priorPlanVersions) : 0) + 1;

  /* Retire untouched actions from earlier plans; keep anything in progress or done. */
  const staleIds = (priorRows ?? [])
    .filter((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      return num(meta["plan_version"]) !== null && row.status === "todo";
    })
    .map((row) => row.id);
  if (staleIds.length > 0) {
    await supabaseAdmin.from("tasks").update({ status: "cancelled" }).in("id", staleIds);
  }

  const generatedAt = new Date().toISOString();

  const rows = output.actions.map((action) => {
    const score = scoreAction(action.impact, action.effort, action.horizon);
    const refs = resolve(action.evidence_fact_ids);
    return {
      business_id: businessId,
      title: action.title,
      description: action.why || action.outcome || null,
      status: "todo" as TaskStatus,
      priority: priorityFor(score, action.horizon),
      due_at: dueDateFor(action.horizon),
      metadata: {
        source: "action_plan",
        plan_version: planVersion,
        generated_at: generatedAt,
        plan_summary: output.summary,
        diagnosis_run_id: runRow?.id ?? null,
        blueprint_id: blueprintRow?.id ?? null,
        horizon: action.horizon,
        outcome: action.outcome,
        why: action.why,
        first_steps: action.first_steps,
        impact: action.impact,
        effort: action.effort,
        score,
        owner: action.owner,
        success_metric: action.success_metric,
        approved: false,
        diagnosis_titles: action.diagnosis_titles,
        facts: refs.map(toRef),
      } as unknown as Database["public"]["Tables"]["tasks"]["Row"]["metadata"],
    };
  });

  const { error: insertError } = await supabaseAdmin.from("tasks").insert(rows);
  if (insertError) throw insertError;

  await supabaseAdmin.rpc("write_audit_log", {
    target_business: businessId,
    action_name: "action_plan.generate",
    target_table: "tasks",
    target_record: businessId,
    old_value: null,
    new_value: { plan_version: planVersion, action_count: rows.length },
    actor: "ai",
  });

  return loadActionPlan(supabase, businessId, readiness);
}

/* ------------------------------------------------------------------ read */

export async function loadActionPlan(
  supabase: Client,
  businessId: string,
  readiness: BrainReadiness,
): Promise<ActionPlanPayload> {
  const [{ data: taskRows, error }, { data: runRow }, { data: blueprintRow }, { data: processRows }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("diagnosis_runs").select("id").eq("business_id", businessId).limit(1).maybeSingle(),
      supabase
        .from("business_blueprints")
        .select("id")
        .eq("business_id", businessId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("processes")
        .select("id, name, status, version, created_from_action_id")
        .eq("business_id", businessId)
        .not("created_from_action_id", "is", null)
        .order("version", { ascending: false }),
    ]);
  if (error) throw error;

  /* Newest live version per source action; archived versions never win. */
  const processByAction = new Map<string, { id: string; name: string; status: string; version: number }>();
  for (const row of processRows ?? []) {
    const key = row.created_from_action_id;
    if (!key) continue;
    const existing = processByAction.get(key);
    if (existing && (existing.status !== "archived" || row.status === "archived")) continue;
    processByAction.set(key, {
      id: row.id,
      name: row.name,
      status: row.status,
      version: row.version,
    });
  }

  const planTasks = (taskRows ?? []).filter(
    (row) => ((row.metadata ?? {}) as Record<string, unknown>)["source"] === "action_plan",
  );

  const actions = planTasks
    .map(toView)
    .map((view) => ({ ...view, process: processByAction.get(view.id) ?? null }))
    .sort((a, b) => HORIZONS.indexOf(a.horizon) - HORIZONS.indexOf(b.horizon) || (b.score ?? 0) - (a.score ?? 0));

  const latest = planTasks
    .map((row) => (row.metadata ?? {}) as Record<string, unknown>)
    .sort((a, b) => (num(b["plan_version"]) ?? 0) - (num(a["plan_version"]) ?? 0))[0];

  return {
    status: actions.length > 0 ? "ready" : readiness.ready ? "empty" : "insufficient",
    readiness,
    hasDiagnosis: Boolean(runRow),
    hasBlueprint: Boolean(blueprintRow),
    planVersion: latest ? num(latest["plan_version"]) : null,
    summary: latest ? str(latest["plan_summary"]) || null : null,
    generatedAt: latest ? str(latest["generated_at"]) || null : null,
    actions,
  };
}

/* ------------------------------------------------------------------ mutate */

export async function setActionState(options: {
  supabase: Client;
  businessId: string;
  taskId: string;
  status?: TaskStatus;
  approved?: boolean;
}): Promise<ActionView> {
  const { supabase, businessId, taskId } = options;
  await assertBusinessAccess(supabase, businessId);

  const { data: existing, error: readError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("business_id", businessId)
    .single();
  if (readError) throw readError;

  const meta = { ...((existing.metadata ?? {}) as Record<string, unknown>) };
  if (options.approved !== undefined) meta["approved"] = options.approved;

  const status = options.status ?? existing.status;

  const { data: updated, error: updateError } = await supabase
    .from("tasks")
    .update({
      status,
      completed_at:
        status === "completed" ? (existing.completed_at ?? new Date().toISOString()) : null,
      metadata: meta as unknown as Database["public"]["Tables"]["tasks"]["Row"]["metadata"],
    })
    .eq("id", taskId)
    .select("*")
    .single();
  if (updateError) throw updateError;

  return toView(updated);
}
