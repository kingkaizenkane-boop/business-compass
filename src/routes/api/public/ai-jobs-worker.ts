import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Bounded AI job worker. Called by the scheduler.
 * Auth: cron bearer secret. Each run drains at most a small batch, so the
 * endpoint can never turn into an unbounded request storm.
 */
export const Route = createFileRoute("/api/public/ai-jobs-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

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
