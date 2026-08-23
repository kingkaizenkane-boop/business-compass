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
    const { loadInterviewState, extractFactsFromResponse } = await import("./interview.server");
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

    const { error } = await supabase.from("interview_responses").insert({
      session_id: data.sessionId,
      question_id: data.questionId,
      question_key: data.questionKey,
      raw_response: answer.length > 0 ? answer : null,
      status,
      confidence: status === "answered" ? 0.9 : null,
      answered_at: new Date().toISOString(),
    });
    if (error) throw error;

    let factsAdded = 0;
    if (status === "answered") {
      factsAdded = await extractFactsFromResponse({
        supabase,
        businessId: data.businessId,
        userId,
        questionKey: data.questionKey,
        questionText: data.questionText,
        answer,
      });
    }

    const state = await loadInterviewState(supabase, data.businessId, userId);
    return { state, factsAdded };
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
