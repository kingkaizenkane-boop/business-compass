/**
 * Server-only Blueprint Engine.
 * Derives the strategic Business Blueprint from the Business Brain plus the latest
 * diagnosis run, validates the AI response, binds every section to Brain evidence
 * and persists an immutable, versioned blueprint. Never imported by client code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { chatJsonResult } from "./ai.server";
import { assertBusinessAccess, assessReadiness, loadBrain } from "./diagnosis.server";
import type { BrainReadiness } from "./diagnosis.server";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/** Section keys map 1:1 onto the business_blueprints columns. */
export const BLUEPRINT_SECTION_KEYS = [
  "positioning",
  "ideal_customer",
  "core_problem",
  "transformation",
  "differentiation",
  "methodology",
  "pricing_strategy",
  "acquisition_strategy",
  "retention_strategy",
  "operating_model",
  "owner_role",
] as const;

export type BlueprintSectionKey = (typeof BLUEPRINT_SECTION_KEYS)[number];

export const BLUEPRINT_SECTION_LABEL: Record<BlueprintSectionKey, string> = {
  positioning: "Positioning",
  ideal_customer: "Ideal customer",
  core_problem: "Core problem",
  transformation: "Transformation",
  differentiation: "Differentiation",
  methodology: "Offer & methodology",
  pricing_strategy: "Pricing strategy",
  acquisition_strategy: "Acquisition strategy",
  retention_strategy: "Retention strategy",
  operating_model: "Operating model",
  owner_role: "Owner role",
};

/* ------------------------------------------------------------------ AI schema */

const sectionSchema = z.object({
  content: z.string().min(1).max(4000),
  rationale: z.string().max(2000).default(""),
  evidence_fact_ids: z.array(z.string()).default([]),
  assumptions: z.array(z.string().max(400)).default([]),
});

const aiSchema = z.object({
  executive_summary: z.string().min(1).max(4000),
  sections: z.object({
    positioning: sectionSchema,
    ideal_customer: sectionSchema,
    core_problem: sectionSchema,
    transformation: sectionSchema,
    differentiation: sectionSchema,
    methodology: sectionSchema,
    pricing_strategy: sectionSchema,
    acquisition_strategy: sectionSchema,
    retention_strategy: sectionSchema,
    operating_model: sectionSchema,
    owner_role: sectionSchema,
  }),
  strategic_priorities: z
    .array(
      z.object({
        title: z.string().min(3).max(200),
        why_now: z.string().max(1000).default(""),
        evidence_fact_ids: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  open_questions: z.array(z.string().min(3).max(500)).default([]),
});

/* ------------------------------------------------------------------ views */

export type BlueprintFactRef = {
  factId: string;
  factKey: string;
  category: string;
  value: string;
  factType: string;
  verified: boolean;
};

export type BlueprintSectionView = {
  key: BlueprintSectionKey;
  label: string;
  content: string | null;
  rationale: string | null;
  assumptions: string[];
  confidence: number | null;
  facts: BlueprintFactRef[];
};

export type BlueprintView = {
  id: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  diagnosisRunId: string | null;
  executiveSummary: string | null;
  confidence: number | null;
  sections: BlueprintSectionView[];
  priorities: { title: string; whyNow: string; facts: BlueprintFactRef[] }[];
  openQuestions: string[];
};

export type BlueprintPayload =
  | {
      status: "ready";
      readiness: BrainReadiness;
      blueprint: BlueprintView;
      history: { id: string; version: number; status: string; createdAt: string }[];
      hasDiagnosis: boolean;
    }
  | {
      status: "empty" | "insufficient";
      readiness: BrainReadiness;
      blueprint: null;
      history: { id: string; version: number; status: string; createdAt: string }[];
      hasDiagnosis: boolean;
    };

/* ------------------------------------------------------------------ helpers */

type FactRow = Awaited<ReturnType<typeof loadBrain>>["facts"][number];

function factValue(fact: FactRow) {
  if (fact.value_text) return fact.value_text;
  if (fact.value_number != null) return String(fact.value_number);
  return "—";
}

function toRef(fact: FactRow): BlueprintFactRef {
  return {
    factId: fact.id,
    factKey: fact.fact_key,
    category: fact.category,
    value: factValue(fact),
    factType: fact.fact_type,
    verified: fact.verified,
  };
}

function sectionConfidence(refs: FactRow[]) {
  if (refs.length === 0) return 25;
  const base =
    refs.reduce((sum, f) => sum + Number(f.confidence) * (f.verified ? 1 : 0.85), 0) / refs.length;
  const volume = Math.min(1, refs.length / 3);
  return Math.round(Math.max(0, Math.min(100, base * 100 * (0.78 + 0.22 * volume))));
}

function buildBrainDigest(facts: FactRow[]) {
  return facts
    .map(
      (f) =>
        `- id=${f.id} [${f.verified ? "VERIFIED" : f.fact_type.toUpperCase()}] (${f.category}${f.subcategory ? "/" + f.subcategory : ""}) ${f.fact_key}: ${factValue(f)}`,
    )
    .join("\n");
}

const SYSTEM_PROMPT = [
  "You are the Business OS Strategy Intelligence. You write a working Business Blueprint, not a generic business plan.",
  "You may only use the supplied Business Brain facts and Diagnosis findings. Anything the Brain does not support is UNKNOWN.",
  "Every section MUST reference the id values of the Brain facts it relies on in evidence_fact_ids, copied verbatim. Ids you were not given are forbidden.",
  "Where a section cannot be grounded in facts, say plainly what is still unknown and list what you assumed in assumptions.",
  "Write in the owner's language: concrete, specific to this business, no filler, no consultant jargon, no invented numbers.",
  "The blueprint must directly answer the constraints named in the diagnosis. Acquisition, retention and operating model sections must be actionable.",
  "Each section content is 2-5 sentences of prose. rationale explains why this is the right call for this business.",
  "Return ONLY JSON matching the requested shape.",
].join("\n");

const SHAPE = `{
  "executive_summary": string,
  "sections": {
    "positioning": { "content": string, "rationale": string, "evidence_fact_ids": string[], "assumptions": string[] },
    "ideal_customer": { ... }, "core_problem": { ... }, "transformation": { ... }, "differentiation": { ... },
    "methodology": { ... }, "pricing_strategy": { ... }, "acquisition_strategy": { ... },
    "retention_strategy": { ... }, "operating_model": { ... }, "owner_role": { ... }
  },
  "strategic_priorities": [{ "title": string, "why_now": string, "evidence_fact_ids": string[] }],
  "open_questions": string[]
}`;

/* ------------------------------------------------------------------ generate */

export async function generateBlueprint(options: {
  supabase: Client;
  businessId: string;
  userId: string;
}): Promise<BlueprintPayload> {
  const { supabase, businessId } = options;
  const business = await assertBusinessAccess(supabase, businessId);
  const { facts } = await loadBrain(supabase, businessId);
  const readiness = assessReadiness(facts);

  if (!readiness.ready) {
    const history = await loadHistory(supabase, businessId);
    return { status: "insufficient", readiness, blueprint: null, history, hasDiagnosis: false };
  }

  const { data: runRow } = await supabase
    .from("diagnosis_runs")
    .select("id, overall_score, summary, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let diagnosisDigest = "No diagnosis run exists yet.";
  if (runRow) {
    const { data: itemRows } = await supabase
      .from("diagnosis_items")
      .select("category, title, description, recommendation, priority_score, priority_level, evidence")
      .eq("diagnosis_run_id", runRow.id)
      .order("priority_score", { ascending: false, nullsFirst: false })
      .limit(40);
    diagnosisDigest = [
      `Overall health score: ${runRow.overall_score ?? "unknown"}`,
      runRow.summary ? `Summary: ${runRow.summary}` : "",
      ...(itemRows ?? []).map((item) => {
        const meta = (item.evidence ?? {}) as Record<string, unknown>;
        const kind = typeof meta["kind"] === "string" ? meta["kind"] : "constraint";
        return `- [${kind}${item.priority_level ? "/" + item.priority_level : ""}] (${item.category}) ${item.title}: ${item.description ?? ""}${item.recommendation ? ` | direction: ${item.recommendation}` : ""}`;
      }),
    ]
      .filter(Boolean)
      .join("\n");
  }

  const aiResult = await chatJsonResult<unknown>({
    maxTokens: 9000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `BUSINESS: ${business.name}`,
          `Industry: ${business.industry ?? "unknown"} | Model: ${business.business_model ?? "unknown"} | Customers: ${business.customer_model ?? "unknown"} | Team size: ${business.employee_count ?? "unknown"}`,
          business.description ? `Description: ${business.description}` : "",
          "",
          `BRAIN COVERAGE: ${readiness.coverage}% (${readiness.factCount} facts, ${readiness.verifiedCount} verified)`,
          readiness.missingMetrics.length > 0
            ? `NUMBERS STILL UNKNOWN: ${readiness.missingMetrics.join(", ")}`
            : "",
          "",
          "BUSINESS BRAIN FACTS:",
          buildBrainDigest(facts),
          "",
          "LATEST DIAGNOSIS:",
          diagnosisDigest,
          "",
          "Produce the Business Blueprint as JSON in exactly this shape:",
          SHAPE,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  if (!aiResult.ok) throw new Error(aiResult.reason);

  const parsed = aiSchema.safeParse(aiResult.data);
  if (!parsed.success) {
    console.error("[blueprint] schema mismatch", parsed.error.issues.slice(0, 6));
    throw new Error("The blueprint came back in an unexpected shape. Please try again.");
  }
  const output = parsed.data;

  const factById = new Map(facts.map((f) => [f.id, f]));
  const resolve = (ids: string[]) =>
    ids.map((id) => factById.get(id)).filter((f): f is FactRow => f !== undefined);

  const sectionMeta: Record<string, unknown> = {};
  const columnValues: Record<string, string> = {};
  let confidenceTotal = 0;

  for (const key of BLUEPRINT_SECTION_KEYS) {
    const section = output.sections[key];
    const refs = resolve(section.evidence_fact_ids);
    const confidence = sectionConfidence(refs);
    confidenceTotal += confidence;
    columnValues[key] = section.content;
    sectionMeta[key] = {
      rationale: section.rationale || null,
      assumptions: section.assumptions,
      confidence,
      facts: refs.map(toRef),
    };
  }

  const confidence = Math.round(confidenceTotal / BLUEPRINT_SECTION_KEYS.length);

  const priorities = output.strategic_priorities.map((p) => ({
    title: p.title,
    why_now: p.why_now,
    facts: resolve(p.evidence_fact_ids).map(toRef),
  }));

  const openQuestions = [
    ...output.open_questions,
    ...readiness.missingMetrics.map((label) => `${label} is still unknown.`),
  ];

  /* Blueprints are read-only to app users: verify access via RLS, then write with
     the service role. */
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: latest } = await supabaseAdmin
    .from("business_blueprints")
    .select("version")
    .eq("business_id", businessId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (latest?.version ?? 0) + 1;

  await supabaseAdmin
    .from("business_blueprints")
    .update({ status: "superseded" })
    .eq("business_id", businessId)
    .eq("status", "active");

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("business_blueprints")
    .insert({
      business_id: businessId,
      diagnosis_run_id: runRow?.id ?? null,
      version,
      status: "active",
      executive_summary: output.executive_summary,
      positioning: columnValues["positioning"]!,
      ideal_customer: columnValues["ideal_customer"]!,
      core_problem: columnValues["core_problem"]!,
      transformation: columnValues["transformation"]!,
      differentiation: columnValues["differentiation"]!,
      methodology: columnValues["methodology"]!,
      pricing_strategy: columnValues["pricing_strategy"]!,
      acquisition_strategy: columnValues["acquisition_strategy"]!,
      retention_strategy: columnValues["retention_strategy"]!,
      operating_model: columnValues["operating_model"]!,
      owner_role: columnValues["owner_role"]!,
      blueprint_data: {
        confidence,
        brain_facts: readiness.factCount,
        sections: sectionMeta,
        priorities,
        open_questions: openQuestions,
      },
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  await supabaseAdmin.rpc("write_audit_log", {
    target_business: businessId,
    action_name: "blueprint.generate",
    target_table: "business_blueprints",
    target_record: inserted.id,
    old_value: null,
    new_value: { version, confidence, diagnosis_run_id: runRow?.id ?? null },
    actor: "ai",
  });

  return loadBlueprint(supabase, businessId, inserted.id, readiness);
}

/* ------------------------------------------------------------------ read */

async function loadHistory(supabase: Client, businessId: string) {
  const { data } = await supabase
    .from("business_blueprints")
    .select("id, version, status, created_at")
    .eq("business_id", businessId)
    .order("version", { ascending: false })
    .limit(12);
  return (data ?? []).map((row) => ({
    id: row.id,
    version: row.version,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function loadBlueprint(
  supabase: Client,
  businessId: string,
  blueprintId: string | null,
  readiness: BrainReadiness,
): Promise<BlueprintPayload> {
  const history = await loadHistory(supabase, businessId);

  const { data: runRow } = await supabase
    .from("diagnosis_runs")
    .select("id")
    .eq("business_id", businessId)
    .limit(1)
    .maybeSingle();
  const hasDiagnosis = Boolean(runRow);

  const targetId = blueprintId ?? history[0]?.id ?? null;
  if (!targetId) {
    return {
      status: readiness.ready ? "empty" : "insufficient",
      readiness,
      blueprint: null,
      history,
      hasDiagnosis,
    };
  }

  const { data: row, error } = await supabase
    .from("business_blueprints")
    .select("*")
    .eq("id", targetId)
    .maybeSingle();
  if (error) throw error;
  if (!row) {
    return {
      status: readiness.ready ? "empty" : "insufficient",
      readiness,
      blueprint: null,
      history,
      hasDiagnosis,
    };
  }

  const meta = (row.blueprint_data ?? {}) as Record<string, unknown>;
  const sectionMeta = (meta["sections"] ?? {}) as Record<string, Record<string, unknown>>;

  const sections: BlueprintSectionView[] = BLUEPRINT_SECTION_KEYS.map((key) => {
    const info = sectionMeta[key] ?? {};
    return {
      key,
      label: BLUEPRINT_SECTION_LABEL[key],
      content: (row as Record<string, unknown>)[key] as string | null,
      rationale: typeof info["rationale"] === "string" ? info["rationale"] : null,
      assumptions: Array.isArray(info["assumptions"]) ? (info["assumptions"] as string[]) : [],
      confidence: typeof info["confidence"] === "number" ? info["confidence"] : null,
      facts: Array.isArray(info["facts"]) ? (info["facts"] as BlueprintFactRef[]) : [],
    };
  });

  const priorities = (Array.isArray(meta["priorities"]) ? meta["priorities"] : []).map((raw) => {
    const p = raw as Record<string, unknown>;
    return {
      title: typeof p["title"] === "string" ? p["title"] : "",
      whyNow: typeof p["why_now"] === "string" ? p["why_now"] : "",
      facts: Array.isArray(p["facts"]) ? (p["facts"] as BlueprintFactRef[]) : [],
    };
  });

  return {
    status: "ready",
    readiness,
    hasDiagnosis,
    history,
    blueprint: {
      id: row.id,
      version: row.version,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      diagnosisRunId: row.diagnosis_run_id,
      executiveSummary: row.executive_summary,
      confidence: typeof meta["confidence"] === "number" ? meta["confidence"] : null,
      sections,
      priorities,
      openQuestions: Array.isArray(meta["open_questions"]) ? (meta["open_questions"] as string[]) : [],
    },
  };
}
