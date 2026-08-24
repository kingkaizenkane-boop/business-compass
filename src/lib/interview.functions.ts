import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const businessInput = z.object({ businessId: z.string().uuid() });

export const getInterviewState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { loadInterviewState } = await import("./interview.server");
    return loadInterviewState(context.supabase, data.businessId, context.userId);
  });

export const submitInterviewResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        sessionId: z.string().uuid(),
        questionId: z.string().uuid(),
        questionKey: z.string().min(1).max(120),
        questionText: z.string().min(1).max(500),
        answer: z.string().max(5000).optional(),
        action: z.enum(["answer", "skip", "unknown", "check"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { loadInterviewState } = await import("./interview.server");
    const { enqueueJob, kickWorker } = await import("./jobs.server");
    const { supabase, userId } = context;

    const status =
      data.action === "answer"
        ? "answered"
        : data.action === "skip"
          ? "skipped"
          : data.action === "unknown"
            ? "needs_input"
            : "needs_verification";

    const answer = (data.answer ?? "").trim();
    if (status === "answered" && answer.length === 0) {
      throw new Error("An answer is required to continue.");
    }

    // Supersession chain: link this answer to the one it replaces.
    const { data: prior } = await supabase
      .from("interview_responses")
      .select("id")
      .eq("session_id", data.sessionId)
      .eq("question_key", data.questionKey)
      .order("answered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: inserted, error } = await supabase
      .from("interview_responses")
      .insert({
        session_id: data.sessionId,
        question_id: data.questionId,
        question_key: data.questionKey,
        raw_response: answer.length > 0 ? answer : null,
        status,
        confidence: status === "answered" ? 0.9 : null,
        answered_at: new Date().toISOString(),
        supersedes_response_id: prior?.id ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (prior) {
      await supabase
        .from("interview_responses")
        .update({ status: "superseded" })
        .eq("id", prior.id);
    }

    // Extraction is an AI job, never a blocking call in this request.
    let job: Awaited<ReturnType<typeof enqueueJob>> | null = null;
    if (status === "answered") {
      const { data: business } = await supabase
        .from("businesses")
        .select("organization_id")
        .eq("id", data.businessId)
        .maybeSingle();
      if (business?.organization_id) {
        job = await enqueueJob({
          jobType: "interview_extraction",
          organizationId: business.organization_id,
          businessId: data.businessId,
          idempotencyKey: `extract:${inserted.id}`,
          priority: 7,
          input: {
            userId,
            responseId: inserted.id,
            questionKey: data.questionKey,
            questionText: data.questionText,
            answer,
          },
        });
        kickWorker(["interview_extraction"]);
      }
    }

    const state = await loadInterviewState(supabase, data.businessId, userId);
    return { state, job };
  });

export const pauseInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("interview_sessions")
      .update({ status: "paused", paused_at: new Date().toISOString() })
      .eq("id", data.sessionId);
    if (error) throw error;
    return { ok: true };
  });
