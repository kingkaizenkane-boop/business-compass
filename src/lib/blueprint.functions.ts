import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const businessInput = z.object({ businessId: z.string().uuid() });

export const getBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput.extend({ blueprintId: z.string().uuid().nullish() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertBusinessAccess, loadBrain, assessReadiness } = await import("./diagnosis.server");
    const { loadBlueprint } = await import("./blueprint.server");
    const { supabase } = context;
    await assertBusinessAccess(supabase, data.businessId);
    const { facts } = await loadBrain(supabase, data.businessId);
    const readiness = assessReadiness(facts);
    return loadBlueprint(supabase, data.businessId, data.blueprintId ?? null, readiness);
  });

export const runBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { generateBlueprint } = await import("./blueprint.server");
    return generateBlueprint({
      supabase: context.supabase,
      businessId: data.businessId,
      userId: context.userId,
    });
  });
