import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const businessInput = z.object({ businessId: z.string().uuid() });

export const getActionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertBusinessAccess, loadBrain, assessReadiness } = await import("./diagnosis.server");
    const { loadActionPlan } = await import("./action-plan.server");
    const { supabase } = context;
    await assertBusinessAccess(supabase, data.businessId);
    const { facts } = await loadBrain(supabase, data.businessId);
    return loadActionPlan(supabase, data.businessId, assessReadiness(facts));
  });

export const runActionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { generateActionPlan } = await import("./action-plan.server");
    return generateActionPlan({
      supabase: context.supabase,
      businessId: data.businessId,
      userId: context.userId,
    });
  });

export const updateActionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput
      .extend({
        taskId: z.string().uuid(),
        status: z.enum(["todo", "in_progress", "blocked", "completed", "cancelled"]).optional(),
        approved: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { setActionState } = await import("./action-plan.server");
    return setActionState({
      supabase: context.supabase,
      businessId: data.businessId,
      taskId: data.taskId,
      ...(data.status ? { status: data.status } : {}),
      ...(data.approved !== undefined ? { approved: data.approved } : {}),
    });
  });
