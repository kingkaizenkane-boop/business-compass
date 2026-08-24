import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const businessInput = z.object({ businessId: z.string().uuid() });

export const getBrainSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [{ data: facts, error: factError }, { data: evidence }] = await Promise.all([
      supabase
        .from("brain_facts")
        .select(
          "id, category, subcategory, fact_key, value_text, value_number, fact_type, confidence, confidence_level, verified, created_at",
        )
        .eq("business_id", data.businessId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("evidence")
        .select("id, evidence_type, title, created_at, verified")
        .eq("business_id", data.businessId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (factError) throw factError;

    const rows = facts ?? [];
    const byCategory = new Map<string, number>();
    for (const fact of rows) {
      byCategory.set(fact.category, (byCategory.get(fact.category) ?? 0) + 1);
    }

    const verifiedCount = rows.filter((f) => f.verified).length;
    const inferredCount = rows.filter((f) => f.fact_type === "inference" || f.fact_type === "assumption").length;
    const averageConfidence =
      rows.length === 0
        ? 0
        : Math.round((rows.reduce((sum, f) => sum + Number(f.confidence), 0) / rows.length) * 100);

    return {
      facts: rows,
      evidence: evidence ?? [],
      categories: [...byCategory.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      totals: {
        facts: rows.length,
        verified: verifiedCount,
        inferred: inferredCount,
        averageConfidence,
      },
    };
  });

export const verifyFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ factId: z.string().uuid(), verified: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Read first so the audit row records what actually changed, and so a fact
    // outside the caller's tenant fails here rather than silently no-opping.
    const { data: fact, error: readError } = await supabase
      .from("brain_facts")
      .select("id, business_id, fact_key, verified")
      .eq("id", data.factId)
      .maybeSingle();
    if (readError) throw readError;
    if (!fact) throw new Error("That fact is not available in this workspace.");

    const { error } = await supabase
      .from("brain_facts")
      .update({ verified: data.verified })
      .eq("id", data.factId);
    if (error) throw error;

    const { writeAudit } = await import("./audit.server");
    const { data: business } = await supabase
      .from("businesses")
      .select("organization_id")
      .eq("id", fact.business_id)
      .maybeSingle();

    await writeAudit({
      supabase,
      action: data.verified ? "brain_fact.verified" : "brain_fact.unverified",
      organizationId: business?.organization_id ?? null,
      businessId: fact.business_id,
      userId,
      entity: "brain_facts",
      entityId: fact.id,
      before: { verified: fact.verified },
      after: { verified: data.verified },
      metadata: { factKey: fact.fact_key },
    });

    return { ok: true };
  });
