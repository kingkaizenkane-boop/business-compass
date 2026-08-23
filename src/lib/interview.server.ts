/**
 * Server-only interview engine: session resolution, progress maths and
 * brain-fact extraction. Never imported by client code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { chatJson } from "./ai.server";
import type { Database } from "@/integrations/supabase/types";

export type Client = SupabaseClient<Database>;

export type InterviewQuestion = {
  id: string;
  questionKey: string;
  questionText: string;
  questionType: string;
  helpText: string | null;
  required: boolean;
  stageKey: string;
  stageName: string;
  stageSequence: number;
};

export type InterviewStageProgress = {
  stageKey: string;
  name: string;
  sequence: number;
  total: number;
  answered: number;
};

export type PendingItem = {
  questionKey: string;
  questionText: string;
  status: string;
};

export type AnsweredItem = {
  questionKey: string;
  questionText: string;
  response: string;
  answeredAt: string;
};

export type InterviewState = {
  sessionId: string;
  status: string;
  progressPercent: number;
  coverageScore: number;
  answeredCount: number;
  totalQuestions: number;
  currentQuestion: InterviewQuestion | null;
  stages: InterviewStageProgress[];
  pending: PendingItem[];
  recent: AnsweredItem[];
};

type QuestionRow = {
  id: string;
  question_key: string;
  question_text: string;
  question_type: string;
  help_text: string | null;
  required: boolean;
  sequence: number | null;
  stage_id: string;
};

const CLOSED_STATUSES = new Set(["answered", "skipped"]);

export async function loadInterviewState(
  supabase: Client,
  businessId: string,
  userId: string,
): Promise<InterviewState> {
  const sessionId = await resolveSessionId(supabase, businessId, userId);

  const [{ data: stageRows, error: stageError }, { data: responseRows, error: responseError }] =
    await Promise.all([
      supabase
        .from("interview_stages")
        .select("id, stage_key, name, sequence, template_id")
        .order("sequence", { ascending: true }),
      supabase
        .from("interview_responses")
        .select("question_key, raw_response, status, answered_at")
        .eq("session_id", sessionId)
        .order("answered_at", { ascending: true }),
    ]);

  if (stageError) throw stageError;
  if (responseError) throw responseError;

  const stages = stageRows ?? [];
  const stageIds = stages.map((s) => s.id);

  const { data: questionRows, error: questionError } = await supabase
    .from("interview_questions")
    .select("id, question_key, question_text, question_type, help_text, required, sequence, stage_id")
    .in("stage_id", stageIds.length > 0 ? stageIds : ["00000000-0000-0000-0000-000000000000"])
    .order("sequence", { ascending: true });
  if (questionError) throw questionError;

  const questions = (questionRows ?? []) as QuestionRow[];
  const stageById = new Map(stages.map((s) => [s.id, s]));

  const ordered = [...questions].sort((a, b) => {
    const sa = stageById.get(a.stage_id)?.sequence ?? 0;
    const sb = stageById.get(b.stage_id)?.sequence ?? 0;
    if (sa !== sb) return sa - sb;
    return (a.sequence ?? 0) - (b.sequence ?? 0);
  });

  // Latest status per question key.
  const statusByKey = new Map<string, { status: string; response: string | null; at: string }>();
  for (const row of responseRows ?? []) {
    statusByKey.set(row.question_key, {
      status: row.status,
      response: row.raw_response,
      at: row.answered_at,
    });
  }

  const answeredCount = ordered.filter(
    (q) => statusByKey.get(q.question_key)?.status === "answered",
  ).length;
  const closedCount = ordered.filter((q) =>
    CLOSED_STATUSES.has(statusByKey.get(q.question_key)?.status ?? ""),
  ).length;

  const nextQuestion =
    ordered.find((q) => !CLOSED_STATUSES.has(statusByKey.get(q.question_key)?.status ?? "")) ?? null;

  const requiredTotal = ordered.filter((q) => q.required).length;
  const requiredAnswered = ordered.filter(
    (q) => q.required && statusByKey.get(q.question_key)?.status === "answered",
  ).length;

  const totalQuestions = ordered.length;
  const progressPercent = totalQuestions === 0 ? 0 : round1((closedCount / totalQuestions) * 100);
  const coverageScore = requiredTotal === 0 ? 0 : round1((requiredAnswered / requiredTotal) * 100);

  const stageProgress: InterviewStageProgress[] = stages.map((stage) => {
    const stageQuestions = ordered.filter((q) => q.stage_id === stage.id);
    return {
      stageKey: stage.stage_key,
      name: stage.name,
      sequence: stage.sequence,
      total: stageQuestions.length,
      answered: stageQuestions.filter(
        (q) => statusByKey.get(q.question_key)?.status === "answered",
      ).length,
    };
  });

  const pending: PendingItem[] = ordered
    .filter((q) => {
      const status = statusByKey.get(q.question_key)?.status;
      return status === "needs_input" || status === "needs_verification";
    })
    .map((q) => ({
      questionKey: q.question_key,
      questionText: q.question_text,
      status: statusByKey.get(q.question_key)?.status ?? "needs_input",
    }));

  const recent: AnsweredItem[] = ordered
    .filter((q) => statusByKey.get(q.question_key)?.status === "answered")
    .slice(-5)
    .reverse()
    .map((q) => {
      const entry = statusByKey.get(q.question_key)!;
      return {
        questionKey: q.question_key,
        questionText: q.question_text,
        response: entry.response ?? "",
        answeredAt: entry.at,
      };
    });

  const stageForNext = nextQuestion ? stageById.get(nextQuestion.stage_id) : undefined;
  const status = nextQuestion === null && totalQuestions > 0 ? "completed" : "in_progress";

  await supabase
    .from("interview_sessions")
    .update({
      current_stage: stageForNext?.stage_key ?? null,
      current_question_key: nextQuestion?.question_key ?? null,
      progress_percent: progressPercent,
      coverage_score: coverageScore,
      status: status as Database["public"]["Enums"]["interview_status"],
      last_activity_at: new Date().toISOString(),
      ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", sessionId);

  return {
    sessionId,
    status,
    progressPercent,
    coverageScore,
    answeredCount,
    totalQuestions,
    currentQuestion:
      nextQuestion && stageForNext
        ? {
            id: nextQuestion.id,
            questionKey: nextQuestion.question_key,
            questionText: nextQuestion.question_text,
            questionType: nextQuestion.question_type,
            helpText: nextQuestion.help_text,
            required: nextQuestion.required,
            stageKey: stageForNext.stage_key,
            stageName: stageForNext.name,
            stageSequence: stageForNext.sequence,
          }
        : null,
    stages: stageProgress,
    pending,
    recent,
  };
}

async function resolveSessionId(supabase: Client, businessId: string, userId: string) {
  const { data: existing, error } = await supabase
    .from("interview_sessions")
    .select("id")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.id;

  const { data: template } = await supabase
    .from("interview_templates")
    .select("id")
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error: createError } = await supabase
    .from("interview_sessions")
    .insert({
      business_id: businessId,
      user_id: userId,
      template_id: template?.id ?? null,
      status: "in_progress",
      started_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (createError) throw createError;
  return created.id;
}

type ExtractedFact = {
  category?: string;
  subcategory?: string | null;
  fact_key?: string;
  value_text?: string | null;
  value_number?: number | null;
  fact_type?: string;
  confidence?: number;
};

const FACT_TYPES = new Set([
  "fact",
  "claim",
  "inference",
  "assumption",
  "goal",
  "preference",
  "metric",
  "observation",
]);

export async function extractFactsFromResponse(options: {
  supabase: Client;
  businessId: string;
  userId: string;
  questionKey: string;
  questionText: string;
  answer: string;
}) {
  const { supabase, businessId, userId, questionKey, questionText, answer } = options;

  const { data: evidence } = await supabase
    .from("evidence")
    .insert({
      business_id: businessId,
      evidence_type: "conversation",
      title: questionText.slice(0, 180),
      content_text: answer,
      metadata: { question_key: questionKey },
      created_by: userId,
    })
    .select("id")
    .single();

  const extracted = await chatJson<{ facts?: ExtractedFact[] }>({
    messages: [
      {
        role: "system",
        content: [
          "You extract structured business facts from an owner's own words.",
          "Return JSON: { \"facts\": [ { category, subcategory, fact_key, value_text, value_number, fact_type, confidence } ] }.",
          "category is one of: identity, offers, customers, marketing, sales, operations, people, economics, technology, goals, constraints.",
          "fact_key is snake_case and specific, e.g. monthly_revenue_estimate.",
          "fact_type: 'fact' when the owner stated it plainly, 'claim' when unverified opinion, 'metric' for numbers, 'goal' for intent, 'inference' only when you derived it.",
          "value_number only for clean numeric values. confidence is 0-1.",
          "Never invent information that is not supported by the answer. Return at most 6 facts.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Question: ${questionText}\nAnswer: ${answer}`,
      },
    ],
  });

  const facts = (extracted?.facts ?? []).filter((f) => f.fact_key && (f.value_text || f.value_number != null));
  if (facts.length === 0) return 0;

  const rows = facts.slice(0, 6).map((fact) => {
    const confidence = clamp(fact.confidence ?? 0.7);
    const factType = FACT_TYPES.has(fact.fact_type ?? "") ? fact.fact_type! : "fact";
    return {
      business_id: businessId,
      category: fact.category ?? "identity",
      subcategory: fact.subcategory ?? null,
      fact_key: fact.fact_key!,
      value_text: fact.value_text ?? null,
      value_number: fact.value_number ?? null,
      fact_type: factType as Database["public"]["Enums"]["fact_type"],
      confidence,
      confidence_level: confidenceLevel(confidence),
      verified: false,
      active: true,
      source_type: "conversation" as const,
      source_id: evidence?.id ?? null,
      created_by: userId,
    };
  });

  const { error } = await supabase.from("brain_facts").insert(rows);
  if (error) {
    console.error("[interview] fact insert failed", error.message);
    return 0;
  }
  return rows.length;
}

function confidenceLevel(value: number): Database["public"]["Enums"]["confidence_level"] {
  if (value >= 0.9) return "very_high";
  if (value >= 0.75) return "high";
  if (value >= 0.5) return "medium";
  if (value >= 0.25) return "low";
  return "very_low";
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
