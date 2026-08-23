import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const businessInput = z.object({ businessId: z.string().uuid() });

export const getLatestDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput.extend({ runId: z.string().uuid().nullish() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertBusinessAccess, loadBrain, assessReadiness, loadDiagnosis } = await import(
      "./diagnosis.server"
    );
    const { supabase } = context;
    await assertBusinessAccess(supabase, data.businessId);
    const { facts } = await loadBrain(supabase, data.businessId);
    const readiness = assessReadiness(facts);
    return loadDiagnosis(supabase, data.businessId, data.runId ?? null, readiness);
  });

export const runDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { runDiagnosisEngine } = await import("./diagnosis.server");
    return runDiagnosisEngine({
      supabase: context.supabase,
      businessId: data.businessId,
      userId: context.userId,
    });
  });
