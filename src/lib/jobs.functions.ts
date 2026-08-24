import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const JOB_TYPE = z.enum([
  "interview_extraction",
  "diagnosis_run",
  "blueprint_run",
  "action_plan_run",
]);

/** Job status for the current business. RLS scopes reads to members. */
export const getJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        jobTypes: z.array(JOB_TYPE).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { listJobs, kickWorker } = await import("./jobs.server");
    const jobs = await listJobs({
      supabase: context.supabase,
      businessId: data.businessId,
      ...(data.jobTypes ? { jobTypes: data.jobTypes } : {}),
      ...(data.limit ? { limit: data.limit } : {}),
    });
    // Self-healing: if work is still queued, nudge the worker while polling.
    if (jobs.some((j) => j.status === "queued")) kickWorker();
    return { jobs };
  });

/** Month-to-date AI spend and limits for the business's organization. */
export const getAiBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ businessId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { getBudgetState } = await import("./ai-usage.server");
    const { data: business } = await context.supabase
      .from("businesses")
      .select("organization_id")
      .eq("id", data.businessId)
      .maybeSingle();
    if (!business?.organization_id) throw new Error("You do not have access to this business.");
    return getBudgetState(context.supabase, business.organization_id);
  });

/** Enqueues one of the long-running engines. Idempotent per pending run. */
export const enqueueEngineRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        jobType: z.enum(["diagnosis_run", "blueprint_run", "action_plan_run"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { enqueueJob, kickWorker, brainStateKey } = await import("./jobs.server");
    const { getBudgetState } = await import("./ai-usage.server");
    const { writeAudit } = await import("./audit.server");
    const { supabase, userId } = context;

    const { data: business } = await supabase
      .from("businesses")
      .select("organization_id")
      .eq("id", data.businessId)
      .maybeSingle();
    if (!business?.organization_id) throw new Error("You do not have access to this business.");

    const budget = await getBudgetState(supabase, business.organization_id);
    if (!budget.allowed) {
      await writeAudit({
        action: "ai_budget.exceeded",
        organizationId: business.organization_id,
        businessId: data.businessId,
        userId,
        metadata: {
          jobType: data.jobType,
          reason: budget.reason,
          tokensUsed: budget.tokensUsed,
          costUsedUsd: budget.costUsedUsd,
        },
      });
      return { job: null, blocked: true, reason: budget.reason };
    }

    // Deterministic idempotency: the key is derived from the state of the
    // Business Brain the run would consume, never from a timestamp. Repeated
    // clicks against unchanged knowledge reuse the same job; new knowledge
    // produces a genuinely new run.
    const stateKey = await brainStateKey(supabase, data.businessId);
    const idempotencyKey = `${data.jobType}:${data.businessId}:${stateKey}`;

    const job = await enqueueJob({
      jobType: data.jobType,
      organizationId: business.organization_id,
      businessId: data.businessId,
      idempotencyKey,
      priority: 5,
      input: { userId },
    });

    await writeAudit({
      action: "ai_job.enqueued",
      organizationId: business.organization_id,
      businessId: data.businessId,
      userId,
      entity: "ai_jobs",
      entityId: job.id,
      metadata: { jobType: data.jobType, idempotencyKey, status: job.status },
    });

    kickWorker([data.jobType]);
    return { job, blocked: false, reason: null };
  });

