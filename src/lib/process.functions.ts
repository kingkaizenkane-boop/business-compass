import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const businessInput = z.object({ businessId: z.string().uuid() });

const STEP_TYPE = z.enum([
  "action",
  "decision",
  "wait",
  "approval",
  "notification",
  "data_capture",
  "ai_generation",
  "integration",
  "end",
]);
const OWNER_TYPE = z.enum(["human", "ai", "hybrid", "system"]);
const TRIGGER_TYPE = z.enum([
  "manual",
  "scheduled",
  "event",
  "inbound_lead",
  "customer_action",
  "metric_threshold",
  "ai_recommendation",
]);

const stepSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(160),
  description: z.string().max(2000).nullable().default(null),
  stepType: STEP_TYPE,
  ownerType: OWNER_TYPE,
  autonomyLevel: z.number().int().min(0).max(4),
  input: z.string().max(1000).default(""),
  output: z.string().max(1000).default(""),
  condition: z.string().max(1000).default(""),
  estimatedMinutes: z.number().int().min(0).max(10080).nullable().default(null),
  required: z.boolean().default(true),
});

/** Operations overview: processes, recent runs and pending approvals. */
export const getOperations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { loadOperations } = await import("./process.server");
    return loadOperations(context.supabase, data.businessId);
  });

/** One process with its steps, evidence, runs, approvals and version history. */
export const getProcess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput.extend({ processId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { loadProcess } = await import("./process.server");
    return loadProcess(context.supabase, data.businessId, data.processId);
  });

/** Saves a process definition. Editing an active process creates a new version. */
export const saveProcessDefinition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput
      .extend({
        processId: z.string().uuid(),
        patch: z
          .object({
            name: z.string().min(3).max(160).optional(),
            description: z.string().max(4000).nullable().optional(),
            purpose: z.string().max(2000).nullable().optional(),
            category: z.string().max(80).nullable().optional(),
            triggerType: TRIGGER_TYPE.optional(),
            triggerDescription: z.string().max(1000).optional(),
            ownerType: OWNER_TYPE.optional(),
            autonomyLevel: z.number().int().min(0).max(4).optional(),
            successDefinition: z.string().max(1000).nullable().optional(),
          })
          .default({}),
        steps: z.array(stepSchema).max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { saveProcess } = await import("./process.server");
    return saveProcess({
      supabase: context.supabase,
      businessId: data.businessId,
      userId: context.userId,
      processId: data.processId,
      patch: data.patch as Parameters<typeof saveProcess>[0]["patch"],
      ...(data.steps ? { steps: data.steps } : {}),
    });
  });

/** Activate, pause or archive a process. History is never destroyed. */
export const setProcessLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput
      .extend({
        processId: z.string().uuid(),
        status: z.enum(["active", "paused", "archived"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { setProcessStatus } = await import("./process.server");
    return setProcessStatus({
      supabase: context.supabase,
      businessId: data.businessId,
      userId: context.userId,
      processId: data.processId,
      status: data.status,
    });
  });

export const duplicateProcessDefinition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput.extend({ processId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { duplicateProcess } = await import("./process.server");
    return duplicateProcess({
      supabase: context.supabase,
      businessId: data.businessId,
      userId: context.userId,
      processId: data.processId,
    });
  });

/** Starts a run of an active process. Internal steps run; external work waits. */
export const runProcess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput.extend({ processId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { startProcessExecution } = await import("./process.server");
    return startProcessExecution({
      supabase: context.supabase,
      businessId: data.businessId,
      userId: context.userId,
      processId: data.processId,
      triggerSource: "manual",
    });
  });

export const controlExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput
      .extend({
        executionId: z.string().uuid(),
        action: z.enum(["resume", "pause", "cancel"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const engine = await import("./process.server");
    const args = {
      supabase: context.supabase,
      businessId: data.businessId,
      userId: context.userId,
      executionId: data.executionId,
    };
    if (data.action === "resume") return { execution: await engine.resumeProcessExecution(args) };
    if (data.action === "pause") {
      await engine.pauseProcessExecution(args);
      return { execution: null };
    }
    await engine.cancelProcessExecution(args);
    return { execution: null };
  });

/** Records an approval decision and, on approval, resumes the run. */
export const decideProcessApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput
      .extend({
        approvalId: z.string().uuid(),
        decision: z.enum(["approve", "reject", "pause"]),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { decideApproval } = await import("./process.server");
    return decideApproval({
      supabase: context.supabase,
      businessId: data.businessId,
      userId: context.userId,
      approvalId: data.approvalId,
      decision: data.decision,
      ...(data.note ? { note: data.note } : {}),
    });
  });

/** Creates an empty draft process, or converts an Action Plan item into one. */
export const createProcess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput
      .extend({
        name: z.string().min(3).max(160).optional(),
        fromTaskId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { createProcessDraft } = await import("./process.server");
    return createProcessDraft({
      supabase: context.supabase,
      businessId: data.businessId,
      userId: context.userId,
      ...(data.name ? { name: data.name } : {}),
      ...(data.fromTaskId ? { fromTaskId: data.fromTaskId } : {}),
    });
  });
