/**
 * Server-only AI job queue: enqueueing, the worker drain path and job status.
 * Long-running AI work never runs in the synchronous request path.
 *
 * Uses the existing ai_jobs table plus claim_ai_job(), complete_ai_job(),
 * fail_ai_job() and reclaim_stalled_ai_jobs().
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { getBudgetState } from "./ai-usage.server";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
type JobRow = Database["public"]["Tables"]["ai_jobs"]["Row"];

export const JOB_TYPES = [
  "interview_extraction",
  "diagnosis_run",
  "blueprint_run",
  "action_plan_run",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_LABELS: Record<JobType, string> = {
  interview_extraction: "Learning from your answer",
  diagnosis_run: "Diagnosing the business",
  blueprint_run: "Writing the strategic blueprint",
  action_plan_run: "Sequencing the 90-day plan",
};

export type JobView = {
  id: string;
  jobType: string;
  label: string;
  status: JobRow["status"];
  progress: string | null;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastErrorAt: string | null;
};

export function toJobView(row: JobRow): JobView {
  return {
    id: row.id,
    jobType: row.job_type,
    label: JOB_LABELS[row.job_type as JobType] ?? row.job_type,
    status: row.status,
    progress: row.progress,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    lastErrorAt: row.last_error_at,
  };
}

/** Privileged client. The queue is service-role only; RLS keeps clients out. */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Client;
}

/**
 * Enqueues a job. Idempotent: the same idempotency key returns the existing
 * job instead of creating a duplicate.
 */
export async function enqueueJob(options: {
  jobType: JobType;
  organizationId: string;
  businessId: string;
  idempotencyKey: string;
  input: Record<string, unknown>;
  priority?: number;
}): Promise<JobView> {
  const db = await admin();

  const { data: existing } = await db
    .from("ai_jobs")
    .select("*")
    .eq("idempotency_key", options.idempotencyKey)
    .maybeSingle();

  if (existing) {
    // A terminal job can be re-run by resetting it in place (still one row).
    if (existing.status === "failed" || existing.status === "cancelled") {
      const { data: reset } = await db
        .from("ai_jobs")
        .update({
          status: "queued",
          attempts: 0,
          error_message: null,
          progress: "Queued",
          output_data: null,
          locked_at: null,
          locked_by: null,
          completed_at: null,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      return toJobView(reset ?? existing);
    }
    return toJobView(existing);
  }

  const { data, error } = await db
    .from("ai_jobs")
    .insert({
      job_type: options.jobType,
      organization_id: options.organizationId,
      business_id: options.businessId,
      idempotency_key: options.idempotencyKey,
      input_data: options.input as never,
      priority: options.priority ?? 5,
      progress: "Queued",
      status: "queued",
    })
    .select("*")
    .single();

  if (error) {
    // Lost an insert race on the unique idempotency key — return the winner.
    const { data: raced } = await db
      .from("ai_jobs")
      .select("*")
      .eq("idempotency_key", options.idempotencyKey)
      .maybeSingle();
    if (raced) return toJobView(raced);
    throw error;
  }

  return toJobView(data);
}

async function setProgress(db: Client, jobId: string, progress: string) {
  await db
    .from("ai_jobs")
    .update({ progress, heartbeat_at: new Date().toISOString() })
    .eq("id", jobId);
}

/* ------------------------------------------------------------------ dispatch */

async function runJob(db: Client, job: JobRow): Promise<Record<string, unknown>> {
  const input = (job.input_data ?? {}) as Record<string, string | null>;
  const businessId = job.business_id!;
  const organizationId = job.organization_id;

  switch (job.job_type as JobType) {
    case "interview_extraction": {
      await setProgress(db, job.id, "Extracting business facts");
      const { extractFactsFromResponse } = await import("./interview.server");
      const outcome = await extractFactsFromResponse({
        supabase: db,
        businessId,
        userId: input["userId"] ?? null,
        questionKey: input["questionKey"] ?? "",
        questionText: input["questionText"] ?? "",
        answer: input["answer"] ?? "",
        responseId: input["responseId"] ?? null,
        organizationId,
        jobId: job.id,
      });
      return outcome as unknown as Record<string, unknown>;
    }
    case "diagnosis_run": {
      await setProgress(db, job.id, "Analysing the Business Brain");
      const { runDiagnosisEngine } = await import("./diagnosis.server");
      const result = await runDiagnosisEngine({
        supabase: db,
        businessId,
        userId: input["userId"] ?? "",
        organizationId,
        jobId: job.id,
      });
      return { status: result.status, runId: result.run?.id ?? null };
    }
    case "blueprint_run": {
      await setProgress(db, job.id, "Composing the strategic blueprint");
      const { generateBlueprint } = await import("./blueprint.server");
      const result = await generateBlueprint({
        supabase: db,
        businessId,
        userId: input["userId"] ?? "",
        organizationId,
        jobId: job.id,
      });
      return { status: (result as { status?: string }).status ?? "completed" };
    }
    case "action_plan_run": {
      await setProgress(db, job.id, "Sequencing the 90-day plan");
      const { generateActionPlan } = await import("./action-plan.server");
      const result = await generateActionPlan({
        supabase: db,
        businessId,
        userId: input["userId"] ?? "",
        organizationId,
        jobId: job.id,
      });
      return { status: (result as { status?: string }).status ?? "completed" };
    }
    default:
      throw new Error(`Unknown job type: ${job.job_type}`);
  }
}

export type DrainSummary = {
  reclaimed: number;
  claimed: number;
  completed: number;
  failed: number;
  skipped: number;
};

/**
 * Drains a bounded batch of queued jobs. Safe to call concurrently:
 * claim_ai_job() uses FOR UPDATE SKIP LOCKED so each job runs once.
 */
export async function drainAiJobs(options?: {
  limit?: number;
  workerId?: string;
  jobTypes?: JobType[];
}): Promise<DrainSummary> {
  const db = await admin();
  const limit = Math.min(Math.max(options?.limit ?? 3, 1), 10);
  const workerId = options?.workerId ?? `worker-${crypto.randomUUID().slice(0, 8)}`;

  const summary: DrainSummary = { reclaimed: 0, claimed: 0, completed: 0, failed: 0, skipped: 0 };

  const { data: reclaimed } = await db.rpc("reclaim_stalled_ai_jobs");
  summary.reclaimed = Number(reclaimed ?? 0);

  for (let i = 0; i < limit; i += 1) {
    const { data: claimed, error } = await db.rpc("claim_ai_job", {
      worker_id: workerId,
      requested_job_types: (options?.jobTypes ?? null) as unknown as string[],
    });
    if (error) {
      console.error("[jobs] claim failed", error.message);
      break;
    }
    const job = (Array.isArray(claimed) ? claimed[0] : claimed) as JobRow | null;
    if (!job || !job.id) break;
    summary.claimed += 1;

    // Circuit breaker: never spend beyond the organization's ceiling.
    if (job.organization_id) {
      const budget = await getBudgetState(db, job.organization_id);
      if (!budget.allowed) {
        await db
          .from("ai_jobs")
          .update({
            status: "cancelled",
            error_message: budget.reason,
            last_error_at: new Date().toISOString(),
            progress: "Paused — AI budget reached",
            locked_at: null,
            locked_by: null,
          })
          .eq("id", job.id);
        summary.skipped += 1;
        continue;
      }
    }

    try {
      const output = await runJob(db, job);
      await db.rpc("complete_ai_job", { job_id: job.id, result: output as never });
      await db.from("ai_jobs").update({ progress: "Completed" }).eq("id", job.id);
      summary.completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown job failure";
      console.error("[jobs] job failed", job.job_type, message);
      await db.rpc("fail_ai_job", { job_id: job.id, error_text: message.slice(0, 1000) });
      await db
        .from("ai_jobs")
        .update({ last_error_at: new Date().toISOString(), progress: "Retrying" })
        .eq("id", job.id);
      summary.failed += 1;
    }
  }

  return summary;
}

/** Runs the drain in the background without blocking the caller's response. */
export function kickWorker(jobTypes?: JobType[]) {
  void drainAiJobs({ limit: 3, ...(jobTypes ? { jobTypes } : {}) }).catch((error) => {
    console.error("[jobs] background drain failed", error);
  });
}

/* ------------------------------------------------------------------ status */

export async function listJobs(options: {
  supabase: Client;
  businessId: string;
  jobTypes?: JobType[];
  limit?: number;
}): Promise<JobView[]> {
  let query = options.supabase
    .from("ai_jobs")
    .select("*")
    .eq("business_id", options.businessId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 20);
  if (options.jobTypes && options.jobTypes.length > 0) {
    query = query.in("job_type", options.jobTypes);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toJobView);
}
