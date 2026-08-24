import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Bounded AI job worker. Called every minute by the database scheduler.
 *
 * Auth: either the platform cron secret, or the scheduler token whose SHA-256
 * hash lives in public.cron_job_config (service-role only). The raw scheduler
 * token exists solely inside the database's scheduled command, so it never
 * appears in this repository or in any client bundle.
 *
 * Each run drains at most a small batch, so this endpoint can never turn into
 * an unbounded request storm.
 */
async function authenticateSchedulerToken(request: Request): Promise<boolean> {
  const match = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token) return false;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("cron_job_config")
    .select("token_hash, enabled")
    .eq("name", "ai-jobs-worker")
    .maybeSingle();
  if (!data?.enabled || !data.token_hash) return false;

  const { createHash, timingSafeEqual } = await import("node:crypto");
  const provided = createHash("sha256").update(token, "utf8").digest("hex");
  const expected = data.token_hash;
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export const Route = createFileRoute("/api/public/ai-jobs-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const schedulerOk = await authenticateSchedulerToken(request).catch(() => false);
        if (!schedulerOk) {
          const denied = await authenticateCronRequest(request);
          if (denied) return denied;
        }

        const { drainAiJobs } = await import("@/lib/jobs.server");
        try {
          const summary = await drainAiJobs({ limit: 5, workerId: "cron" });
          return Response.json({ ok: true, ...summary });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Worker failed";
          console.error("[ai-jobs-worker]", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
