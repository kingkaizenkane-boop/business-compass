/**
 * Server-only Operations / Process Engine.
 *
 * A Process is an operational system for repeatedly producing a business
 * outcome — not a task. Processes are generated from the Business Brain, the
 * latest Diagnosis, the active Blueprint and the 90-day Action Plan, and every
 * generated process is bound to the evidence that justified it.
 *
 * This module never runs in the client bundle.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { chatJsonResult } from "./ai.server";
import { AI_MODELS } from "./ai-usage.server";
import { writeAudit } from "./audit.server";
import { assertBusinessAccess, assessReadiness, loadBrain } from "./diagnosis.server";
import { formatMemoryDigest, recallMemory } from "./memory.server";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
type ProcessRow = Database["public"]["Tables"]["processes"]["Row"];
type StepRow = Database["public"]["Tables"]["process_steps"]["Row"];
type ExecutionRow = Database["public"]["Tables"]["process_executions"]["Row"];
type ApprovalRow = Database["public"]["Tables"]["process_approvals"]["Row"];

export type StepType = Database["public"]["Enums"]["process_step_type"];
export type OwnerType = Database["public"]["Enums"]["process_owner_type"];
export type TriggerType = Database["public"]["Enums"]["process_trigger_type"];
export type ExecutionStatus = Database["public"]["Enums"]["process_execution_status"];
export type ProcessStatus = Database["public"]["Enums"]["process_status"];

export const STEP_TYPES = [
  "action",
  "decision",
  "wait",
  "approval",
  "notification",
  "data_capture",
  "ai_generation",
  "integration",
  "end",
] as const satisfies readonly StepType[];

export const OWNER_TYPES = ["human", "ai", "hybrid", "system"] as const satisfies readonly OwnerType[];

export const TRIGGER_TYPES = [
  "manual",
  "scheduled",
  "event",
  "inbound_lead",
  "customer_action",
  "metric_threshold",
  "ai_recommendation",
] as const satisfies readonly TriggerType[];

/** Step types that reach outside the business. Never autonomous in this sprint. */
const EXTERNAL_EFFECT_STEPS: StepType[] = ["integration", "notification"];

/** Generated processes start conservative regardless of what the AI recommends. */
const DEFAULT_PROCESS_AUTONOMY = 1;
const MAX_GENERATED_AUTONOMY = 2;

/* ------------------------------------------------------------------ views */

export type StepView = {
  id: string;
  position: number;
  name: string;
  description: string | null;
  stepType: StepType;
  ownerType: OwnerType;
  ownerId: string | null;
  responsibleRole: string | null;
  autonomyLevel: number;
  inputDefinition: JsonRecord;
  outputDefinition: JsonRecord;
  conditionDefinition: JsonRecord;
  estimatedMinutes: number | null;
  required: boolean;
};

export type ProcessEvidence = {
  diagnosisRunId: string | null;
  diagnosisTitles: string[];
  blueprintVersion: number | null;
  blueprintSections: string[];
  actionId: string | null;
  actionTitle: string | null;
  facts: {
    factId: string;
    factKey: string;
    category: string;
    value: string;
    verified: boolean;
  }[];
  rationale: string;
};

export type ProcessView = {
  id: string;
  businessId: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  purpose: string | null;
  category: string | null;
  triggerType: TriggerType;
  triggerDefinition: JsonRecord;
  status: ProcessStatus;
  ownerType: OwnerType;
  ownerId: string | null;
  autonomyLevel: number;
  successDefinition: string | null;
  createdFromActionId: string | null;
  createdFromDiagnosisId: string | null;
  createdFromBlueprintVersion: number | null;
  version: number;
  supersedesProcessId: string | null;
  createdAt: string;
  updatedAt: string;
  evidence: ProcessEvidence;
  steps: StepView[];
  stats: { runs: number; completed: number; failed: number; successRate: number | null; lastRunAt: string | null };
};

export type ExecutionView = {
  id: string;
  processId: string;
  processName: string;
  processVersion: number;
  status: ExecutionStatus;
  triggerSource: string;
  currentStepSequence: number | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  success: boolean | null;
  error: string | null;
  output: JsonRecord;
  metricValues: JsonRecord;
  stepLog: { sequence: number; name: string; stepType: string; outcome: string; note?: string; at: string }[];
  createdAt: string;
};

export type ApprovalView = {
  id: string;
  processId: string;
  processName: string;
  executionId: string;
  stepSequence: number | null;
  status: Database["public"]["Enums"]["process_approval_status"];
  title: string;
  whatWillHappen: string | null;
  whyRecommended: string | null;
  dataUsed: JsonRecord;
  externalEffect: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

/* ------------------------------------------------------------------ helpers */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = { [key: string]: JsonValue };

function obj(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toStepView(row: StepRow): StepView {
  return {
    id: row.id,
    position: row.sequence,
    name: row.name,
    description: row.description,
    stepType: row.step_type,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    responsibleRole: row.responsible_role,
    autonomyLevel: row.autonomy_level,
    inputDefinition: obj(row.input_definition),
    outputDefinition: obj(row.output_definition),
    conditionDefinition: obj(row.condition_definition),
    estimatedMinutes: row.estimated_minutes,
    required: row.required,
  };
}

function toExecutionView(row: ExecutionRow, processName: string): ExecutionView {
  const log = Array.isArray(row.step_log) ? (row.step_log as ExecutionView["stepLog"]) : [];
  return {
    id: row.id,
    processId: row.process_id,
    processName,
    processVersion: row.process_version,
    status: row.status,
    triggerSource: row.trigger_source,
    currentStepSequence: row.current_step_sequence,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    success: row.success,
    error: row.error,
    output: obj(row.output),
    metricValues: obj(row.metric_values),
    stepLog: log,
    createdAt: row.created_at,
  };
}

function toApprovalView(row: ApprovalRow, processName: string): ApprovalView {
  return {
    id: row.id,
    processId: row.process_id,
    processName,
    executionId: row.execution_id,
    stepSequence: row.step_sequence,
    status: row.status,
    title: row.title,
    whatWillHappen: row.what_will_happen,
    whyRecommended: row.why_recommended,
    dataUsed: obj(row.data_used),
    externalEffect: row.external_effect,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
  };
}

function toProcessView(
  row: ProcessRow,
  steps: StepRow[],
  stats: ProcessView["stats"],
): ProcessView {
  const meta = obj(row.metadata);
  const evidenceMeta = obj(meta["evidence"]);
  return {
    id: row.id,
    businessId: row.business_id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    purpose: row.purpose,
    category: row.process_category,
    triggerType: row.trigger_type,
    triggerDefinition: obj(row.trigger_definition),
    status: row.status,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    autonomyLevel: row.autonomy_level,
    successDefinition: row.success_definition,
    createdFromActionId: row.created_from_action_id,
    createdFromDiagnosisId: row.created_from_diagnosis_id,
    createdFromBlueprintVersion: row.created_from_blueprint_version,
    version: row.version,
    supersedesProcessId: row.supersedes_process_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    evidence: {
      diagnosisRunId: row.created_from_diagnosis_id,
      diagnosisTitles: strList(evidenceMeta["diagnosis_titles"]),
      blueprintVersion: row.created_from_blueprint_version,
      blueprintSections: strList(evidenceMeta["blueprint_sections"]),
      actionId: row.created_from_action_id,
      actionTitle: typeof evidenceMeta["action_title"] === "string" ? (evidenceMeta["action_title"] as string) : null,
      facts: Array.isArray(evidenceMeta["facts"]) ? (evidenceMeta["facts"] as ProcessEvidence["facts"]) : [],
      rationale: typeof evidenceMeta["rationale"] === "string" ? (evidenceMeta["rationale"] as string) : "",
    },
    steps: steps.map(toStepView).sort((a, b) => a.position - b.position),
    stats,
  };
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Client;
}

/** Tenant guard for every process-scoped mutation. Never trust a client id. */
async function assertProcessAccess(supabase: Client, businessId: string, processId: string) {
  await assertBusinessAccess(supabase, businessId);
  const { data, error } = await supabase
    .from("processes")
    .select("*")
    .eq("id", processId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That process does not exist in this business.");
  return data;
}

/* ------------------------------------------------------------------ reads */

async function statsFor(supabase: Client, processIds: string[]) {
  const map = new Map<string, ProcessView["stats"]>();
  for (const id of processIds) map.set(id, { runs: 0, completed: 0, failed: 0, successRate: null, lastRunAt: null });
  if (processIds.length === 0) return map;
  const { data } = await supabase
    .from("process_executions")
    .select("process_id, completed, failed, success, created_at")
    .in("process_id", processIds);
  for (const row of data ?? []) {
    const entry = map.get(row.process_id);
    if (!entry) continue;
    entry.runs += 1;
    if (row.completed) entry.completed += 1;
    if (row.failed) entry.failed += 1;
    if (!entry.lastRunAt || row.created_at > entry.lastRunAt) entry.lastRunAt = row.created_at;
  }
  for (const entry of map.values()) {
    const finished = entry.completed + entry.failed;
    entry.successRate = finished > 0 ? Math.round((entry.completed / finished) * 100) : null;
  }
  return map;
}

export type OperationsOverview = {
  processes: ProcessView[];
  executions: ExecutionView[];
  approvals: ApprovalView[];
  counts: { active: number; draft: number; paused: number; approvals: number };
  hasActionPlan: boolean;
  readiness: { ready: boolean; coverage: number };
};

export async function loadOperations(supabase: Client, businessId: string): Promise<OperationsOverview> {
  await assertBusinessAccess(supabase, businessId);

  const [{ data: processRows, error }, { facts }, { data: planRows }] = await Promise.all([
    supabase
      .from("processes")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    loadBrain(supabase, businessId),
    supabase.from("tasks").select("id").eq("business_id", businessId).limit(1),
  ]);
  if (error) throw error;

  const processes = processRows ?? [];
  const ids = processes.map((p) => p.id);

  const [{ data: stepRows }, { data: executionRows }, { data: approvalRows }, stats] = await Promise.all([
    ids.length ? supabase.from("process_steps").select("*").in("process_id", ids) : Promise.resolve({ data: [] as StepRow[] }),
    supabase
      .from("process_executions")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("process_approvals")
      .select("*")
      .eq("business_id", businessId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
    statsFor(supabase, ids),
  ]);

  const nameById = new Map(processes.map((p) => [p.id, p.name]));
  const stepsByProcess = new Map<string, StepRow[]>();
  for (const step of (stepRows ?? []) as StepRow[]) {
    const list = stepsByProcess.get(step.process_id) ?? [];
    list.push(step);
    stepsByProcess.set(step.process_id, list);
  }

  const views = processes.map((p) =>
    toProcessView(p, stepsByProcess.get(p.id) ?? [], stats.get(p.id)!),
  );
  const readiness = assessReadiness(facts);

  return {
    processes: views,
    executions: (executionRows ?? []).map((row) => toExecutionView(row, nameById.get(row.process_id) ?? "Process")),
    approvals: (approvalRows ?? []).map((row) => toApprovalView(row, nameById.get(row.process_id) ?? "Process")),
    counts: {
      active: views.filter((p) => p.status === "active").length,
      draft: views.filter((p) => p.status === "draft").length,
      paused: views.filter((p) => p.status === "archived").length,
      approvals: (approvalRows ?? []).length,
    },
    hasActionPlan: (planRows ?? []).length > 0,
    readiness: { ready: readiness.ready, coverage: readiness.coverage },
  };
}

export type ProcessDetail = {
  process: ProcessView;
  executions: ExecutionView[];
  approvals: ApprovalView[];
  versions: { id: string; version: number; status: ProcessStatus; createdAt: string }[];
};

export async function loadProcess(
  supabase: Client,
  businessId: string,
  processId: string,
): Promise<ProcessDetail> {
  const row = await assertProcessAccess(supabase, businessId, processId);

  const [{ data: stepRows }, { data: executionRows }, { data: approvalRows }, stats] = await Promise.all([
    supabase.from("process_steps").select("*").eq("process_id", processId),
    supabase
      .from("process_executions")
      .select("*")
      .eq("process_id", processId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("process_approvals")
      .select("*")
      .eq("process_id", processId)
      .order("created_at", { ascending: false })
      .limit(25),
    statsFor(supabase, [processId]),
  ]);

  const process = toProcessView(row, (stepRows ?? []) as StepRow[], stats.get(processId)!);

  // Version history: walk the supersede chain in both directions.
  const lineageRoot = row.metadata && obj(row.metadata)["lineage_id"];
  const { data: lineage } = await supabase
    .from("processes")
    .select("id, version, status, created_at, metadata")
    .eq("business_id", businessId)
    .order("version", { ascending: false });

  const rootId = typeof lineageRoot === "string" ? lineageRoot : row.id;
  const versions = (lineage ?? [])
    .filter((p) => p.id === rootId || obj(p.metadata)["lineage_id"] === rootId)
    .map((p) => ({ id: p.id, version: p.version, status: p.status, createdAt: p.created_at }));

  return {
    process,
    executions: (executionRows ?? []).map((e) => toExecutionView(e, row.name)),
    approvals: (approvalRows ?? []).map((a) => toApprovalView(a, row.name)),
    versions: versions.length > 0 ? versions : [{ id: row.id, version: row.version, status: row.status, createdAt: row.created_at }],
  };
}

/* ------------------------------------------------------------------ AI schema */

const aiStepSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().max(800).default(""),
  step_type: z.enum(STEP_TYPES),
  owner_type: z.enum(OWNER_TYPES).default("human"),
  autonomy_level: z.number().int().min(0).max(4).default(1),
  input: z.string().max(400).default(""),
  output: z.string().max(400).default(""),
  condition: z.string().max(400).default(""),
  estimated_minutes: z.number().int().min(0).max(10080).nullable().default(null),
  required: z.boolean().default(true),
});

const aiProcessSchema = z.object({
  name: z.string().min(3).max(160),
  purpose: z.string().min(10).max(1000),
  description: z.string().max(1500).default(""),
  category: z.string().max(80).default("operations"),
  trigger_type: z.enum(TRIGGER_TYPES),
  trigger_description: z.string().max(500).default(""),
  owner_type: z.enum(OWNER_TYPES).default("human"),
  recommended_autonomy: z.number().int().min(0).max(4).default(1),
  success_definition: z.string().min(5).max(600),
  rationale: z.string().min(10).max(1500),
  source_action_titles: z.array(z.string().max(300)).default([]),
  diagnosis_titles: z.array(z.string().max(300)).default([]),
  blueprint_sections: z.array(z.string().max(120)).default([]),
  evidence_fact_ids: z.array(z.string()).default([]),
  steps: z.array(aiStepSchema).min(3).max(14),
});

const aiSchema = z.object({
  summary: z.string().max(2000).default(""),
  processes: z.array(aiProcessSchema).max(6).default([]),
});

const SYSTEM_PROMPT = [
  "You are the Business OS Operations Intelligence. You convert a business's diagnosis, blueprint and 90-day action plan into repeatable operational processes.",
  "A PROCESS is a system that repeatedly produces a business outcome (e.g. 'New customer intake', 'Quote follow-up', 'Weekly revenue review').",
  "A one-time project ('Redesign the homepage', 'Register the company') is NOT a process. Never turn one-time work into a process.",
  "Only propose processes that this specific business genuinely needs based on the supplied evidence. Between 1 and 4 processes. Fewer, better processes beat many generic ones.",
  "Never duplicate an existing process supplied to you. If an existing process already covers the outcome, omit it.",
  "Every process MUST cite the Brain fact ids that justify it in evidence_fact_ids, copied verbatim from the supplied ids, plus the diagnosis titles and blueprint sections it serves.",
  "Steps must be concrete, ordered, and end with an 'end' step. Use 'approval' before anything that leaves the business, 'data_capture' for information collection, 'decision' for branching, 'wait' for elapsed time, 'ai_generation' for drafting.",
  "Processes must handle the non-linear path: include decision steps for 'no response' and 'customer replied' style branches where relevant.",
  "Keep autonomy conservative. Never recommend autonomy above 2.",
  "Return ONLY JSON in the requested shape.",
].join("\n");

const SHAPE = `{
  "summary": string,
  "processes": [{
    "name": string, "purpose": string, "description": string, "category": string,
    "trigger_type": "manual"|"scheduled"|"event"|"inbound_lead"|"customer_action"|"metric_threshold"|"ai_recommendation",
    "trigger_description": string, "owner_type": "human"|"ai"|"hybrid"|"system",
    "recommended_autonomy": number, "success_definition": string, "rationale": string,
    "source_action_titles": string[], "diagnosis_titles": string[], "blueprint_sections": string[],
    "evidence_fact_ids": string[],
    "steps": [{
      "name": string, "description": string,
      "step_type": "action"|"decision"|"wait"|"approval"|"notification"|"data_capture"|"ai_generation"|"integration"|"end",
      "owner_type": "human"|"ai"|"hybrid"|"system", "autonomy_level": number,
      "input": string, "output": string, "condition": string,
      "estimated_minutes": number|null, "required": boolean
    }]
  }]
}`;

/* ------------------------------------------------------------------ validation */

export type ValidationIssue = { process: string; reason: string };

type ValidatedProcess = z.infer<typeof aiProcessSchema>;

/**
 * Deterministic gate over the model output. Anything that fails is rejected —
 * an invalid process definition is never persisted, and references may never
 * point outside this business.
 */
function validateProcesses(
  candidates: ValidatedProcess[],
  allowedFactIds: Set<string>,
  allowedDiagnosisTitles: Set<string>,
  existingNames: Set<string>,
): { accepted: ValidatedProcess[]; rejected: ValidationIssue[] } {
  const accepted: ValidatedProcess[] = [];
  const rejected: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const key = candidate.name.trim().toLowerCase();
    const fail = (reason: string) => rejected.push({ process: candidate.name, reason });

    if (key.length < 3) {
      fail("The process name is too short to be meaningful.");
      continue;
    }
    if (seen.has(key) || existingNames.has(key)) {
      fail("A process with this name already exists for this business.");
      continue;
    }
    if (candidate.purpose.trim().length < 10) {
      fail("The purpose does not describe a repeatable business outcome.");
      continue;
    }
    if (candidate.success_definition.trim().length < 5) {
      fail("No success definition was provided.");
      continue;
    }
    if (candidate.steps.length < 3) {
      fail("A process needs at least three ordered steps.");
      continue;
    }
    if (!candidate.steps.some((s) => s.step_type === "end")) {
      fail("The process has no terminating step.");
      continue;
    }
    if (candidate.steps.some((s) => s.name.trim().length < 2)) {
      fail("One or more steps have no name.");
      continue;
    }
    // Every referenced fact must belong to this business's Brain.
    const facts = candidate.evidence_fact_ids.filter((id) => allowedFactIds.has(id));
    if (candidate.evidence_fact_ids.length > 0 && facts.length === 0) {
      fail("Every evidence reference pointed outside this business's Brain.");
      continue;
    }
    if (facts.length === 0) {
      fail("The process cites no Business Brain evidence.");
      continue;
    }
    candidate.evidence_fact_ids = facts;
    candidate.diagnosis_titles = candidate.diagnosis_titles.filter((t) => allowedDiagnosisTitles.has(t));
    // Autonomy is clamped by the system, never by the model.
    candidate.recommended_autonomy = Math.min(
      Math.max(candidate.recommended_autonomy, 0),
      MAX_GENERATED_AUTONOMY,
    );
    for (const step of candidate.steps) {
      step.autonomy_level = Math.min(Math.max(step.autonomy_level, 0), MAX_GENERATED_AUTONOMY);
      if (EXTERNAL_EFFECT_STEPS.includes(step.step_type)) step.autonomy_level = Math.min(step.autonomy_level, 1);
    }

    seen.add(key);
    accepted.push(candidate);
  }

  return { accepted, rejected };
}

/* ------------------------------------------------------------------ generation */

export type GenerationResult = {
  status: "ready" | "insufficient" | "none";
  created: { id: string; name: string }[];
  rejected: ValidationIssue[];
  summary: string;
};

export async function generateProcesses(options: {
  supabase: Client;
  businessId: string;
  userId: string;
  organizationId?: string | null;
  jobId?: string | null;
}): Promise<GenerationResult> {
  const { supabase, businessId } = options;
  const business = await assertBusinessAccess(supabase, businessId);
  const { data: orgRow } = await supabase
    .from("businesses")
    .select("organization_id")
    .eq("id", businessId)
    .single();
  const businessOrgId = orgRow?.organization_id ?? null;
  const { facts } = await loadBrain(supabase, businessId);
  const readiness = assessReadiness(facts);
  if (!readiness.ready) {
    return { status: "insufficient", created: [], rejected: [], summary: "" };
  }

  const [{ data: runRow }, { data: blueprintRow }, { data: taskRows }, { data: existingRows }] =
    await Promise.all([
      supabase
        .from("diagnosis_runs")
        .select("id, summary, overall_score")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("business_blueprints")
        .select("id, version, executive_summary, operating_model, acquisition_strategy, retention_strategy, owner_role, methodology")
        .eq("business_id", businessId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("id, title, description, status, metadata")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .limit(40),
      supabase.from("processes").select("id, name, purpose, status").eq("business_id", businessId),
    ]);

  let diagnosisDigest = "No diagnosis run exists yet.";
  const diagnosisTitles = new Set<string>();
  if (runRow) {
    const { data: items } = await supabase
      .from("diagnosis_items")
      .select("category, title, description, recommendation, priority_level")
      .eq("diagnosis_run_id", runRow.id)
      .order("priority_score", { ascending: false, nullsFirst: false })
      .limit(20);
    for (const item of items ?? []) diagnosisTitles.add(item.title);
    diagnosisDigest = [
      runRow.summary ? `Summary: ${runRow.summary}` : "",
      ...(items ?? []).map(
        (i) => `- [${i.priority_level ?? "medium"}] (${i.category}) ${i.title}: ${i.description ?? ""}${i.recommendation ? ` | direction: ${i.recommendation}` : ""}`,
      ),
    ]
      .filter(Boolean)
      .join("\n");
  }

  const blueprintDigest = blueprintRow
    ? [
        `Blueprint v${blueprintRow.version}`,
        blueprintRow.executive_summary ? `Summary: ${blueprintRow.executive_summary}` : "",
        `Operating model: ${blueprintRow.operating_model ?? "unknown"}`,
        `Acquisition: ${blueprintRow.acquisition_strategy ?? "unknown"}`,
        `Retention: ${blueprintRow.retention_strategy ?? "unknown"}`,
        `Owner role: ${blueprintRow.owner_role ?? "unknown"}`,
        `Methodology: ${blueprintRow.methodology ?? "unknown"}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "No blueprint exists yet.";

  const planTasks = (taskRows ?? []).filter((t) => obj(t.metadata)["source"] === "action_plan");
  const planDigest =
    planTasks.length > 0
      ? planTasks
          .map((t) => {
            const meta = obj(t.metadata);
            return `- ${t.title} (${String(meta["horizon"] ?? "now")}) — ${String(meta["outcome"] ?? t.description ?? "")}`;
          })
          .join("\n")
      : "No action plan exists yet.";

  const existingDigest =
    (existingRows ?? []).length > 0
      ? (existingRows ?? []).map((p) => `- ${p.name} [${p.status}]: ${p.purpose ?? ""}`).join("\n")
      : "No processes exist yet.";

  const accounting =
    options.organizationId != null
      ? {
          supabase,
          context: {
            organizationId: options.organizationId,
            businessId,
            jobId: options.jobId ?? null,
            operation: "process_generation",
          },
        }
      : undefined;

  const memories = await recallMemory({
    supabase,
    businessId,
    query: "repeatable operations — intake, delivery, follow-up, onboarding, reporting, owner dependency",
    matchCount: 10,
    threshold: 0.5,
    ...(accounting ? { accounting } : {}),
  });
  const memoryDigest = formatMemoryDigest(memories);

  const aiResult = await chatJsonResult<unknown>({
    model: AI_MODELS.planning,
    ...(accounting ? { accounting } : {}),
    maxTokens: 10000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          memoryDigest ? `LONG-TERM MEMORY OF THIS BUSINESS:\n${memoryDigest}\n` : "",
          `BUSINESS: ${business.name}`,
          `Industry: ${business.industry ?? "unknown"} | Model: ${business.business_model ?? "unknown"} | Customers: ${business.customer_model ?? "unknown"} | Team size: ${business.employee_count ?? "unknown"}`,
          "",
          "BUSINESS BRAIN FACTS:",
          facts
            .map(
              (f) =>
                `- id=${f.id} [${f.verified ? "VERIFIED" : f.fact_type.toUpperCase()}] (${f.category}) ${f.fact_key}: ${f.value_text ?? (f.value_number != null ? String(f.value_number) : "—")}`,
            )
            .join("\n"),
          "",
          "LATEST DIAGNOSIS:",
          diagnosisDigest,
          "",
          "ACTIVE BLUEPRINT:",
          blueprintDigest,
          "",
          "90-DAY ACTION PLAN:",
          planDigest,
          "",
          "EXISTING PROCESSES (do not duplicate):",
          existingDigest,
          "",
          "Identify only the repeatable operational systems this business should run. Return JSON in exactly this shape:",
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
    console.error("[process] schema mismatch", parsed.error.issues.slice(0, 6));
    throw new Error("The process generation came back in an unexpected shape. Please try again.");
  }

  const allowedFactIds = new Set(facts.map((f) => f.id));
  const existingNames = new Set((existingRows ?? []).map((p) => p.name.trim().toLowerCase()));
  const { accepted, rejected } = validateProcesses(
    parsed.data.processes,
    allowedFactIds,
    diagnosisTitles,
    existingNames,
  );

  if (accepted.length === 0) {
    return { status: "none", created: [], rejected, summary: parsed.data.summary };
  }

  const factById = new Map(facts.map((f) => [f.id, f]));
  const taskByTitle = new Map(planTasks.map((t) => [t.title.trim().toLowerCase(), t]));
  const db = await admin();
  const created: { id: string; name: string }[] = [];

  for (const candidate of accepted) {
    const sourceTask = candidate.source_action_titles
      .map((t) => taskByTitle.get(t.trim().toLowerCase()))
      .find((t) => t !== undefined);

    const evidence = {
      rationale: candidate.rationale,
      diagnosis_titles: candidate.diagnosis_titles,
      blueprint_sections: candidate.blueprint_sections,
      action_title: sourceTask?.title ?? null,
      facts: candidate.evidence_fact_ids.map((id) => {
        const fact = factById.get(id)!;
        return {
          factId: fact.id,
          factKey: fact.fact_key,
          category: fact.category,
          value: fact.value_text ?? (fact.value_number != null ? String(fact.value_number) : "—"),
          verified: fact.verified,
        };
      }),
    };

    const { data: inserted, error: insertError } = await db
      .from("processes")
      .insert({
        business_id: businessId,
        organization_id: options.organizationId ?? businessOrgId,
        name: candidate.name,
        description: candidate.description || null,
        purpose: candidate.purpose,
        process_category: candidate.category,
        trigger_type: candidate.trigger_type,
        trigger_definition: { description: candidate.trigger_description } as never,
        status: "draft",
        owner_type: candidate.owner_type,
        autonomy_level: Math.min(candidate.recommended_autonomy, DEFAULT_PROCESS_AUTONOMY),
        success_definition: candidate.success_definition,
        created_from_action_id: sourceTask?.id ?? null,
        created_from_diagnosis_id: runRow?.id ?? null,
        created_from_blueprint_version: blueprintRow?.version ?? null,
        version: 1,
        metadata: {
          source: "process_engine",
          generated_at: new Date().toISOString(),
          recommended_autonomy: candidate.recommended_autonomy,
          evidence,
        } as never,
      })
      .select("id, name")
      .single();

    if (insertError) {
      console.error("[process] insert failed", insertError.message);
      rejected.push({ process: candidate.name, reason: "The process could not be saved." });
      continue;
    }

    const stepRows = candidate.steps.map((step, index) => ({
      process_id: inserted.id,
      name: step.name,
      description: step.description || null,
      sequence: index + 1,
      step_type: step.step_type,
      owner_type: step.owner_type,
      autonomy_level: step.autonomy_level,
      automation_type: step.owner_type === "ai" ? "ai" : step.owner_type === "system" ? "automated" : "manual",
      input_definition: { description: step.input } as never,
      output_definition: { description: step.output } as never,
      condition_definition: { description: step.condition } as never,
      estimated_minutes: step.estimated_minutes,
      required: step.required,
      configuration: {} as never,
    }));

    const { error: stepError } = await db.from("process_steps").insert(stepRows);
    if (stepError) {
      console.error("[process] steps insert failed", stepError.message);
      await db.from("processes").delete().eq("id", inserted.id);
      rejected.push({ process: candidate.name, reason: "The process steps could not be saved." });
      continue;
    }

    created.push({ id: inserted.id, name: inserted.name });

    await writeAudit({
      action: "process.created",
      organizationId: options.organizationId ?? businessOrgId,
      businessId,
      userId: options.userId,
      actor: "system",
      entity: "processes",
      entityId: inserted.id,
      after: { name: candidate.name, steps: stepRows.length, autonomy: DEFAULT_PROCESS_AUTONOMY },
      metadata: { diagnosisRunId: runRow?.id ?? null, blueprintVersion: blueprintRow?.version ?? null },
    });
  }

  return { status: "ready", created, rejected, summary: parsed.data.summary };
}

/* ------------------------------------------------------------------ authoring */

export const stepInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(160),
  description: z.string().max(2000).nullable().default(null),
  stepType: z.enum(STEP_TYPES),
  ownerType: z.enum(OWNER_TYPES),
  autonomyLevel: z.number().int().min(0).max(4),
  input: z.string().max(1000).default(""),
  output: z.string().max(1000).default(""),
  condition: z.string().max(1000).default(""),
  estimatedMinutes: z.number().int().min(0).max(10080).nullable().default(null),
  required: z.boolean().default(true),
});

export type StepInput = z.infer<typeof stepInputSchema>;

/**
 * Saves a process definition. An ACTIVE process is never overwritten: editing it
 * creates version N+1 in draft, archives nothing and leaves historical
 * executions attached to the version under which they ran.
 */
export async function saveProcess(options: {
  supabase: Client;
  businessId: string;
  userId: string;
  processId: string;
  patch: {
    name?: string;
    description?: string | null;
    purpose?: string | null;
    category?: string | null;
    triggerType?: TriggerType;
    triggerDescription?: string;
    ownerType?: OwnerType;
    autonomyLevel?: number;
    successDefinition?: string | null;
  };
  steps?: StepInput[];
}): Promise<{ processId: string; newVersion: boolean }> {
  const { supabase, businessId, processId } = options;
  const current = await assertProcessAccess(supabase, businessId, processId);
  const db = await admin();

  const meta = obj(current.metadata);
  const lineageId = typeof meta["lineage_id"] === "string" ? (meta["lineage_id"] as string) : current.id;

  const fields = {
    ...(options.patch.name !== undefined ? { name: options.patch.name } : {}),
    ...(options.patch.description !== undefined ? { description: options.patch.description } : {}),
    ...(options.patch.purpose !== undefined ? { purpose: options.patch.purpose } : {}),
    ...(options.patch.category !== undefined ? { process_category: options.patch.category } : {}),
    ...(options.patch.triggerType !== undefined ? { trigger_type: options.patch.triggerType } : {}),
    ...(options.patch.triggerDescription !== undefined
      ? { trigger_definition: { description: options.patch.triggerDescription } as never }
      : {}),
    ...(options.patch.ownerType !== undefined ? { owner_type: options.patch.ownerType } : {}),
    ...(options.patch.autonomyLevel !== undefined
      ? { autonomy_level: Math.min(Math.max(options.patch.autonomyLevel, 0), 4) }
      : {}),
    ...(options.patch.successDefinition !== undefined
      ? { success_definition: options.patch.successDefinition }
      : {}),
  };

  const writeSteps = async (targetId: string) => {
    if (!options.steps) return;
    await db.from("process_steps").delete().eq("process_id", targetId);
    if (options.steps.length === 0) return;
    const rows = options.steps.map((step, index) => ({
      process_id: targetId,
      name: step.name,
      description: step.description,
      sequence: index + 1,
      step_type: step.stepType,
      owner_type: step.ownerType,
      autonomy_level: Math.min(Math.max(step.autonomyLevel, 0), 4),
      automation_type: step.ownerType === "ai" ? "ai" : step.ownerType === "system" ? "automated" : "manual",
      input_definition: { description: step.input } as never,
      output_definition: { description: step.output } as never,
      condition_definition: { description: step.condition } as never,
      estimated_minutes: step.estimatedMinutes,
      required: step.required,
      configuration: {} as never,
    }));
    const { error } = await db.from("process_steps").insert(rows);
    if (error) throw error;
  };

  if (current.status === "active") {
    // Versioned edit — the running definition stays untouched.
    const { data: created, error } = await db
      .from("processes")
      .insert({
        business_id: businessId,
        organization_id: current.organization_id,
        name: fields.name ?? current.name,
        description: fields.description ?? current.description,
        purpose: fields.purpose ?? current.purpose,
        process_category: fields.process_category ?? current.process_category,
        trigger_type: fields.trigger_type ?? current.trigger_type,
        trigger_definition: (fields.trigger_definition ?? current.trigger_definition) as never,
        status: "draft",
        owner_type: fields.owner_type ?? current.owner_type,
        owner_id: current.owner_id,
        autonomy_level: fields.autonomy_level ?? current.autonomy_level,
        success_definition: fields.success_definition ?? current.success_definition,
        created_from_action_id: current.created_from_action_id,
        created_from_diagnosis_id: current.created_from_diagnosis_id,
        created_from_blueprint_version: current.created_from_blueprint_version,
        version: current.version + 1,
        supersedes_process_id: current.id,
        metadata: { ...meta, lineage_id: lineageId } as never,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (options.steps) {
      await writeSteps(created.id);
    } else {
      const { data: existingSteps } = await db.from("process_steps").select("*").eq("process_id", current.id);
      const copies = (existingSteps ?? []).map((s) => ({
        process_id: created.id,
        name: s.name,
        description: s.description,
        sequence: s.sequence,
        step_type: s.step_type,
        owner_type: s.owner_type,
        owner_id: s.owner_id,
        autonomy_level: s.autonomy_level,
        automation_type: s.automation_type,
        input_definition: s.input_definition as never,
        output_definition: s.output_definition as never,
        condition_definition: s.condition_definition as never,
        estimated_minutes: s.estimated_minutes,
        required: s.required,
        configuration: s.configuration as never,
      }));
      if (copies.length > 0) await db.from("process_steps").insert(copies);
    }

    await writeAudit({
      action: "process.updated",
      organizationId: current.organization_id,
      businessId,
      userId: options.userId,
      entity: "processes",
      entityId: created.id,
      before: { version: current.version, status: current.status },
      after: { version: current.version + 1, status: "draft", supersedes: current.id },
    });

    return { processId: created.id, newVersion: true };
  }

  const { error } = await db
    .from("processes")
    .update({ ...fields, metadata: { ...meta, lineage_id: lineageId } as never })
    .eq("id", current.id);
  if (error) throw error;
  await writeSteps(current.id);

  await writeAudit({
    action: "process.updated",
    organizationId: current.organization_id,
    businessId,
    userId: options.userId,
    entity: "processes",
    entityId: current.id,
    before: { name: current.name, autonomy: current.autonomy_level },
    after: { ...fields, steps: options.steps?.length ?? null },
  });

  return { processId: current.id, newVersion: false };
}

export async function setProcessStatus(options: {
  supabase: Client;
  businessId: string;
  userId: string;
  processId: string;
  status: "active" | "paused" | "archived";
}) {
  const { supabase, businessId, processId } = options;
  const current = await assertProcessAccess(supabase, businessId, processId);
  const db = await admin();

  // The schema's process_status enum has draft/active/archived; "paused" maps
  // to draft with an explicit paused marker so history is never destroyed.
  const meta = obj(current.metadata);
  const dbStatus: ProcessStatus =
    options.status === "active" ? "active" : options.status === "archived" ? "archived" : "draft";

  if (options.status === "active") {
    // Quality gate — a definition must be complete before it can go live.
    const { count } = await db
      .from("process_steps")
      .select("id", { count: "exact", head: true })
      .eq("process_id", processId);

    const triggerDescription = String(obj(current.trigger_definition)["description"] ?? "").trim();
    const problems: string[] = [];
    if (!current.name || current.name.trim().length < 3) problems.push("a clear name");
    if (!current.purpose || current.purpose.trim().length < 10) problems.push("a purpose");
    if (!triggerDescription) problems.push("a trigger description");
    if (!current.success_definition || current.success_definition.trim().length < 5)
      problems.push("a success definition");
    if (!count) problems.push("at least one step");
    if (current.autonomy_level < 0 || current.autonomy_level > 4)
      problems.push("a valid autonomy level (0-4)");
    if (problems.length > 0) {
      throw new Error(`This process needs ${problems.join(", ")} before it can be activated.`);
    }

    // Activating a newer version retires the version it supersedes.
    if (current.supersedes_process_id) {
      await db.from("processes").update({ status: "archived" }).eq("id", current.supersedes_process_id);
    }
  }

  const { error } = await db
    .from("processes")
    .update({
      status: dbStatus,
      metadata: { ...meta, paused: options.status === "paused" } as never,
    })
    .eq("id", processId);
  if (error) throw error;

  await writeAudit({
    action:
      options.status === "active"
        ? "process.activated"
        : options.status === "paused"
          ? "process.paused"
          : "process.archived",
    organizationId: current.organization_id,
    businessId,
    userId: options.userId,
    entity: "processes",
    entityId: processId,
    before: { status: current.status },
    after: { status: dbStatus, paused: options.status === "paused" },
  });

  return { ok: true };
}

export async function duplicateProcess(options: {
  supabase: Client;
  businessId: string;
  userId: string;
  processId: string;
}) {
  const { supabase, businessId, processId } = options;
  const current = await assertProcessAccess(supabase, businessId, processId);
  const db = await admin();

  const { data: created, error } = await db
    .from("processes")
    .insert({
      business_id: businessId,
      organization_id: current.organization_id,
      name: `${current.name} (copy)`,
      description: current.description,
      purpose: current.purpose,
      process_category: current.process_category,
      trigger_type: current.trigger_type,
      trigger_definition: current.trigger_definition as never,
      status: "draft",
      owner_type: current.owner_type,
      autonomy_level: current.autonomy_level,
      success_definition: current.success_definition,
      created_from_action_id: current.created_from_action_id,
      created_from_diagnosis_id: current.created_from_diagnosis_id,
      created_from_blueprint_version: current.created_from_blueprint_version,
      version: 1,
      metadata: obj(current.metadata) as never,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { data: steps } = await db.from("process_steps").select("*").eq("process_id", processId);
  const copies = (steps ?? []).map((s) => ({
    process_id: created.id,
    name: s.name,
    description: s.description,
    sequence: s.sequence,
    step_type: s.step_type,
    owner_type: s.owner_type,
    autonomy_level: s.autonomy_level,
    automation_type: s.automation_type,
    input_definition: s.input_definition as never,
    output_definition: s.output_definition as never,
    condition_definition: s.condition_definition as never,
    estimated_minutes: s.estimated_minutes,
    required: s.required,
    configuration: s.configuration as never,
  }));
  if (copies.length > 0) await db.from("process_steps").insert(copies);

  await writeAudit({
    action: "process.created",
    organizationId: current.organization_id,
    businessId,
    userId: options.userId,
    entity: "processes",
    entityId: created.id,
    after: { duplicatedFrom: processId },
  });

  return { processId: created.id };
}

/* ------------------------------------------------------------------ execution */

type LogEntry = { sequence: number; name: string; stepType: string; outcome: string; note?: string; at: string };

function describeExternalEffect(step: StepRow): string | null {
  if (step.step_type === "notification") return "Sends a message to a customer or team member outside Business OS.";
  if (step.step_type === "integration") return "Calls an external system (not connected in this release).";
  return null;
}

/**
 * Runs the internal portion of a process. AI, data and decision steps execute.
 * Anything with an external effect, an approval step, or a step whose effective
 * autonomy is below level 4 stops the run and raises an approval instead.
 */
async function advanceExecution(db: Client, executionId: string): Promise<ExecutionRow> {
  const { data: execution, error } = await db
    .from("process_executions")
    .select("*")
    .eq("id", executionId)
    .single();
  if (error) throw error;
  if (["completed", "failed", "cancelled"].includes(execution.status)) return execution;

  const { data: process } = await db.from("processes").select("*").eq("id", execution.process_id).single();
  const { data: stepRows } = await db
    .from("process_steps")
    .select("*")
    .eq("process_id", execution.process_id)
    .order("sequence", { ascending: true });

  const steps = (stepRows ?? []) as StepRow[];
  const log: LogEntry[] = Array.isArray(execution.step_log) ? (execution.step_log as LogEntry[]) : [];
  const startedAt = execution.started_at ?? new Date().toISOString();
  let index = steps.findIndex((s) => s.sequence === (execution.current_step_sequence ?? steps[0]?.sequence ?? 1));
  if (index < 0) index = 0;

  const finish = async (patch: Partial<ExecutionRow>) => {
    const { data } = await db
      .from("process_executions")
      .update({ ...patch, step_log: log as never, started_at: startedAt } as never)
      .eq("id", executionId)
      .select("*")
      .single();
    return data as ExecutionRow;
  };

  const durationFrom = (endIso: string) =>
    Math.max(0, new Date(endIso).getTime() - new Date(startedAt).getTime());

  for (; index < steps.length; index += 1) {
    const step = steps[index]!;
    const effectiveAutonomy = Math.min(process?.autonomy_level ?? 1, step.autonomy_level);
    const external = describeExternalEffect(step);
    const now = new Date().toISOString();

    // Gate 1 — anything leaving the business, or an explicit approval step,
    // or a step the configured autonomy does not permit, waits for a human.
    if (step.step_type === "approval" || external !== null || effectiveAutonomy < 4) {
      if (step.step_type === "wait") {
        log.push({ sequence: step.sequence, name: step.name, stepType: step.step_type, outcome: "waiting", at: now });
        return finish({
          status: "waiting",
          current_step_id: step.id,
          current_step_sequence: step.sequence,
        });
      }

      // Internal, low-risk step types still run below the approval bar.
      const internal: StepType[] = ["action", "decision", "data_capture", "ai_generation", "end"];
      if (internal.includes(step.step_type)) {
        // fall through to execution below
      } else {
        const { data: approval } = await db
          .from("process_approvals")
          .insert({
            business_id: execution.business_id,
            organization_id: execution.organization_id,
            process_id: execution.process_id,
            execution_id: executionId,
            step_id: step.id,
            step_sequence: step.sequence,
            status: "pending",
            title: step.name,
            what_will_happen: step.description ?? obj(step.output_definition)["description"]?.toString() ?? null,
            why_recommended: process?.purpose ?? null,
            data_used: {
              inputs: obj(step.input_definition)["description"] ?? null,
              process: process?.name ?? null,
              execution: executionId,
            } as never,
            external_effect: external ?? "No external effect — internal approval gate.",
          })
          .select("id")
          .single();

        log.push({
          sequence: step.sequence,
          name: step.name,
          stepType: step.step_type,
          outcome: "approval_required",
          at: now,
        });

        await writeAudit({
          action: "process.approval_requested",
          organizationId: execution.organization_id,
          businessId: execution.business_id,
          actor: "system",
          entity: "process_approvals",
          entityId: approval?.id ?? null,
          metadata: { processId: execution.process_id, executionId, step: step.name },
        });

        return finish({
          status: "approval_required",
          current_step_id: step.id,
          current_step_sequence: step.sequence,
        });
      }
    }

    // Gate 2 — execute the internal step.
    try {
      if (step.step_type === "end") {
        const completedAt = new Date().toISOString();
        log.push({ sequence: step.sequence, name: step.name, stepType: step.step_type, outcome: "completed", at: completedAt });
        await writeAudit({
          action: "process.execution_completed",
          organizationId: execution.organization_id,
          businessId: execution.business_id,
          actor: "system",
          entity: "process_executions",
          entityId: executionId,
          after: { steps: log.length },
        });
        return finish({
          status: "completed",
          completed: true,
          failed: false,
          success: true,
          completed_at: completedAt,
          duration_ms: durationFrom(completedAt),
          current_step_id: step.id,
          current_step_sequence: step.sequence,
          metric_values: {
            steps_executed: log.length,
            duration_ms: durationFrom(completedAt),
          } as never,
        });
      }

      if (step.step_type === "decision") {
        const condition = obj(step.condition_definition)["description"];
        log.push({
          sequence: step.sequence,
          name: step.name,
          stepType: step.step_type,
          outcome: "evaluated",
          note: typeof condition === "string" && condition ? `Condition: ${condition}` : "Default branch taken",
          at: now,
        });
        continue;
      }

      if (step.step_type === "data_capture") {
        log.push({
          sequence: step.sequence,
          name: step.name,
          stepType: step.step_type,
          outcome: "captured",
          note: String(obj(step.input_definition)["description"] ?? "Captured against the execution record."),
          at: now,
        });
        continue;
      }

      if (step.step_type === "ai_generation") {
        log.push({
          sequence: step.sequence,
          name: step.name,
          stepType: step.step_type,
          outcome: "prepared",
          note: "Draft prepared for review. No external delivery in this release.",
          at: now,
        });
        continue;
      }

      log.push({ sequence: step.sequence, name: step.name, stepType: step.step_type, outcome: "done", at: now });
    } catch (stepError) {
      const message = stepError instanceof Error ? stepError.message : "Step failed";
      const failedAt = new Date().toISOString();
      log.push({ sequence: step.sequence, name: step.name, stepType: step.step_type, outcome: "failed", note: message, at: failedAt });
      await writeAudit({
        action: "process.execution_failed",
        organizationId: execution.organization_id,
        businessId: execution.business_id,
        actor: "system",
        entity: "process_executions",
        entityId: executionId,
        metadata: { step: step.name, error: message.slice(0, 400) },
      });
      return finish({
        status: "failed",
        failed: true,
        completed: false,
        success: false,
        error: message.slice(0, 1000),
        completed_at: failedAt,
        duration_ms: durationFrom(failedAt),
        current_step_id: step.id,
        current_step_sequence: step.sequence,
      });
    }
  }

  // Ran off the end of the definition without an explicit end step.
  const completedAt = new Date().toISOString();
  return finish({
    status: "completed",
    completed: true,
    failed: false,
    success: true,
    completed_at: completedAt,
    duration_ms: durationFrom(completedAt),
    metric_values: { steps_executed: log.length, duration_ms: durationFrom(completedAt) } as never,
  });
}

export async function startProcessExecution(options: {
  supabase: Client;
  businessId: string;
  userId: string;
  processId: string;
  triggerSource?: string;
}): Promise<ExecutionView> {
  const { supabase, businessId, processId } = options;
  const process = await assertProcessAccess(supabase, businessId, processId);
  if (process.status !== "active") throw new Error("Activate this process before running it.");

  const db = await admin();
  const { data: execution, error } = await db
    .from("process_executions")
    .insert({
      business_id: businessId,
      organization_id: process.organization_id,
      process_id: processId,
      process_version: process.version,
      status: "running",
      trigger_source: options.triggerSource ?? "manual",
      initiated_by: options.userId,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;

  await writeAudit({
    action: "process.execution_started",
    organizationId: process.organization_id,
    businessId,
    userId: options.userId,
    entity: "process_executions",
    entityId: execution.id,
    after: { processId, version: process.version },
  });

  const advanced = await advanceExecution(db, execution.id);
  return toExecutionView(advanced, process.name);
}

export async function resumeProcessExecution(options: {
  supabase: Client;
  businessId: string;
  userId: string;
  executionId: string;
}): Promise<ExecutionView> {
  const { supabase, businessId } = options;
  await assertBusinessAccess(supabase, businessId);
  const db = await admin();
  const { data: execution } = await db
    .from("process_executions")
    .select("*, processes(name, business_id)")
    .eq("id", options.executionId)
    .maybeSingle();
  if (!execution || execution.business_id !== businessId) throw new Error("That run does not exist in this business.");
  if (["completed", "failed", "cancelled"].includes(execution.status)) {
    return toExecutionView(execution as unknown as ExecutionRow, (execution.processes as { name: string } | null)?.name ?? "Process");
  }

  // Move past the step that was waiting or awaiting approval.
  const { data: steps } = await db
    .from("process_steps")
    .select("sequence")
    .eq("process_id", execution.process_id)
    .order("sequence", { ascending: true });
  const sequences = (steps ?? []).map((s) => s.sequence);
  const currentIndex = sequences.indexOf(execution.current_step_sequence ?? sequences[0] ?? 1);
  const next = sequences[currentIndex + 1] ?? null;

  await db
    .from("process_executions")
    .update({ status: "running", current_step_sequence: next ?? execution.current_step_sequence })
    .eq("id", options.executionId);

  const advanced = await advanceExecution(db, options.executionId);
  return toExecutionView(advanced, (execution.processes as { name: string } | null)?.name ?? "Process");
}

export async function pauseProcessExecution(options: {
  supabase: Client;
  businessId: string;
  userId: string;
  executionId: string;
}) {
  const { supabase, businessId } = options;
  await assertBusinessAccess(supabase, businessId);
  const db = await admin();
  const { data: execution } = await db
    .from("process_executions")
    .select("id, business_id, organization_id, process_id, status")
    .eq("id", options.executionId)
    .maybeSingle();
  if (!execution || execution.business_id !== businessId) throw new Error("That run does not exist in this business.");

  await db.from("process_executions").update({ status: "waiting" }).eq("id", execution.id);
  await writeAudit({
    action: "process.paused",
    organizationId: execution.organization_id,
    businessId,
    userId: options.userId,
    entity: "process_executions",
    entityId: execution.id,
    after: { status: "waiting" },
  });
  return { ok: true };
}

export async function cancelProcessExecution(options: {
  supabase: Client;
  businessId: string;
  userId: string;
  executionId: string;
}) {
  const { supabase, businessId } = options;
  await assertBusinessAccess(supabase, businessId);
  const db = await admin();
  const { data: execution } = await db
    .from("process_executions")
    .select("id, business_id, organization_id, started_at")
    .eq("id", options.executionId)
    .maybeSingle();
  if (!execution || execution.business_id !== businessId) throw new Error("That run does not exist in this business.");

  const completedAt = new Date().toISOString();
  await db
    .from("process_executions")
    .update({
      status: "cancelled",
      completed: false,
      failed: false,
      success: false,
      completed_at: completedAt,
      duration_ms: execution.started_at
        ? Math.max(0, new Date(completedAt).getTime() - new Date(execution.started_at).getTime())
        : null,
    })
    .eq("id", execution.id);

  await db
    .from("process_approvals")
    .update({ status: "expired" })
    .eq("execution_id", execution.id)
    .eq("status", "pending");

  await writeAudit({
    action: "process.execution_cancelled",
    organizationId: execution.organization_id,
    businessId,
    userId: options.userId,
    entity: "process_executions",
    entityId: execution.id,
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ approvals */

export async function decideApproval(options: {
  supabase: Client;
  businessId: string;
  userId: string;
  approvalId: string;
  decision: "approve" | "reject" | "pause";
  note?: string;
}): Promise<{ ok: true; execution: ExecutionView | null }> {
  const { supabase, businessId } = options;
  await assertBusinessAccess(supabase, businessId);
  const db = await admin();

  const { data: approval } = await db
    .from("process_approvals")
    .select("*")
    .eq("id", options.approvalId)
    .maybeSingle();
  if (!approval || approval.business_id !== businessId) {
    throw new Error("That approval does not exist in this business.");
  }
  if (approval.status !== "pending") throw new Error("This approval has already been decided.");

  const status = options.decision === "approve" ? "approved" : options.decision === "reject" ? "rejected" : "paused";

  await db
    .from("process_approvals")
    .update({
      status,
      decided_by: options.userId,
      decided_at: new Date().toISOString(),
      decision_note: options.note ?? null,
    })
    .eq("id", approval.id);

  await writeAudit({
    action: options.decision === "approve" ? "process.approval_approved" : "process.approval_rejected",
    organizationId: approval.organization_id,
    businessId,
    userId: options.userId,
    entity: "process_approvals",
    entityId: approval.id,
    after: { status, note: options.note ?? null },
  });

  if (options.decision === "approve") {
    const execution = await resumeProcessExecution({
      supabase,
      businessId,
      userId: options.userId,
      executionId: approval.execution_id,
    });
    return { ok: true, execution };
  }

  if (options.decision === "reject") {
    const completedAt = new Date().toISOString();
    await db
      .from("process_executions")
      .update({
        status: "cancelled",
        completed: false,
        failed: false,
        success: false,
        completed_at: completedAt,
        error: "Stopped by the owner at an approval step.",
      })
      .eq("id", approval.execution_id);
  } else {
    await db.from("process_executions").update({ status: "waiting" }).eq("id", approval.execution_id);
  }

  return { ok: true, execution: null };
}

/* -------------------------------------------------- manual process creation */

/**
 * Creates an empty draft process, optionally derived from an Action Plan item.
 * The action itself is never duplicated — only referenced.
 */
export async function createProcessDraft(options: {
  supabase: Client;
  businessId: string;
  userId: string;
  name?: string;
  fromTaskId?: string;
}): Promise<{ processId: string }> {
  const { supabase, businessId } = options;
  await assertBusinessAccess(supabase, businessId);

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("organization_id")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError) throw businessError;
  if (!business) throw new Error("That business does not exist.");

  let task: { id: string; title: string; metadata: unknown } | null = null;
  if (options.fromTaskId) {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, metadata")
      .eq("id", options.fromTaskId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("That action does not exist in this business.");
    task = data;

    const { data: existing } = await supabase
      .from("processes")
      .select("id")
      .eq("business_id", businessId)
      .eq("created_from_action_id", data.id)
      .neq("status", "archived")
      .limit(1)
      .maybeSingle();
    if (existing) return { processId: existing.id };
  }

  const { data: runRow } = await supabase
    .from("diagnosis_runs")
    .select("id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: blueprintRow } = await supabase
    .from("business_blueprints")
    .select("version")
    .eq("business_id", businessId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const taskMeta = obj(task?.metadata ?? {});
  const db = await admin();
  const { data: inserted, error } = await db
    .from("processes")
    .insert({
      business_id: businessId,
      organization_id: business.organization_id,
      name: options.name?.trim() || task?.title || "Untitled process",
      description: null,
      purpose: typeof taskMeta["outcome"] === "string" ? (taskMeta["outcome"] as string) : null,
      process_category: null,
      trigger_type: "manual",
      trigger_definition: { description: "" } as never,
      status: "draft",
      owner_type: "human",
      autonomy_level: DEFAULT_PROCESS_AUTONOMY,
      success_definition:
        typeof taskMeta["success_metric"] === "string" ? (taskMeta["success_metric"] as string) : null,
      created_from_action_id: task?.id ?? null,
      created_from_diagnosis_id: runRow?.id ?? null,
      created_from_blueprint_version: blueprintRow?.version ?? null,
      version: 1,
      metadata: {
        source: task ? "action_plan_conversion" : "manual",
        created_at: new Date().toISOString(),
        ...(Array.isArray(taskMeta["diagnosis_titles"])
          ? { evidence: { diagnosis_titles: taskMeta["diagnosis_titles"], facts: taskMeta["facts"] ?? [] } }
          : {}),
      } as never,
    })
    .select("id")
    .single();
  if (error) throw error;

  await writeAudit({
    action: "process.created",
    organizationId: business.organization_id,
    businessId,
    userId: options.userId,
    entity: "processes",
    entityId: inserted.id,
    after: {
      name: options.name ?? task?.title ?? "Untitled process",
      from_action_id: task?.id ?? null,
      autonomy: DEFAULT_PROCESS_AUTONOMY,
    },
  });

  return { processId: inserted.id };
}
