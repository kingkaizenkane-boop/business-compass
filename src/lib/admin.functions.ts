import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organizationId: z.string().uuid() });

/**
 * Month-to-date AI usage for one organization: spend, tokens, model and
 * operation breakdown, recent failures and the current budget ceiling.
 * Readable by any member (RLS scopes the rows); only owners/admins can change
 * the limits or resume paused AI work.
 */
export const getAiUsageOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getBudgetState } = await import("./ai-usage.server");

    const [{ data: isAdmin }, budget] = await Promise.all([
      supabase.rpc("is_org_admin", { target_org: data.organizationId }),
      getBudgetState(supabase, data.organizationId),
    ]);

    const monthStart = (() => {
      const now = new Date();
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    })();

    const { data: rows, error } = await supabase
      .from("ai_usage")
      .select("model, operation, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, succeeded, created_at, business_id")
      .eq("organization_id", data.organizationId)
      .gte("created_at", monthStart)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;

    const usage = rows ?? [];

    type Bucket = { key: string; calls: number; tokens: number; costUsd: number; failures: number };
    const group = (keyOf: (r: (typeof usage)[number]) => string) => {
      const map = new Map<string, Bucket>();
      for (const row of usage) {
        const key = keyOf(row);
        const bucket = map.get(key) ?? { key, calls: 0, tokens: 0, costUsd: 0, failures: 0 };
        bucket.calls += 1;
        bucket.tokens += Number(row.total_tokens ?? 0);
        bucket.costUsd += Number(row.estimated_cost_usd ?? 0);
        if (!row.succeeded) bucket.failures += 1;
        map.set(key, bucket);
      }
      return [...map.values()]
        .map((b) => ({ ...b, costUsd: Math.round(b.costUsd * 1e4) / 1e4 }))
        .sort((a, b) => b.costUsd - a.costUsd);
    };

    const byDayMap = new Map<string, { day: string; tokens: number; costUsd: number; calls: number }>();
    for (const row of usage) {
      const day = row.created_at.slice(0, 10);
      const entry = byDayMap.get(day) ?? { day, tokens: 0, costUsd: 0, calls: 0 };
      entry.tokens += Number(row.total_tokens ?? 0);
      entry.costUsd += Number(row.estimated_cost_usd ?? 0);
      entry.calls += 1;
      byDayMap.set(day, entry);
    }

    const { data: failedJobs } = await supabase
      .from("ai_jobs")
      .select("id, job_type, status, attempts, max_attempts, error_message, business_id, created_at, last_error_at")
      .eq("organization_id", data.organizationId)
      .in("status", ["failed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(10);

    const tokenPct =
      budget.limits.monthlyTokenLimit > 0
        ? Math.round((budget.tokensUsed / budget.limits.monthlyTokenLimit) * 100)
        : 0;
    const costPct =
      budget.limits.monthlyCostLimitUsd > 0
        ? Math.round((budget.costUsedUsd / budget.limits.monthlyCostLimitUsd) * 100)
        : 0;

    const alerts: Array<{ level: "warning" | "critical"; message: string }> = [];
    if (budget.limits.paused) {
      alerts.push({
        level: "critical",
        message: budget.limits.pauseReason ?? "AI work is paused for this organization.",
      });
    }
    if (!budget.allowed && !budget.limits.paused) {
      alerts.push({ level: "critical", message: budget.reason ?? "AI budget reached." });
    }
    if (budget.allowed && Math.max(tokenPct, costPct) >= 80) {
      alerts.push({
        level: "warning",
        message: `You have used ${Math.max(tokenPct, costPct)}% of this month's AI budget.`,
      });
    }

    return {
      isAdmin: Boolean(isAdmin),
      userId,
      budget,
      alerts,
      tokenPct,
      costPct,
      totals: {
        calls: usage.length,
        failures: usage.filter((r) => !r.succeeded).length,
        tokens: budget.tokensUsed,
        costUsd: budget.costUsedUsd,
      },
      byModel: group((r) => r.model),
      byOperation: group((r) => r.operation),
      byDay: [...byDayMap.values()]
        .map((d) => ({ ...d, costUsd: Math.round(d.costUsd * 1e4) / 1e4 }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      failedJobs: failedJobs ?? [],
    };
  });

/** Owner/admin only: change the monthly AI ceiling for an organization. */
export const updateAiLimits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    orgInput
      .extend({
        monthlyTokenLimit: z.number().int().min(0).max(1_000_000_000),
        monthlyCostLimitUsd: z.number().min(0).max(100_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_org_admin", { target_org: data.organizationId });
    if (!isAdmin) throw new Error("Only workspace owners and admins can change AI limits.");

    const { error } = await supabase.from("organization_ai_limits").upsert(
      {
        organization_id: data.organizationId,
        monthly_token_limit: data.monthlyTokenLimit,
        monthly_cost_limit_usd: data.monthlyCostLimitUsd,
      },
      { onConflict: "organization_id" },
    );
    if (error) throw error;

    const { writeAudit } = await import("./audit.server");
    await writeAudit({
      supabase,
      action: "ai_limits.updated",
      organizationId: data.organizationId,
      userId,
      entity: "organization_ai_limits",
      entityId: data.organizationId,
      after: {
        monthlyTokenLimit: data.monthlyTokenLimit,
        monthlyCostLimitUsd: data.monthlyCostLimitUsd,
      },
      metadata: { change: "limits_updated" },
    });

    return { ok: true };
  });

/** Owner/admin only: clear a pause so queued AI work resumes. */
export const resumeAiWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_org_admin", { target_org: data.organizationId });
    if (!isAdmin) throw new Error("Only workspace owners and admins can resume AI work.");

    const { error } = await supabase
      .from("organization_ai_limits")
      .update({ paused: false, pause_reason: null, paused_at: null })
      .eq("organization_id", data.organizationId);
    if (error) throw error;

    const { writeAudit } = await import("./audit.server");
    await writeAudit({
      supabase,
      action: "ai.resumed",
      organizationId: data.organizationId,
      userId,
      entity: "organization_ai_limits",
      entityId: data.organizationId,
      metadata: { change: "resumed" },
    });

    return { ok: true };
  });
