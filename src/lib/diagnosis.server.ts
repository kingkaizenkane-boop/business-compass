/**
 * Server-only Diagnosis Engine.
 * Reads the Business Brain (facts + evidence), packages a diagnostic brief for the
 * existing AI gateway, validates the response, computes all final scores server-side
 * and persists an immutable diagnosis run. Never imported by client code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { chatJson } from "./ai.server";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
type CategoryEnum = Database["public"]["Enums"]["diagnosis_category"];
type PriorityLevel = Database["public"]["Enums"]["priority_level"];

/** Product-facing categories (spec) mapped onto the existing DB enum. */
export const DIAGNOSIS_CATEGORY_MAP: Record<string, CategoryEnum> = {
  revenue: "revenue",
  marketing: "marketing",
  sales: "sales",
  conversion: "conversion",
  retention: "retention",
  operations: "operations",
  finance: "finance",
  automation: "automation",
  "owner dependency": "people",
  owner_dependency: "people",
  people: "people",
  growth: "growth",
  seo: "seo",
  strategy: "strategy",
};

export const DIAGNOSIS_CATEGORY_LABEL: Record<string, string> = {
  revenue: "Revenue",
  marketing: "Marketing",
  sales: "Sales",
  conversion: "Conversion",
  retention: "Retention",
  operations: "Operations",
  finance: "Finance",
  automation: "Automation",
  people: "Owner dependency",
  growth: "Growth",
  seo: "SEO",
  strategy: "Strategy",
  time: "Time",
  technology: "Technology",
  customer_experience: "Customer experience",
};

const CRITICAL_METRICS = [
  { key: "monthly_revenue", label: "Monthly revenue", match: ["revenue"] },
  { key: "average_order_value", label: "Average order value", match: ["order_value", "aov", "average_sale"] },
  {
    key: "customer_acquisition_cost",
    label: "Customer acquisition cost",
    match: ["acquisition_cost", "cac"],
  },
  { key: "conversion_rate", label: "Conversion rate", match: ["conversion"] },
  { key: "retention", label: "Customer retention / repeat rate", match: ["retention", "repeat"] },
  { key: "capacity", label: "Delivery capacity", match: ["capacity", "utilisation", "utilization"] },
  { key: "owner_hours", label: "Owner working hours", match: ["owner_hours", "working_hours", "hours_per_week"] },
  { key: "lead_volume", label: "Monthly lead volume", match: ["lead", "enquir", "inquir"] },
];

/* ------------------------------------------------------------------ AI schema */

const scoreSchema = z.coerce.number().min(0).max(100);

const itemSchema = z.object({
  category: z.string().min(1),
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(2000),
  root_cause: z.string().max(2000).nullish(),
  impact: scoreSchema,
  urgency: scoreSchema,
  confidence: scoreSchema,
  effort: scoreSchema,
  opportunity: scoreSchema.nullish(),
  evidence_fact_ids: z.array(z.string()).default([]),
  recommended_direction: z.string().max(2000).nullish(),
});

const aiSchema = z.object({
  executive_summary: z.string().min(1).max(4000),
  business_health_score: scoreSchema,
  confidence_score: scoreSchema,
  strengths: z
    .array(
      z.object({
        title: z.string().min(3).max(200),
        description: z.string().max(2000).default(""),
        evidence_fact_ids: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  critical_constraints: z.array(itemSchema).default([]),
  opportunities: z.array(itemSchema).default([]),
  information_gaps: z
    .array(
      z.object({
        category: z.string().default("strategy"),
        question: z.string().min(3).max(500),
        reason: z.string().max(1000).default(""),
        importance: scoreSchema.default(50),
      }),
    )
    .default([]),
  contradictions: z
    .array(
      z.object({
        fact_ids: z.array(z.string()).default([]),
        description: z.string().min(3).max(1000),
        resolution_question: z.string().max(500).default(""),
      }),
    )
    .default([]),
});

/* ------------------------------------------------------------------ types out */

export type DiagnosisItemView = {
  id: string;
  kind: "constraint" | "opportunity" | "strength" | "information_gap" | "contradiction";
  category: string;
  categoryLabel: string;
  title: string;
  description: string | null;
  rootCause: string | null;
  recommendation: string | null;
  impact: number | null;
  urgency: number | null;
  confidence: number | null;
  effort: number | null;
  priority: number | null;
  priorityLevel: PriorityLevel | null;
  evidence: EvidenceRef[];
  resolutionQuestion: string | null;
  evidenceNote: string | null;
};

export type EvidenceRef = {
  factId: string;
  factKey: string;
  category: string;
  value: string;
  factType: string;
  verified: boolean;
  confidence: number;
  quality: "verified" | "stated" | "claimed" | "inferred" | "assumed";
};

export type DiagnosisRunView = {
  id: string;
  createdAt: string;
  overallScore: number | null;
  confidenceScore: number | null;
  summary: string | null;
  categoryScores: { category: string; label: string; score: number | null }[];
};

export type BrainReadiness = {
  factCount: number;
  verifiedCount: number;
  categoryCount: number;
  coverage: number;
  ready: boolean;
  missingCategories: string[];
  missingMetrics: string[];
};

const REQUIRED_BRAIN_CATEGORIES = [
  "identity",
  "offers",
  "customers",
  "marketing",
  "sales",
  "operations",
  "economics",
];

const MIN_FACTS = 10;
const MIN_CATEGORIES = 3;

/* ------------------------------------------------------------------ access */

export async function assertBusinessAccess(supabase: Client, businessId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, industry, business_model, customer_model, description, employee_count, founded_year")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("You do not have access to this business.");
  return data;
}

/* ------------------------------------------------------------------ readiness */

type FactRow = {
  id: string;
  category: string;
  subcategory: string | null;
  fact_key: string;
  value_text: string | null;
  value_number: number | null;
  fact_type: string;
  confidence: number;
  verified: boolean;
  created_at: string;
};

export async function loadBrain(supabase: Client, businessId: string) {
  const [{ data: facts, error: factError }, { data: evidence, error: evidenceError }] = await Promise.all([
    supabase
      .from("brain_facts")
      .select(
        "id, category, subcategory, fact_key, value_text, value_number, fact_type, confidence, verified, created_at",
      )
      .eq("business_id", businessId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("evidence")
      .select("id, evidence_type, title, content_text, created_at, verified")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  if (factError) throw factError;
  if (evidenceError) throw evidenceError;
  return { facts: (facts ?? []) as FactRow[], evidence: evidence ?? [] };
}

export function assessReadiness(facts: FactRow[]): BrainReadiness {
  const categories = new Set(facts.map((f) => f.category));
  const missingCategories = REQUIRED_BRAIN_CATEGORIES.filter((c) => !categories.has(c));

  const haystack = facts.map((f) => `${f.fact_key} ${f.subcategory ?? ""}`.toLowerCase());
  const missingMetrics = CRITICAL_METRICS.filter(
    (metric) => !haystack.some((key) => metric.match.some((m) => key.includes(m))),
  ).map((m) => m.label);

  const factScore = Math.min(1, facts.length / 45);
  const categoryScore = categories.size / REQUIRED_BRAIN_CATEGORIES.length;
  const coverage = Math.round(Math.min(1, factScore * 0.55 + Math.min(1, categoryScore) * 0.45) * 100);

  return {
    factCount: facts.length,
    verifiedCount: facts.filter((f) => f.verified).length,
    categoryCount: categories.size,
    coverage,
    ready: facts.length >= MIN_FACTS && categories.size >= MIN_CATEGORIES,
    missingCategories,
    missingMetrics,
  };
}

/* ------------------------------------------------------------------ scoring */

function factQuality(fact: FactRow): EvidenceRef["quality"] {
  if (fact.verified) return "verified";
  if (fact.fact_type === "assumption") return "assumed";
  if (fact.fact_type === "inference") return "inferred";
  if (fact.fact_type === "claim") return "claimed";
  return "stated";
}

const QUALITY_WEIGHT: Record<EvidenceRef["quality"], number> = {
  verified: 1,
  stated: 0.82,
  claimed: 0.68,
  inferred: 0.5,
  assumed: 0.32,
};

function recencyWeight(createdAt: string) {
  const days = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  if (days <= 30) return 1;
  if (days <= 90) return 0.9;
  if (days <= 240) return 0.78;
  return 0.65;
}

/** Server-computed confidence: evidence quality, volume, verification, recency, AI signal. */
function computeConfidence(aiConfidence: number, refs: { fact: FactRow; quality: EvidenceRef["quality"] }[]) {
  if (refs.length === 0) return Math.min(35, Math.round(aiConfidence * 0.35));

  const evidenceScore =
    refs.reduce(
      (sum, r) => sum + QUALITY_WEIGHT[r.quality] * recencyWeight(r.fact.created_at) * Number(r.fact.confidence),
      0,
    ) / refs.length;

  const volumeBonus = Math.min(1, refs.length / 3);
  const base = evidenceScore * 100;
  const blended = base * 0.65 + aiConfidence * 0.35;
  const capped = blended * (0.75 + 0.25 * volumeBonus);
  return Math.round(Math.max(0, Math.min(100, capped)));
}

/** Transparent priority model — never supplied by the AI. */
export function computePriority(input: {
  impact: number;
  urgency: number;
  confidence: number;
  opportunity: number;
  effort: number;
}) {
  const weighted =
    input.impact * 0.35 + input.urgency * 0.25 + input.confidence * 0.2 + input.opportunity * 0.2;
  const effortPenalty = (input.effort / 100) * 18;
  return Math.round(Math.max(0, Math.min(100, weighted - effortPenalty)));
}

function priorityLevel(score: number): PriorityLevel {
  if (score >= 80) return "critical";
  if (score >= 62) return "high";
  if (score >= 42) return "medium";
  return "low";
}

function factValue(fact: FactRow) {
  if (fact.value_text) return fact.value_text;
  if (fact.value_number != null) return String(fact.value_number);
  return "—";
}

/* ------------------------------------------------------------------ prompt */

function buildBrainDigest(facts: FactRow[]) {
  return facts
    .map((f) => {
      const status = f.verified ? "VERIFIED" : f.fact_type.toUpperCase();
      return `- id=${f.id} [${status}] (${f.category}${f.subcategory ? "/" + f.subcategory : ""}) ${f.fact_key}: ${factValue(f)} (confidence ${Math.round(Number(f.confidence) * 100)}%)`;
    })
    .join("\n");
}

const SYSTEM_PROMPT = [
  "You are the Business OS Diagnostic Intelligence. You are not a generic business consultant.",
  "You diagnose ONLY from the supplied Business Brain. If the Brain does not support a claim, it is UNKNOWN.",
  "Classify every statement you rely on as FACT, INFERENCE, ASSUMPTION, UNKNOWN or CONFLICT.",
  "Never invent evidence. Every constraint and opportunity MUST reference the id values of supporting Brain facts in evidence_fact_ids, copied verbatim from the input. Fact ids you did not receive are forbidden.",
  "Prioritise constraints that materially affect revenue, growth, customer acquisition, conversion, retention, operations, owner freedom, profitability or scalability.",
  "Look for ROOT CAUSES, not symptoms. 'Revenue is inconsistent' is a symptom; 'there is no repeatable acquisition system because most leads come from personal referrals' is a root cause.",
  "Prefer a small number of high-confidence, high-impact diagnoses (3-5 constraints, 3-5 opportunities) over long generic lists.",
  "Flag contradictions between facts instead of silently choosing one side.",
  "Never fabricate numbers. If a critical number is missing, raise it as an information gap.",
  "category must be exactly one of: Revenue, Marketing, Sales, Conversion, Retention, Operations, Finance, Automation, Owner dependency, Growth, SEO.",
  "impact, urgency, confidence, effort and opportunity are 0-100 component assessments. Do not output any final priority score.",
  "Return ONLY JSON matching the requested shape.",
].join("\n");

const SHAPE = `{
  "executive_summary": string,
  "business_health_score": number,
  "confidence_score": number,
  "strengths": [{ "title": string, "description": string, "evidence_fact_ids": string[] }],
  "critical_constraints": [{ "category": string, "title": string, "description": string, "root_cause": string, "impact": number, "urgency": number, "confidence": number, "effort": number, "opportunity": number, "evidence_fact_ids": string[], "recommended_direction": string }],
  "opportunities": [ same shape as critical_constraints ],
  "information_gaps": [{ "category": string, "question": string, "reason": string, "importance": number }],
  "contradictions": [{ "fact_ids": string[], "description": string, "resolution_question": string }]
}`;

/* ------------------------------------------------------------------ run */

export async function runDiagnosisEngine(options: {
  supabase: Client;
  businessId: string;
  userId: string;
}) {
  const { supabase, businessId } = options;
  const business = await assertBusinessAccess(supabase, businessId);
  const { facts, evidence } = await loadBrain(supabase, businessId);
  const readiness = assessReadiness(facts);

  if (!readiness.ready) {
    return { status: "insufficient" as const, readiness, run: null, items: [] as DiagnosisItemView[] };
  }

  const factById = new Map(facts.map((f) => [f.id, f]));

  const ai = await chatJson<unknown>({
    maxTokens: 4000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `BUSINESS: ${business.name}`,
          `Industry: ${business.industry ?? "unknown"} | Model: ${business.business_model ?? "unknown"} | Customers: ${business.customer_model ?? "unknown"} | Team size: ${business.employee_count ?? "unknown"}`,
          business.description ? `Description: ${business.description}` : "",
          "",
          `BRAIN COVERAGE: ${readiness.coverage}% (${readiness.factCount} active facts, ${readiness.verifiedCount} verified, ${readiness.categoryCount} categories)`,
          readiness.missingCategories.length > 0
            ? `BRAIN CATEGORIES WITH NO FACTS: ${readiness.missingCategories.join(", ")}`
            : "",
          readiness.missingMetrics.length > 0
            ? `CRITICAL NUMBERS ABSENT FROM THE BRAIN: ${readiness.missingMetrics.join(", ")}`
            : "",
          "",
          "BUSINESS BRAIN FACTS:",
          buildBrainDigest(facts),
          "",
          `EVIDENCE ITEMS (${evidence.length}): ` +
            evidence
              .slice(0, 15)
              .map((e) => `${e.evidence_type}:${e.title ?? "untitled"}`)
              .join("; "),
          "",
          `Return JSON in exactly this shape:\n${SHAPE}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  if (ai === null) {
    throw new Error("The diagnosis service is temporarily unavailable. Please try again shortly.");
  }

  const parsed = aiSchema.safeParse(ai);
  if (!parsed.success) {
    console.error("[diagnosis] AI response failed validation", parsed.error.issues.slice(0, 5));
    throw new Error("The diagnosis response was malformed and was rejected. Please run the diagnosis again.");
  }
  const output = parsed.data;

  /* Resolve + verify evidence: only facts belonging to this business survive. */
  const resolve = (ids: string[]) => {
    const seen = new Set<string>();
    const refs: { fact: FactRow; quality: EvidenceRef["quality"] }[] = [];
    let rejected = 0;
    for (const id of ids) {
      const fact = factById.get(id);
      if (!fact) {
        rejected += 1;
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      refs.push({ fact, quality: factQuality(fact) });
    }
    return { refs, rejected };
  };

  const toRow = (
    item: z.infer<typeof itemSchema>,
    kind: "constraint" | "opportunity",
  ) => {
    const { refs, rejected } = resolve(item.evidence_fact_ids);
    // Quality gate: a diagnosis with no verifiable Brain evidence is discarded.
    if (refs.length === 0) return null;

    const categoryKey = DIAGNOSIS_CATEGORY_MAP[item.category.trim().toLowerCase()] ?? "strategy";
    const confidence = computeConfidence(item.confidence, refs);
    const opportunity = item.opportunity ?? item.impact;
    const priority = computePriority({
      impact: item.impact,
      urgency: item.urgency,
      confidence,
      opportunity,
      effort: item.effort,
    });

    return {
      business_id: businessId,
      category: categoryKey,
      title: item.title,
      description: item.description,
      impact_score: Math.round(item.impact),
      urgency_score: Math.round(item.urgency),
      confidence_score: confidence,
      effort_score: Math.round(item.effort),
      priority_score: priority,
      priority_level: priorityLevel(priority),
      status: "identified" as const,
      recommendation: item.recommended_direction ?? null,
      evidence: {
        kind,
        root_cause: item.root_cause ?? null,
        ai_confidence: Math.round(item.confidence),
        opportunity_score: Math.round(opportunity),
        rejected_fact_ids: rejected,
        fact_ids: refs.map((r) => r.fact.id),
        facts: refs.map((r) => ({
          fact_id: r.fact.id,
          fact_key: r.fact.fact_key,
          category: r.fact.category,
          value: factValue(r.fact),
          fact_type: r.fact.fact_type,
          verified: r.fact.verified,
          confidence: Number(r.fact.confidence),
          quality: r.quality,
        })),
      },
    };
  };

  const constraintRows = output.critical_constraints
    .map((i) => toRow(i, "constraint"))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));

  const opportunityRows = output.opportunities
    .map((i) => toRow(i, "opportunity"))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));

  const strengthRows = output.strengths.map((s) => {
    const { refs } = resolve(s.evidence_fact_ids);
    return {
      business_id: businessId,
      category: "strategy" as CategoryEnum,
      title: s.title,
      description: s.description,
      impact_score: null,
      urgency_score: null,
      confidence_score: refs.length > 0 ? computeConfidence(80, refs) : null,
      effort_score: null,
      priority_score: null,
      priority_level: null,
      status: "identified" as const,
      recommendation: null,
      evidence: {
        kind: "strength",
        fact_ids: refs.map((r) => r.fact.id),
        facts: refs.map((r) => ({
          fact_id: r.fact.id,
          fact_key: r.fact.fact_key,
          category: r.fact.category,
          value: factValue(r.fact),
          fact_type: r.fact.fact_type,
          verified: r.fact.verified,
          confidence: Number(r.fact.confidence),
          quality: r.quality,
        })),
      },
    };
  });

  const gapRows = output.information_gaps.map((g) => ({
    business_id: businessId,
    category: (DIAGNOSIS_CATEGORY_MAP[g.category.trim().toLowerCase()] ?? "strategy") as CategoryEnum,
    title: g.question,
    description: g.reason,
    impact_score: Math.round(g.importance),
    urgency_score: null,
    confidence_score: null,
    effort_score: null,
    priority_score: null,
    priority_level: null,
    status: "identified" as const,
    recommendation: null,
    evidence: { kind: "information_gap", importance: Math.round(g.importance), fact_ids: [], facts: [] },
  }));

  // Server-detected missing critical numbers, added as gaps the AI may have missed.
  for (const label of readiness.missingMetrics) {
    if (gapRows.some((g) => g.title.toLowerCase().includes(label.toLowerCase()))) continue;
    gapRows.push({
      business_id: businessId,
      category: "finance" as CategoryEnum,
      title: `${label} is unknown`,
      description: "The Brain holds no fact for this number, so any diagnosis touching it stays unverified.",
      impact_score: 60,
      urgency_score: null,
      confidence_score: null,
      effort_score: null,
      priority_score: null,
      priority_level: null,
      status: "identified" as const,
      recommendation: null,
      evidence: { kind: "information_gap", importance: 60, fact_ids: [], facts: [] },
    });
  }

  const contradictionRows = output.contradictions
    .map((c) => {
      const { refs } = resolve(c.fact_ids);
      if (refs.length < 2) return null;
      return {
        business_id: businessId,
        category: "strategy" as CategoryEnum,
        title: c.description.slice(0, 200),
        description: c.description,
        impact_score: null,
        urgency_score: null,
        confidence_score: null,
        effort_score: null,
        priority_score: null,
        priority_level: null,
        status: "validated" as const,
        recommendation: c.resolution_question || null,
        evidence: {
          kind: "contradiction",
          resolution_question: c.resolution_question || null,
          fact_ids: refs.map((r) => r.fact.id),
          facts: refs.map((r) => ({
            fact_id: r.fact.id,
            fact_key: r.fact.fact_key,
            category: r.fact.category,
            value: factValue(r.fact),
            fact_type: r.fact.fact_type,
            verified: r.fact.verified,
            confidence: Number(r.fact.confidence),
            quality: r.quality,
          })),
        },
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (constraintRows.length === 0 && opportunityRows.length === 0) {
    throw new Error(
      "No diagnosis could be produced with verifiable evidence from your Brain. Continue the interview to add more facts.",
    );
  }

  /* Category scores derived from constraint pressure per area. */
  const categoryScore = (cat: CategoryEnum) => {
    const rows = constraintRows.filter((r) => r.category === cat);
    if (rows.length === 0) return null;
    const worst = Math.max(...rows.map((r) => r.priority_score ?? 0));
    return Math.round(Math.max(0, 100 - worst));
  };

  const overall = Math.round(output.business_health_score);
  const runConfidence = Math.round(
    (constraintRows.reduce((s, r) => s + (r.confidence_score ?? 0), 0) /
      Math.max(1, constraintRows.length)) *
      0.7 +
      output.confidence_score * 0.3,
  );

  /* Persistence: diagnosis tables are read-only to app users, so write with the
     service role AFTER access has been verified through the user's RLS client. */
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: run, error: runError } = await supabaseAdmin
    .from("diagnosis_runs")
    .insert({
      business_id: businessId,
      brain_version: readiness.factCount,
      overall_score: overall,
      revenue_score: categoryScore("revenue"),
      marketing_score: categoryScore("marketing"),
      sales_score: categoryScore("sales"),
      retention_score: categoryScore("retention"),
      operations_score: categoryScore("operations"),
      automation_score: categoryScore("automation"),
      owner_dependency_score: categoryScore("people"),
      growth_score: categoryScore("growth"),
      summary: output.executive_summary,
    })
    .select("*")
    .single();
  if (runError) throw runError;

  const allRows = [
    ...constraintRows,
    ...opportunityRows,
    ...strengthRows,
    ...gapRows,
    ...contradictionRows,
  ].map((row) => ({ ...row, diagnosis_run_id: run.id }));

  const { error: itemError } = await supabaseAdmin.from("diagnosis_items").insert(allRows);
  if (itemError) throw itemError;

  await supabaseAdmin.rpc("write_audit_log", {
    target_business: businessId,
    action_name: "diagnosis.run",
    target_table: "diagnosis_runs",
    target_record: run.id,
    old_value: null,
    new_value: { items: allRows.length, overall_score: overall, confidence: runConfidence },
    actor: "ai",
  });

  return loadDiagnosis(supabase, businessId, run.id, readiness, runConfidence);
}

/* ------------------------------------------------------------------ read */

export async function loadDiagnosis(
  supabase: Client,
  businessId: string,
  runId: string | null,
  readiness: BrainReadiness,
  confidenceOverride?: number,
) {
  let resolvedRunId = runId;
  if (!resolvedRunId) {
    const { data, error } = await supabase
      .from("diagnosis_runs")
      .select("id")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    resolvedRunId = data?.id ?? null;
  }

  if (!resolvedRunId) {
    return { status: "empty" as const, readiness, run: null, items: [] as DiagnosisItemView[], history: [] };
  }

  const [{ data: runRow, error: runError }, { data: itemRows, error: itemError }, { data: historyRows }] =
    await Promise.all([
      supabase.from("diagnosis_runs").select("*").eq("id", resolvedRunId).maybeSingle(),
      supabase
        .from("diagnosis_items")
        .select("*")
        .eq("diagnosis_run_id", resolvedRunId)
        .order("priority_score", { ascending: false, nullsFirst: false }),
      supabase
        .from("diagnosis_runs")
        .select("id, created_at, overall_score")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
  if (runError) throw runError;
  if (itemError) throw itemError;
  if (!runRow) {
    return { status: "empty" as const, readiness, run: null, items: [] as DiagnosisItemView[], history: [] };
  }

  const items: DiagnosisItemView[] = (itemRows ?? []).map((row) => {
    const meta = (row.evidence ?? {}) as Record<string, unknown>;
    const kind = (typeof meta["kind"] === "string" ? meta["kind"] : "constraint") as DiagnosisItemView["kind"];
    const facts = Array.isArray(meta["facts"]) ? (meta["facts"] as Record<string, unknown>[]) : [];
    return {
      id: row.id,
      kind,
      category: row.category,
      categoryLabel: DIAGNOSIS_CATEGORY_LABEL[row.category] ?? row.category,
      title: row.title,
      description: row.description,
      rootCause: typeof meta["root_cause"] === "string" ? meta["root_cause"] : null,
      recommendation: row.recommendation,
      impact: row.impact_score === null ? null : Number(row.impact_score),
      urgency: row.urgency_score === null ? null : Number(row.urgency_score),
      confidence: row.confidence_score === null ? null : Number(row.confidence_score),
      effort: row.effort_score === null ? null : Number(row.effort_score),
      priority: row.priority_score === null ? null : Number(row.priority_score),
      priorityLevel: row.priority_level,
      resolutionQuestion:
        typeof meta["resolution_question"] === "string" ? meta["resolution_question"] : null,
      evidenceNote:
        typeof meta["ai_confidence"] === "number"
          ? `AI component confidence ${meta["ai_confidence"]}% · server-scored ${row.confidence_score ?? "—"}%`
          : null,
      evidence: facts.map((f) => ({
        factId: String(f["fact_id"] ?? ""),
        factKey: String(f["fact_key"] ?? ""),
        category: String(f["category"] ?? ""),
        value: String(f["value"] ?? ""),
        factType: String(f["fact_type"] ?? "fact"),
        verified: Boolean(f["verified"]),
        confidence: Number(f["confidence"] ?? 0),
        quality: (f["quality"] as EvidenceRef["quality"]) ?? "stated",
      })),
    };
  });

  const constraintConfidence =
    items.filter((i) => i.kind === "constraint" && i.confidence !== null).map((i) => i.confidence!) ?? [];

  const run: DiagnosisRunView = {
    id: runRow.id,
    createdAt: runRow.created_at,
    overallScore: runRow.overall_score === null ? null : Number(runRow.overall_score),
    confidenceScore:
      confidenceOverride ??
      (constraintConfidence.length > 0
        ? Math.round(constraintConfidence.reduce((a, b) => a + b, 0) / constraintConfidence.length)
        : null),
    summary: runRow.summary,
    categoryScores: [
      ["revenue", runRow.revenue_score],
      ["marketing", runRow.marketing_score],
      ["sales", runRow.sales_score],
      ["retention", runRow.retention_score],
      ["operations", runRow.operations_score],
      ["automation", runRow.automation_score],
      ["people", runRow.owner_dependency_score],
      ["growth", runRow.growth_score],
    ].map(([key, value]) => ({
      category: String(key),
      label: DIAGNOSIS_CATEGORY_LABEL[String(key)] ?? String(key),
      score: value === null || value === undefined ? null : Number(value),
    })),
  };

  return {
    status: "ready" as const,
    readiness,
    run,
    items,
    history: (historyRows ?? []).map((h) => ({
      id: h.id,
      createdAt: h.created_at,
      overallScore: h.overall_score === null ? null : Number(h.overall_score),
    })),
  };
}
