/**
 * Server-only AI cost controls: model routing, per-organization usage
 * accounting and budget enforcement. Never imported by client code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/**
 * Model routing. Cheap extraction/classification work goes to the lite model;
 * expensive multi-step reasoning is reserved for Diagnosis and Blueprint.
 */
export const AI_MODELS = {
  extraction: "google/gemini-2.5-flash-lite",
  memory: "google/gemini-2.5-flash-lite",
  embedding: "openai/text-embedding-3-small",
  reasoning: "google/gemini-2.5-pro",
  planning: "google/gemini-2.5-flash",
} as const;

/** USD per 1M tokens. Used for approximate spend accounting only. */
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "google/gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "google/gemini-2.5-pro": { input: 1.25, output: 10 },
  "openai/text-embedding-3-small": { input: 0.02, output: 0 },
};

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number) {
  const price = PRICE_PER_MTOK[model] ?? { input: 0.5, output: 2 };
  const cost = (promptTokens / 1_000_000) * price.input + (completionTokens / 1_000_000) * price.output;
  return Math.round(cost * 1e6) / 1e6;
}

export type UsageContext = {
  organizationId: string;
  businessId?: string | null;
  jobId?: string | null;
  operation: string;
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

/** Records one AI call against the organization's ledger. Never throws. */
export async function recordAiUsage(options: {
  supabase: Client;
  context: UsageContext;
  model: string;
  usage: TokenUsage;
  succeeded: boolean;
  metadata?: Record<string, unknown>;
}) {
  const { supabase, context, model, usage, succeeded } = options;
  try {
    await supabase.from("ai_usage").insert({
      organization_id: context.organizationId,
      business_id: context.businessId ?? null,
      job_id: context.jobId ?? null,
      operation: context.operation,
      model,
      prompt_tokens: usage.promptTokens,
      completion_tokens: usage.completionTokens,
      total_tokens: usage.totalTokens,
      estimated_cost_usd: estimateCostUsd(model, usage.promptTokens, usage.completionTokens),
      succeeded,
      metadata: (options.metadata ?? {}) as never,
    });
  } catch (error) {
    console.error("[ai-usage] failed to record usage", error);
  }
}

export type OrgLimits = {
  monthlyTokenLimit: number;
  monthlyCostLimitUsd: number;
  paused: boolean;
  pauseReason: string | null;
};

export type BudgetState = {
  allowed: boolean;
  reason: string | null;
  tokensUsed: number;
  costUsedUsd: number;
  limits: OrgLimits;
};

const DEFAULT_LIMITS: OrgLimits = {
  monthlyTokenLimit: 3_000_000,
  monthlyCostLimitUsd: 25,
  paused: false,
  pauseReason: null,
};

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function getOrgLimits(supabase: Client, organizationId: string): Promise<OrgLimits> {
  const { data } = await supabase
    .from("organization_ai_limits")
    .select("monthly_token_limit, monthly_cost_limit_usd, paused, pause_reason")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) return DEFAULT_LIMITS;
  return {
    monthlyTokenLimit: Number(data.monthly_token_limit),
    monthlyCostLimitUsd: Number(data.monthly_cost_limit_usd),
    paused: data.paused,
    pauseReason: data.pause_reason,
  };
}

/** Month-to-date spend for an organization plus whether new AI work is allowed. */
export async function getBudgetState(supabase: Client, organizationId: string): Promise<BudgetState> {
  const limits = await getOrgLimits(supabase, organizationId);
  const { data } = await supabase
    .from("ai_usage")
    .select("total_tokens, estimated_cost_usd")
    .eq("organization_id", organizationId)
    .gte("created_at", monthStart())
    .limit(10000);

  const rows = data ?? [];
  const tokensUsed = rows.reduce((sum, r) => sum + Number(r.total_tokens ?? 0), 0);
  const costUsedUsd = Math.round(rows.reduce((sum, r) => sum + Number(r.estimated_cost_usd ?? 0), 0) * 1e4) / 1e4;

  let reason: string | null = null;
  if (limits.paused) {
    reason = limits.pauseReason ?? "AI work is paused for this organization.";
  } else if (tokensUsed >= limits.monthlyTokenLimit) {
    reason = "This organization has reached its monthly AI token limit.";
  } else if (costUsedUsd >= limits.monthlyCostLimitUsd) {
    reason = "This organization has reached its monthly AI spend limit.";
  }

  return { allowed: reason === null, reason, tokensUsed, costUsedUsd, limits };
}

/** Pauses (or resumes) all AI work for an organization — used as a circuit breaker. */
export async function setOrgAiPaused(options: {
  supabase: Client;
  organizationId: string;
  paused: boolean;
  reason: string | null;
}) {
  const { supabase, organizationId, paused, reason } = options;
  await supabase.from("organization_ai_limits").upsert(
    {
      organization_id: organizationId,
      paused,
      pause_reason: paused ? reason : null,
      paused_at: paused ? new Date().toISOString() : null,
    },
    { onConflict: "organization_id" },
  );
}

/** Resolves the owning organization for a business. */
export async function resolveOrganizationId(supabase: Client, businessId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("organization_id")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Business not found.");
  return data.organization_id;
}
