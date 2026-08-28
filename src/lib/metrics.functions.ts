import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const businessInput = z.object({ businessId: z.string().uuid() });

const DIRECTION = z.enum(["higher_is_better", "lower_is_better", "target_range"]);
const FREQUENCY = z.enum(["daily", "weekly", "monthly", "quarterly", "custom"]);
const SOURCE = z.enum(["manual", "process", "integration", "import", "system", "ai"]);

const nullableUuid = z.string().uuid().nullable().optional();
const nullableNumber = z.number().finite().nullable().optional();

/** Every metric on a business, with outcomes, alerts and a portfolio summary. */
export const getMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { loadMetrics } = await import("./metrics.server");
    return loadMetrics(context.supabase, data.businessId);
  });

/** One metric: definition, history, outcome and everything it is linked to. */
export const getMetric = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput.extend({ metricId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { loadMetric } = await import("./metrics.server");
    return loadMetric(context.supabase, data.businessId, data.metricId);
  });

/** Options a user can attach a metric to — goals, findings, actions, processes. */
export const getMetricLinkOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [goals, tasks, processes, diagnosis] = await Promise.all([
      supabase
        .from("business_goals")
        .select("id, name")
        .eq("business_id", data.businessId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("tasks")
        .select("id, title")
        .eq("business_id", data.businessId)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("processes")
        .select("id, name")
        .eq("business_id", data.businessId)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("diagnosis_items")
        .select("id, title, created_at")
        .eq("business_id", data.businessId)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    return {
      goals: goals.data ?? [],
      tasks: tasks.data ?? [],
      processes: processes.data ?? [],
      diagnosisItems: (diagnosis.data ?? []).map((d) => ({ id: d.id, title: d.title })),
    };
  });

/** Create or update a metric definition. */
export const saveMetric = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput
      .extend({
        metricId: z.string().uuid().optional(),
        name: z.string().min(2).max(160),
        category: z.string().max(80).nullable().optional(),
        unit: z.string().max(40).nullable().optional(),
        description: z.string().max(2000).nullable().optional(),
        rationale: z.string().max(2000).nullable().optional(),
        source: SOURCE.optional(),
        direction: DIRECTION.optional(),
        frequency: FREQUENCY.optional(),
        baselineValue: nullableNumber,
        targetValue: nullableNumber,
        active: z.boolean().optional(),
        goalId: nullableUuid,
        diagnosisItemId: nullableUuid,
        taskId: nullableUuid,
        processId: nullableUuid,
        hypothesis: z.string().max(1000).nullable().optional(),
        intervention: z.string().max(1000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { upsertMetric } = await import("./metrics.server");
    return upsertMetric({
      supabase: context.supabase,
      userId: context.userId,
      input: data as Parameters<typeof upsertMetric>[0]["input"],
    });
  });

/** Append one manual observation. */
export const addMetricObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput
      .extend({
        metricId: z.string().uuid(),
        value: z.number().finite(),
        recordedAt: z.string().min(4).optional(),
        periodStart: z.string().min(4).nullable().optional(),
        periodEnd: z.string().min(4).nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
        source: SOURCE.optional(),
        processExecutionId: nullableUuid,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { recordObservation } = await import("./metrics.server");
    return recordObservation({
      supabase: context.supabase,
      userId: context.userId,
      input: data as Parameters<typeof recordObservation>[0]["input"],
    });
  });

/** Metrics attached to one process — the business outcome of running it. */
export const getProcessMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput.extend({ processId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { loadProcessMetrics } = await import("./metrics.server");
    return loadProcessMetrics(context.supabase, data.businessId, data.processId);
  });
