import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const businessInput = z.object({ businessId: z.string().uuid() });
const experimentInput = businessInput.extend({ experimentId: z.string().uuid() });

const EXPERIMENT_TYPE = z.enum(["before_after", "controlled", "observational"]);
const ACTION = z.enum(["plan", "unplan", "start", "pause", "resume", "complete", "cancel"]);

const nullableText = z.string().max(4000).nullable().optional();
const nullableNumber = z.number().finite().nullable().optional();
const nullableDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date")
  .nullable()
  .optional();

/** Every experiment on the business, with deterministic results and a summary. */
export const getExperiments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { loadExperiments } = await import("./experiments.server");
    return loadExperiments(context.supabase, data.businessId);
  });

/** One experiment: definition, hypothesis, result and metric history. */
export const getExperiment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => experimentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { loadExperiment } = await import("./experiments.server");
    return loadExperiment(context.supabase, data.businessId, data.experimentId);
  });

/** Pickers: which metrics, findings, actions and processes can be attached. */
export const getExperimentOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { loadMetrics } = await import("./metrics.server");

    const [{ metrics }, tasks, processes, diagnosis] = await Promise.all([
      loadMetrics(supabase, data.businessId),
      supabase
        .from("tasks")
        .select("id, title, status")
        .eq("business_id", data.businessId)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("processes")
        .select("id, name, status")
        .eq("business_id", data.businessId)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("diagnosis_items")
        .select("id, title, priority_level")
        .eq("business_id", data.businessId)
        .order("priority_score", { ascending: false })
        .limit(60),
    ]);

    return {
      metrics: metrics.map((m) => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        direction: m.direction,
        baselineValue: m.baselineValue,
        currentValue: m.currentValue,
        observationCount: m.observationCount,
      })),
      tasks: tasks.data ?? [],
      processes: processes.data ?? [],
      diagnosisItems: diagnosis.data ?? [],
    };
  });

/** A real baseline read from recorded observations. Never an invented number. */
export const getBaselineSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput.extend({ metricId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { suggestBaseline } = await import("./experiments.server");
    return suggestBaseline(context.supabase, data.businessId, data.metricId);
  });

/** Creates or edits an experiment. Definition fields freeze once it starts. */
export const saveExperiment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput
      .extend({
        experimentId: z.string().uuid().optional(),
        name: z.string().min(3).max(160),
        description: nullableText,
        hypothesisIntervention: nullableText,
        hypothesisExpectedChange: nullableText,
        hypothesisRationale: nullableText,
        rationale: nullableText,
        experimentType: EXPERIMENT_TYPE.optional(),
        interventionSummary: nullableText,
        comparisonDefinition: nullableText,
        startDate: nullableDate,
        endDate: nullableDate,
        primaryMetricId: z.string().uuid().nullable().optional(),
        secondaryMetricIds: z.array(z.string().uuid()).max(10).optional(),
        baselineValue: nullableNumber,
        baselinePeriodStart: nullableDate,
        baselinePeriodEnd: nullableDate,
        baselineSource: nullableText,
        targetValue: nullableNumber,
        sourceDiagnosisItemId: z.string().uuid().nullable().optional(),
        sourceTaskId: z.string().uuid().nullable().optional(),
        processId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { saveExperiment: save } = await import("./experiments.server");
    return save({ supabase: context.supabase, userId: context.userId, input: data });
  });

/** Lifecycle moves. Illegal transitions and unready starts are rejected. */
export const transitionExperiment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    experimentInput.extend({ action: ACTION, note: nullableText }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { transitionExperiment: move } = await import("./experiments.server");
    const outcome = await move({
      supabase: context.supabase,
      userId: context.userId,
      businessId: data.businessId,
      experimentId: data.experimentId,
      action: data.action,
      ...(data.note ? { note: data.note } : {}),
    });

    // Completion hands the narrative off to the async queue; the numbers are
    // already computed and stored, so the user never waits on AI.
    if (data.action === "complete") {
      const { enqueueJob, kickWorker } = await import("./jobs.server");
      const { resolveOrganizationId } = await import("./ai-usage.server");
      const organizationId = await resolveOrganizationId(context.supabase, data.businessId);
      if (organizationId) {
        await enqueueJob({
          jobType: "experiment_learning",
          organizationId,
          businessId: data.businessId,
          idempotencyKey: `experiment_learning:${data.experimentId}:initial`,
          priority: 6,
          input: { experimentId: data.experimentId, userId: context.userId },
        });
        kickWorker(["experiment_learning"]);
      }
    }

    return outcome;
  });

/** Records a measurement against an experiment metric, via the Metrics engine. */
export const recordExperimentObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    experimentInput
      .extend({
        metricId: z.string().uuid().nullable().optional(),
        value: z.number().finite(),
        recordedAt: z.string().min(4).optional(),
        notes: nullableText,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { recordExperimentObservation: record } = await import("./experiments.server");
    return record({
      supabase: context.supabase,
      userId: context.userId,
      businessId: data.businessId,
      experimentId: data.experimentId,
      metricId: data.metricId ?? null,
      value: data.value,
      ...(data.recordedAt ? { recordedAt: data.recordedAt } : {}),
      notes: data.notes ?? null,
    });
  });

/** Prefills a DRAFT experiment from a finding, an action or a process. */
export const draftExperiment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput
      .extend({
        diagnosisItemId: z.string().uuid().optional(),
        taskId: z.string().uuid().optional(),
        processId: z.string().uuid().optional(),
      })
      .refine((value) => Boolean(value.diagnosisItemId || value.taskId || value.processId), {
        message: "An experiment draft needs a finding, an action or a process to start from.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { draftExperiment: draft } = await import("./experiments.server");
    return draft({
      supabase: context.supabase,
      userId: context.userId,
      businessId: data.businessId,
      from: {
        ...(data.diagnosisItemId ? { diagnosisItemId: data.diagnosisItemId } : {}),
        ...(data.taskId ? { taskId: data.taskId } : {}),
        ...(data.processId ? { processId: data.processId } : {}),
      },
    });
  });

/** Re-runs learning synthesis for a completed experiment. */
export const regenerateLearning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => experimentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { enqueueJob, kickWorker } = await import("./jobs.server");
    const { resolveOrganizationId } = await import("./ai-usage.server");
    const organizationId = await resolveOrganizationId(context.supabase, data.businessId);
    if (!organizationId) throw new Error("You do not have access to this business.");
    // Keyed on the version of the learning being replaced, so one regeneration
    // per generated narrative is possible without duplicating queue rows.
    const { data: row } = await context.supabase
      .from("experiments")
      .select("learning_generated_at")
      .eq("id", data.experimentId)
      .eq("business_id", data.businessId)
      .maybeSingle();
    const job = await enqueueJob({
      jobType: "experiment_learning",
      organizationId,
      businessId: data.businessId,
      idempotencyKey: `experiment_learning:${data.experimentId}:${row?.learning_generated_at ?? "initial"}`,
      priority: 6,
      input: { experimentId: data.experimentId, userId: context.userId },
    });
    kickWorker(["experiment_learning"]);
    return { job };
  });
