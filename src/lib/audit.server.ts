/**
 * Server-only audit trail.
 *
 * Every important mutation in Business OS writes one row to public.audit_logs.
 * Writes are best-effort: an audit failure must never break the user's action,
 * but it is always logged to the server console so it is visible in operations.
 *
 * Never pass secrets, API keys, tokens or raw credentials in `metadata`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/** The closed vocabulary of audited actions. */
export const AUDIT_ACTIONS = [
  "organization.created",
  "business.created",
  "interview.started",
  "interview.response_submitted",
  "brain_fact.created",
  "brain_fact.verified",
  "brain_fact.unverified",
  "brain_fact.superseded",
  "diagnosis.generated",
  "blueprint.generated",
  "action_plan.generated",
  "ai_job.enqueued",
  "ai_job.retried",
  "ai_job.failed",
  "ai_budget.exceeded",
  "ai_limits.updated",
  "ai.resumed",
  "process.created",
  "process.updated",
  "process.activated",
  "process.paused",
  "process.archived",
  "process.execution_started",
  "process.execution_completed",
  "process.execution_failed",
  "process.execution_cancelled",
  "process.approval_requested",
  "process.approval_approved",
  "process.approval_rejected",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
  action: AuditAction;
  organizationId?: string | null;
  businessId?: string | null;
  userId?: string | null;
  /** "user" for a person-initiated action, "system" for worker/job activity. */
  actor?: "user" | "system";
  entity?: string | null;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

const SENSITIVE_KEY = /(secret|password|token|api[_-]?key|authorization|credential)/i;

/** Defensive scrub so a careless caller can never persist a credential. */
function scrub<T extends Record<string, unknown> | null | undefined>(value: T) {
  if (!value) return null;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : raw;
  }
  return out;
}

async function adminClient(): Promise<Client> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Client;
}

/**
 * Writes one audit row. Pass a `supabase` client to reuse the caller's
 * connection; otherwise the privileged client is used (worker/job context).
 */
export async function writeAudit(entry: AuditEntry & { supabase?: Client }): Promise<void> {
  try {
    const db = entry.supabase ?? (await adminClient());
    /** Worker contexts sometimes carry "" instead of an id; uuid columns reject that. */
    const uuid = (value: string | null | undefined) =>
      value && value.trim().length > 0 ? value : null;
    const { error } = await db.from("audit_logs").insert({
      organization_id: uuid(entry.organizationId),
      business_id: uuid(entry.businessId),
      user_id: uuid(entry.userId),
      actor_type: entry.actor ?? "user",
      action: entry.action,
      table_name: entry.entity ?? null,
      record_id: uuid(entry.entityId),
      old_data: scrub(entry.before) as never,
      new_data: scrub(entry.after) as never,
      metadata: (scrub(entry.metadata) ?? {}) as never,
    });
    if (error) console.error("[audit] insert failed", entry.action, error.message);
  } catch (error) {
    console.error("[audit] write threw", entry.action, error);
  }
}

/** Fire-and-forget variant for hot paths that must not wait on the audit write. */
export function auditAsync(entry: AuditEntry & { supabase?: Client }) {
  void writeAudit(entry);
}
