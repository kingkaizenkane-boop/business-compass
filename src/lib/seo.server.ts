/**
 * Server-only Programmatic SEO + Acquisition Engine (P2.3).
 *
 * Two architecturally distinct engines share this module:
 *   PLATFORM — acquisition pages for Business OS (business_id IS NULL).
 *   CUSTOMER — pages owned by one Business OS customer (business_id set).
 *
 * Hard rules enforced here, not in prompts alone:
 *   - a customer page may only assert what verified Business Brain facts support;
 *   - the server, never the AI, computes opportunity and quality scores;
 *   - nothing publishes below the quality threshold or near-duplicate to an
 *     existing page.
 *
 * This module never runs in the client bundle.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { chatJsonResult } from "./ai.server";
import { AI_MODELS } from "./ai-usage.server";
import { writeAudit } from "./audit.server";
import { assertBusinessAccess, loadBrain } from "./diagnosis.server";
import { writeMemory } from "./memory.server";
import {
  DUPLICATE_SIMILARITY_LIMIT,
  PLATFORM_INDUSTRIES,
  PLATFORM_PROBLEMS,
  QUALITY_THRESHOLD,
  computeOpportunityScore,
  slugify,
  type OpportunityStatus,
  type OpportunityView,
  type PageContent,
  type PageDetail,
  type PageView,
  type QualityCheck,
  type QualityReport,
  type SeoOverview,
  type SeoSiteType,
} from "./seo-types";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
type SiteRow = Database["public"]["Tables"]["seo_sites"]["Row"];
type OppRow = Database["public"]["Tables"]["seo_opportunities"]["Row"];
type PageRow = Database["public"]["Tables"]["seo_pages"]["Row"];

export const PUBLIC_BASE_URL = "https://ops-intellipro.lovable.app";

async function admin(): Promise<Client> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Client;
}

/* ------------------------------------------------------------------ brain extraction */

type Fact = {
  id: string;
  category: string;
  subcategory: string | null;
  fact_key: string;
  value_text: string | null;
  value_number: number | null;
  fact_type: string;
  confidence: number;
  verified: boolean;
};

export type BrainItem = { value: string; factId: string; verified: boolean; confidence: number };

export type BrainSeoContext = {
  businessName: string;
  industry: string | null;
  description: string | null;
  services: BrainItem[];
  locations: BrainItem[];
  differentiators: BrainItem[];
  segments: BrainItem[];
  hours: BrainItem[];
  contact: BrainItem[];
  credentials: BrainItem[];
  factCount: number;
  facts: Fact[];
};

const SERVICE_HINT = /(service|offer|product|package|deliverable|treatment|menu)/i;
const LOCATION_HINT = /(location|area|city|region|geograph|territory|serves|coverage|address)/i;
const DIFFERENTIATOR_HINT = /(differenti|advantage|unique|strength|why|reason|quality|benefit)/i;
const SEGMENT_HINT = /(segment|customer_type|target|audience|ideal)/i;
const HOURS_HINT = /(hour|opening|availability|schedule)/i;
const CONTACT_HINT = /(contact|phone|booking|book|whatsapp|email|website|channel)/i;
const CREDENTIAL_HINT = /(credential|certification|licence|license|qualification|registration|accredit)/i;

function itemOf(fact: Fact): BrainItem | null {
  const raw = (fact.value_text ?? (fact.value_number != null ? String(fact.value_number) : "")).trim();
  if (raw.length < 2 || raw.length > 200) return null;
  return { value: raw, factId: fact.id, verified: fact.verified, confidence: Number(fact.confidence ?? 0) };
}

function dedupeItems(items: BrainItem[]): BrainItem[] {
  const seen = new Map<string, BrainItem>();
  for (const item of items) {
    const key = item.value.toLowerCase();
    const existing = seen.get(key);
    if (!existing || (item.verified && !existing.verified)) seen.set(key, item);
  }
  return [...seen.values()];
}

/** Pulls the SEO-relevant slice of the Business Brain. Nothing is invented. */
export async function loadSeoBrain(supabase: Client, businessId: string): Promise<BrainSeoContext> {
  const business = await assertBusinessAccess(supabase, businessId);
  const { facts } = (await loadBrain(supabase, businessId)) as { facts: Fact[] };

  const bucket = (hint: RegExp, categories: string[] = []) =>
    dedupeItems(
      facts
        .filter((f) => {
          const haystack = `${f.category} ${f.subcategory ?? ""} ${f.fact_key}`;
          return hint.test(haystack) || categories.includes(f.category);
        })
        .map(itemOf)
        .filter((x): x is BrainItem => x !== null),
    );

  return {
    businessName: business.name,
    industry: business.industry ?? null,
    description: business.description ?? null,
    services: bucket(SERVICE_HINT, ["offers"]),
    locations: bucket(LOCATION_HINT),
    differentiators: bucket(DIFFERENTIATOR_HINT),
    segments: bucket(SEGMENT_HINT),
    hours: bucket(HOURS_HINT),
    contact: bucket(CONTACT_HINT),
    credentials: bucket(CREDENTIAL_HINT),
    factCount: facts.length,
    facts,
  };
}

function verifiedOnly(items: BrainItem[]) {
  return items.filter((i) => i.verified);
}

/* ------------------------------------------------------------------ sites */

export async function ensureCustomerSite(options: {
  supabase: Client;
  businessId: string;
  userId?: string | null;
}): Promise<SiteRow> {
  const { supabase, businessId } = options;
  const { data: existing } = await supabase
    .from("seo_sites")
    .select("*")
    .eq("business_id", businessId)
    .eq("site_type", "customer")
    .maybeSingle();
  if (existing) return existing;

  const business = await assertBusinessAccess(supabase, businessId);
  const { data: org } = await supabase
    .from("businesses")
    .select("organization_id")
    .eq("id", businessId)
    .single();

  const { data, error } = await supabase
    .from("seo_sites")
    .insert({
      site_type: "customer",
      business_id: businessId,
      organization_id: org?.organization_id ?? null,
      name: business.name,
      subdomain: slugify(business.name),
      status: "active",
      url_pattern: "/{slug}",
      active: true,
    })
    .select("*")
    .single();
  if (error) throw error;

  await writeAudit({
    supabase,
    action: "seo.site_created",
    businessId,
    organizationId: org?.organization_id ?? null,
    userId: options.userId ?? null,
    entity: "seo_sites",
    entityId: data.id,
    after: { siteType: "customer", name: business.name },
  });
  return data;
}

export async function getPlatformSite(db: Client): Promise<SiteRow> {
  const { data, error } = await db
    .from("seo_sites")
    .select("*")
    .eq("site_type", "platform")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("The Business OS platform SEO site has not been provisioned.");
  return data;
}

/** Public path for a page. Customer sites keep their own configurable pattern. */
export function pagePath(site: Pick<SiteRow, "id" | "site_type" | "url_pattern">, page: { slug: string; template?: string | null }): string {
  if (site.site_type === "platform") {
    return page.template === "solution" ? `/solutions/${page.slug}` : `/business-os-for/${page.slug}`;
  }
  const pattern = site.url_pattern || "/{slug}";
  return `/sites/${site.id}${pattern.replace("{slug}", page.slug)}`;
}

function canonicalFor(site: SiteRow, path: string) {
  const host = site.domain && site.site_type === "customer" ? `https://${site.domain}` : PUBLIC_BASE_URL;
  return `${host}${path}`;
}

/* ------------------------------------------------------------------ opportunity discovery */

type Candidate = {
  keyword: string;
  intent: string;
  topic: string | null;
  location: string | null;
  service: string | null;
  industry: string | null;
  problem: string | null;
  businessStage: string | null;
  pageType: string;
  components: {
    intentFit: number;
    businessRelevance: number;
    contentValue: number;
    commercialIntent: number;
    competitionOpportunity: number;
  };
  reason: string;
  status: OpportunityStatus;
};

function toOpportunityView(row: OppRow, siteType: SeoSiteType): OpportunityView {
  return {
    id: row.id,
    siteId: row.seo_site_id,
    siteType,
    businessId: row.business_id,
    keyword: row.keyword,
    intent: row.search_intent,
    topic: row.topic_cluster ?? row.topic,
    location: row.location ?? row.geographic_modifier,
    service: row.service,
    industry: row.industry,
    problem: row.problem,
    businessStage: row.business_stage,
    score: row.opportunity_score == null ? null : Number(row.opportunity_score),
    relevanceScore: row.relevance_score == null ? null : Number(row.relevance_score),
    competitionScore: row.competition_score == null ? null : Number(row.competition_score),
    businessFitScore: row.business_fit_score == null ? null : Number(row.business_fit_score),
    contentValueScore: row.content_value_score == null ? null : Number(row.content_value_score),
    commercialScore: row.commercial_score == null ? null : Number(row.commercial_score),
    status: (row.status as OpportunityStatus) ?? "discovered",
    reason: row.reason,
    recommendedPageType: row.recommended_page_type,
    createdAt: row.created_at,
  };
}

async function upsertCandidates(options: {
  db: Client;
  site: SiteRow;
  businessId: string | null;
  organizationId: string | null;
  userId: string | null;
  candidates: Candidate[];
}): Promise<{ created: OpportunityView[]; existing: number }> {
  const { db, site } = options;
  const created: OpportunityView[] = [];
  let existing = 0;

  for (const candidate of options.candidates) {
    const score = computeOpportunityScore(candidate.components);
    const { data: found } = await db
      .from("seo_opportunities")
      .select("*")
      .eq("seo_site_id", site.id)
      .ilike("keyword", candidate.keyword)
      .maybeSingle();

    if (found) {
      existing += 1;
      continue;
    }

    const { data, error } = await db
      .from("seo_opportunities")
      .insert({
        seo_site_id: site.id,
        business_id: options.businessId,
        organization_id: options.organizationId,
        keyword: candidate.keyword,
        search_intent: candidate.intent,
        topic: candidate.topic,
        topic_cluster: candidate.topic,
        location: candidate.location,
        geographic_modifier: candidate.location,
        service: candidate.service,
        industry: candidate.industry,
        problem: candidate.problem,
        business_stage: candidate.businessStage,
        recommended_page_type: candidate.pageType,
        relevance_score: candidate.components.businessRelevance,
        competition_score: candidate.components.competitionOpportunity,
        business_fit_score: candidate.components.businessRelevance,
        content_value_score: candidate.components.contentValue,
        commercial_score: candidate.components.commercialIntent,
        opportunity_score: score,
        status: candidate.status,
        reason: candidate.reason,
        decided_at: new Date().toISOString(),
        metadata: { components: candidate.components } as never,
      })
      .select("*")
      .single();

    if (error) {
      // Lost a race on the unique (site, keyword) index — treat as existing.
      existing += 1;
      continue;
    }

    created.push(toOpportunityView(data, site.site_type as SeoSiteType));
    await writeAudit({
      supabase: db,
      action: candidate.status === "rejected" ? "seo.opportunity_rejected" : "seo.opportunity_created",
      businessId: options.businessId,
      organizationId: options.organizationId,
      userId: options.userId,
      entity: "seo_opportunities",
      entityId: data.id,
      after: { keyword: candidate.keyword, score, status: candidate.status },
      metadata: { reason: candidate.reason },
    });
  }

  return { created, existing };
}

/**
 * CUSTOMER discovery. Opportunities are derived exclusively from verified
 * Business Brain facts — a location the Brain does not establish can never
 * produce a page.
 */
export async function discoverCustomerOpportunities(options: {
  supabase: Client;
  businessId: string;
  userId?: string | null;
}): Promise<{ created: OpportunityView[]; existing: number; reason?: string }> {
  const { supabase, businessId } = options;
  const site = await ensureCustomerSite({ supabase, businessId, userId: options.userId ?? null });
  const brain = await loadSeoBrain(supabase, businessId);

  const services = verifiedOnly(brain.services).slice(0, 8);
  const locations = verifiedOnly(brain.locations).slice(0, 8);

  if (services.length === 0) {
    return {
      created: [],
      existing: 0,
      reason:
        "No verified services in the Business Brain yet. Complete Business Discovery so pages can be grounded in what you actually sell.",
    };
  }

  const supportDepth = Math.min(100, 40 + brain.factCount * 2);
  const candidates: Candidate[] = [];

  for (const service of services) {
    for (const location of locations) {
      candidates.push({
        keyword: `${service.value} in ${location.value}`.toLowerCase(),
        intent: "local",
        topic: service.value,
        location: location.value,
        service: service.value,
        industry: brain.industry,
        problem: null,
        businessStage: null,
        pageType: "service_location",
        components: {
          intentFit: 90,
          businessRelevance: 95,
          contentValue: Math.min(90, supportDepth),
          commercialIntent: 85,
          competitionOpportunity: 60,
        },
        reason: `Verified service "${service.value}" and verified service area "${location.value}".`,
        status: "qualified",
      });
    }
    candidates.push({
      keyword: `${brain.businessName} ${service.value}`.toLowerCase(),
      intent: "navigational",
      topic: service.value,
      location: null,
      service: service.value,
      industry: brain.industry,
      problem: null,
      businessStage: null,
      pageType: "business_service",
      components: {
        intentFit: 75,
        businessRelevance: 95,
        contentValue: Math.min(85, supportDepth),
        commercialIntent: 70,
        competitionOpportunity: 80,
      },
      reason: `Verified service "${service.value}" offered by this business.`,
      status: "qualified",
    });
  }

  for (const location of locations) {
    candidates.push({
      keyword: `${brain.businessName} in ${location.value}`.toLowerCase(),
      intent: "local",
      topic: null,
      location: location.value,
      service: null,
      industry: brain.industry,
      problem: null,
      businessStage: null,
      pageType: "business_location",
      components: {
        intentFit: 80,
        businessRelevance: 90,
        contentValue: Math.min(80, supportDepth),
        commercialIntent: 75,
        competitionOpportunity: 65,
      },
      reason: `Verified service area "${location.value}".`,
      status: "qualified",
    });
  }

  const { data: orgRow } = await supabase
    .from("businesses")
    .select("organization_id")
    .eq("id", businessId)
    .single();

  const result = await upsertCandidates({
    db: supabase,
    site,
    businessId,
    organizationId: orgRow?.organization_id ?? null,
    userId: options.userId ?? null,
    // Quality over count: cap what one discovery run can add.
    candidates: candidates.slice(0, 40),
  });

  return {
    ...result,
    ...(locations.length === 0
      ? {
          reason:
            "No verified service areas yet, so only business-and-service opportunities were created. Confirm the locations you serve to unlock local pages.",
        }
      : {}),
  };
}

/**
 * Manual keyword proposal. This is where the trust rule bites: a keyword that
 * names a service or location the Brain does not verify is stored as REJECTED
 * with the reason, never silently generated.
 */
export async function proposeCustomerOpportunity(options: {
  supabase: Client;
  businessId: string;
  keyword: string;
  userId?: string | null;
}): Promise<{ opportunity: OpportunityView | null; rejected: boolean; reason: string }> {
  const { supabase, businessId } = options;
  const keyword = options.keyword.trim().toLowerCase();
  if (keyword.length < 3) throw new Error("Enter a longer keyword.");

  const site = await ensureCustomerSite({ supabase, businessId, userId: options.userId ?? null });
  const brain = await loadSeoBrain(supabase, businessId);
  const services = verifiedOnly(brain.services);
  const locations = verifiedOnly(brain.locations);

  const matchIn = (items: BrainItem[]) =>
    items.find((item) => keyword.includes(item.value.toLowerCase())) ?? null;

  const service = matchIn(services);
  const location = matchIn(locations);
  const industryMatch = brain.industry ? keyword.includes(brain.industry.toLowerCase()) : false;

  // "in <somewhere>" that the Brain does not establish must be rejected.
  const inMatch = /\bin\s+([a-z][a-z\s'-]{1,40})$/.exec(keyword);
  const namedPlace = inMatch?.[1]?.trim() ?? null;
  const placeVerified =
    namedPlace == null || locations.some((l) => l.value.toLowerCase().includes(namedPlace) || namedPlace.includes(l.value.toLowerCase()));

  let status: OpportunityStatus = "qualified";
  let reason = "Supported by verified Business Brain facts.";

  if (!placeVerified) {
    status = "rejected";
    reason = `The Business Brain does not establish that this business serves "${namedPlace}". Verify that service area first.`;
  } else if (!service && !industryMatch) {
    status = "rejected";
    reason = "No verified service in the Business Brain matches this keyword.";
  }

  const { data: orgRow } = await supabase
    .from("businesses")
    .select("organization_id")
    .eq("id", businessId)
    .single();

  const supportDepth = Math.min(100, 40 + brain.factCount * 2);
  const { created, existing } = await upsertCandidates({
    db: supabase,
    site,
    businessId,
    organizationId: orgRow?.organization_id ?? null,
    userId: options.userId ?? null,
    candidates: [
      {
        keyword,
        intent: location || namedPlace ? "local" : "commercial",
        topic: service?.value ?? null,
        location: location?.value ?? null,
        service: service?.value ?? null,
        industry: brain.industry,
        problem: null,
        businessStage: null,
        pageType: location ? "service_location" : "business_service",
        components: {
          intentFit: status === "rejected" ? 20 : 85,
          businessRelevance: status === "rejected" ? 5 : 92,
          contentValue: status === "rejected" ? 10 : Math.min(90, supportDepth),
          commercialIntent: status === "rejected" ? 20 : 80,
          competitionOpportunity: 60,
        },
        reason,
        status,
      },
    ],
  });

  if (created.length === 0 && existing > 0) {
    const { data: row } = await supabase
      .from("seo_opportunities")
      .select("*")
      .eq("seo_site_id", site.id)
      .ilike("keyword", keyword)
      .maybeSingle();
    return {
      opportunity: row ? toOpportunityView(row, "customer") : null,
      rejected: (row?.status ?? status) === "rejected",
      reason: row?.reason ?? reason,
    };
  }

  return { opportunity: created[0] ?? null, rejected: status === "rejected", reason };
}

/** PLATFORM discovery. Curated industry × problem pairs only — no blind cross product. */
export async function discoverPlatformOpportunities(options: {
  db: Client;
  userId?: string | null;
  organizationId?: string | null;
}): Promise<{ created: OpportunityView[]; existing: number }> {
  const site = await getPlatformSite(options.db);
  const candidates: Candidate[] = [];

  for (const industry of PLATFORM_INDUSTRIES) {
    candidates.push({
      keyword: `business operating system for ${industry.plural}`,
      intent: "commercial",
      topic: "business operating system",
      location: null,
      service: null,
      industry: industry.key,
      problem: null,
      businessStage: null,
      pageType: "industry_need",
      components: {
        intentFit: 85,
        businessRelevance: 90,
        contentValue: 80,
        commercialIntent: 85,
        competitionOpportunity: 55,
      },
      reason: `Owner-facing acquisition page for ${industry.plural}.`,
      status: "qualified",
    });

    for (const problemKey of industry.problems) {
      const problem = PLATFORM_PROBLEMS[problemKey];
      if (!problem) continue;
      candidates.push({
        keyword: `how ${industry.plural} ${problem.label}`,
        intent: problem.intent,
        topic: problem.label,
        location: null,
        service: null,
        industry: industry.key,
        problem: problemKey,
        businessStage: null,
        pageType: "industry_problem",
        components: {
          intentFit: 88,
          businessRelevance: 85,
          contentValue: 82,
          commercialIntent: problem.intent === "commercial" ? 80 : 60,
          competitionOpportunity: 60,
        },
        reason: `${industry.plural} searching for help to ${problem.label}.`,
        status: "qualified",
      });
    }
  }

  for (const [key, problem] of Object.entries(PLATFORM_PROBLEMS)) {
    candidates.push({
      keyword: `how to ${problem.label} in a small business`,
      intent: problem.intent,
      topic: problem.label,
      location: null,
      service: null,
      industry: null,
      problem: key,
      businessStage: null,
      pageType: "solution",
      components: {
        intentFit: 82,
        businessRelevance: 80,
        contentValue: 85,
        commercialIntent: 55,
        competitionOpportunity: 50,
      },
      reason: `Cross-industry solution page for "${problem.label}".`,
      status: "qualified",
    });
  }

  return upsertCandidates({
    db: options.db,
    site,
    businessId: null,
    organizationId: options.organizationId ?? null,
    userId: options.userId ?? null,
    candidates,
  });
}

/* ------------------------------------------------------------------ text helpers */

const STOPWORDS = new Set(
  "a an the and or but if then than that this these those for with from into your you our we us is are was were be been being of to in on at by as it its can will do does not no yes more most".split(" "),
);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function shingles(text: string, size = 4): Set<string> {
  const list = tokens(text);
  const out = new Set<string>();
  for (let i = 0; i + size <= list.length; i += 1) out.add(list.slice(i, i + size).join(" "));
  return out;
}

/** Jaccard similarity over 4-token shingles — good at catching city swaps. */
export function contentSimilarity(a: string, b: string): number {
  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const s of sa) if (sb.has(s)) shared += 1;
  return shared / (sa.size + sb.size - shared);
}

export function contentText(content: PageContent | null): string {
  if (!content) return "";
  return [
    content.intro,
    ...content.sections.map((s) => `${s.heading}\n${s.body}`),
    ...content.faq.map((f) => `${f.question}\n${f.answer}`),
  ].join("\n\n");
}

/**
 * A fingerprint that deliberately ignores the swapped tokens (service, location,
 * business name) so "same page, different city" collides.
 */
export function contentFingerprint(text: string, swapped: string[]): string {
  const ignore = new Set(swapped.flatMap((s) => tokens(s)));
  const body = tokens(text)
    .filter((t) => !ignore.has(t))
    .slice(0, 400)
    .sort()
    .join(" ");
  let hash = 0;
  for (let i = 0; i < body.length; i += 1) hash = (hash * 31 + body.charCodeAt(i)) | 0;
  return `fp_${(hash >>> 0).toString(36)}_${body.length}`;
}

/* ------------------------------------------------------------------ quality gate */

const UNSUPPORTED_CLAIM = /\b(award[- ]winning|certified|accredited|licensed|guarantee[ds]?|no\.? ?1|number one|best in|voted|\d+\s*(\+|plus)?\s*years? of experience|\d+[,\d]*\s*(happy )?customers|5[- ]star|money[- ]back)\b/gi;

export function runQualityGate(options: {
  content: PageContent;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  canonicalUrl: string | null;
  keyword: string;
  schema: unknown;
  brainText: string;
  siteType: SeoSiteType;
  maxSimilarity: number;
  duplicateTitle: boolean;
  duplicateSlug: boolean;
  duplicateCanonical: boolean;
  evidenceCount: number;
}): QualityReport {
  const body = contentText(options.content);
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const checks: QualityCheck[] = [];
  const add = (check: QualityCheck) => checks.push(check);

  const depthScore = Math.max(0, Math.min(100, Math.round(((wordCount - 120) / 380) * 100)));
  add({
    key: "depth",
    label: "Minimum useful content",
    passed: wordCount >= 280,
    blocking: true,
    detail: `${wordCount} words`,
    score: depthScore,
  });

  // Factual support: claims must be traceable to the Brain (customer engine).
  const brainLower = options.brainText.toLowerCase();
  const claims = body.match(UNSUPPORTED_CLAIM) ?? [];
  const unsupported = claims.filter((claim) => !brainLower.includes(claim.toLowerCase()));
  add({
    key: "claims",
    label: "No unsupported claims",
    passed: unsupported.length === 0,
    blocking: true,
    detail: unsupported.length === 0 ? "No unverifiable claims detected" : `Unsupported: ${[...new Set(unsupported)].slice(0, 4).join(", ")}`,
    score: unsupported.length === 0 ? 100 : 0,
  });

  const factualConfidence =
    options.siteType === "customer"
      ? Math.max(0, Math.min(100, options.evidenceCount * 12 + (unsupported.length === 0 ? 40 : 0)))
      : unsupported.length === 0
        ? 85
        : 40;
  add({
    key: "factual_support",
    label: "Traceable to the Business Brain",
    passed: options.siteType === "platform" || options.evidenceCount >= 3,
    blocking: options.siteType === "customer",
    detail:
      options.siteType === "platform"
        ? "Platform page — product claims only"
        : `${options.evidenceCount} supporting Brain facts`,
    score: factualConfidence,
  });

  // Business relevance: the page must actually talk about the business/topic.
  const keywordTokens = tokens(options.keyword);
  const bodyTokens = tokens(body);
  const coverage =
    keywordTokens.length === 0
      ? 0
      : keywordTokens.filter((t) => bodyTokens.includes(t)).length / keywordTokens.length;
  const businessRelevance = Math.round(coverage * 100);
  add({
    key: "relevance",
    label: "Business relevance",
    passed: coverage >= 0.6,
    blocking: true,
    detail: `${businessRelevance}% of the target topic is addressed`,
    score: businessRelevance,
  });

  // Keyword stuffing.
  const keywordPhrase = options.keyword.toLowerCase();
  const occurrences = (body.toLowerCase().match(new RegExp(keywordPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
  const density = wordCount === 0 ? 0 : (occurrences * keywordTokens.length) / wordCount;
  add({
    key: "stuffing",
    label: "No keyword stuffing",
    passed: density <= 0.03,
    blocking: true,
    detail: `Exact-phrase density ${(density * 100).toFixed(1)}%`,
    score: density <= 0.03 ? 100 : 0,
  });

  const originality = Math.round((1 - options.maxSimilarity) * 100);
  add({
    key: "originality",
    label: "Original against existing pages",
    passed: options.maxSimilarity < DUPLICATE_SIMILARITY_LIMIT,
    blocking: true,
    detail: `Closest existing page ${(options.maxSimilarity * 100).toFixed(0)}% similar`,
    score: originality,
  });

  const duplicates = [
    options.duplicateTitle ? "title" : null,
    options.duplicateSlug ? "slug" : null,
    options.duplicateCanonical ? "canonical URL" : null,
  ].filter(Boolean) as string[];
  add({
    key: "duplicates",
    label: "No duplicate title, slug or canonical",
    passed: duplicates.length === 0,
    blocking: true,
    detail: duplicates.length === 0 ? "Unique" : `Duplicate ${duplicates.join(", ")}`,
    score: duplicates.length === 0 ? 100 : 0,
  });

  const hasCta = Boolean(options.content.cta?.label && options.content.cta?.href);
  add({
    key: "cta",
    label: "Clear next step",
    passed: hasCta,
    blocking: true,
    detail: hasCta ? options.content.cta.label : "No call to action",
    score: hasCta ? 100 : 0,
  });

  const titleOk = options.metaTitle.length >= 15 && options.metaTitle.length <= 65;
  const metaOk = options.metaDescription.length >= 50 && options.metaDescription.length <= 165;
  add({
    key: "metadata",
    label: "Title and meta description valid",
    passed: titleOk && metaOk && options.h1.length > 3,
    blocking: true,
    detail: `Title ${options.metaTitle.length} chars, meta ${options.metaDescription.length} chars`,
    score: (titleOk ? 50 : 0) + (metaOk ? 50 : 0),
  });

  add({
    key: "canonical",
    label: "Canonical URL set",
    passed: Boolean(options.canonicalUrl && options.canonicalUrl.startsWith("http")),
    blocking: true,
    detail: options.canonicalUrl ?? "missing",
    score: options.canonicalUrl ? 100 : 0,
  });

  const schemaOk =
    typeof options.schema === "object" &&
    options.schema !== null &&
    "@type" in (options.schema as Record<string, unknown>) &&
    "@context" in (options.schema as Record<string, unknown>);
  add({
    key: "schema",
    label: "Structured data valid",
    passed: schemaOk,
    blocking: false,
    detail: schemaOk ? "JSON-LD present" : "No valid JSON-LD",
    score: schemaOk ? 100 : 40,
  });

  const faqOk = options.content.faq.length >= 2;
  add({
    key: "faq",
    label: "Answers real questions",
    passed: faqOk,
    blocking: false,
    detail: `${options.content.faq.length} FAQ entries`,
    score: faqOk ? 100 : 50,
  });

  const score = Math.round(checks.reduce((sum, c) => sum + c.score, 0) / checks.length);
  const blockingFailure = checks.some((c) => c.blocking && !c.passed);

  return {
    score,
    originality,
    businessRelevance,
    factualConfidence,
    wordCount,
    checks,
    publishable: score >= QUALITY_THRESHOLD && !blockingFailure,
  };
}

/* ------------------------------------------------------------------ generation */

const CUSTOMER_SYSTEM = [
  "You write factual local business web pages for a real small business.",
  "You may ONLY state facts that appear in the supplied VERIFIED BUSINESS FACTS.",
  "Never invent certifications, awards, locations, pricing, years of experience, customer numbers, reviews or guarantees.",
  "If a detail is not supplied, omit it entirely — do not hedge, do not speculate.",
  "Write useful, specific, human prose. No keyword stuffing, no filler, no repeated sentences.",
  "Return strict JSON only.",
].join(" ");

const PLATFORM_SYSTEM = [
  "You write acquisition pages for Business OS, an AI business intelligence, strategy and operating system for small businesses.",
  "Business OS runs a loop: Business DNA interview -> Business Brain -> Diagnosis -> Blueprint -> 90-day Action Plan -> Processes -> Metrics -> Experiments.",
  "Educate the business owner honestly about their problem first, then explain how the loop addresses it.",
  "Never promise search rankings, revenue figures, guarantees or named customer results.",
  "Write useful, specific, non-generic prose. Return strict JSON only.",
].join(" ");

type AiPage = {
  title?: string;
  meta_title?: string;
  meta_description?: string;
  h1?: string;
  intro?: string;
  sections?: { key?: string; heading?: string; body?: string }[];
  faq?: { question?: string; answer?: string }[];
  cta?: { label?: string; note?: string };
  used_fact_ids?: string[];
};

function normaliseContent(ai: AiPage, ctaHref: string): PageContent {
  return {
    intro: (ai.intro ?? "").trim(),
    sections: (ai.sections ?? [])
      .map((s, index) => ({
        key: (s.key ?? `section_${index + 1}`).toString().slice(0, 40),
        heading: (s.heading ?? "").trim(),
        body: (s.body ?? "").trim(),
      }))
      .filter((s) => s.heading && s.body.length > 40),
    faq: (ai.faq ?? [])
      .map((f) => ({ question: (f.question ?? "").trim(), answer: (f.answer ?? "").trim() }))
      .filter((f) => f.question && f.answer.length > 20),
    cta: {
      label: (ai.cta?.label ?? "Get started").trim(),
      href: ctaHref,
      ...(ai.cta?.note ? { note: ai.cta.note.trim() } : {}),
    },
  };
}

export type GenerationResult = {
  status: "generated" | "quality_failed" | "insufficient" | "duplicate" | "ai_failed";
  pageId?: string;
  qualityScore?: number;
  reason?: string;
};

/**
 * Generates (or re-generates) one page for one opportunity. Always runs inside
 * the AI job queue — never on the synchronous request path.
 */
export async function generateSeoPage(options: {
  supabase: Client;
  opportunityId: string;
  userId?: string | null;
  organizationId?: string | null;
  jobId?: string | null;
}): Promise<GenerationResult> {
  const db = options.supabase;
  const { data: opportunity, error: oppError } = await db
    .from("seo_opportunities")
    .select("*")
    .eq("id", options.opportunityId)
    .maybeSingle();
  if (oppError) throw oppError;
  if (!opportunity) throw new Error("That SEO opportunity no longer exists.");
  if (opportunity.status === "rejected") {
    return { status: "insufficient", reason: opportunity.reason ?? "This opportunity was rejected." };
  }

  const { data: site } = await db.from("seo_sites").select("*").eq("id", opportunity.seo_site_id).single();
  if (!site) throw new Error("The SEO site for this opportunity is missing.");
  const siteType = site.site_type as SeoSiteType;

  const accounting =
    options.organizationId != null
      ? {
          supabase: db,
          context: {
            organizationId: options.organizationId,
            businessId: opportunity.business_id,
            jobId: options.jobId ?? null,
            operation: "seo_page_generation",
          },
        }
      : undefined;

  let brain: BrainSeoContext | null = null;
  let evidenceIds: string[] = [];
  let brainText = "";
  let prompt = "";
  let ctaHref = "/auth";

  if (siteType === "customer") {
    if (!opportunity.business_id) throw new Error("Customer opportunity is not bound to a business.");
    brain = await loadSeoBrain(db, opportunity.business_id);
    const verifiedFacts = brain.facts.filter((f) => f.verified);
    if (verifiedFacts.length < 6) {
      return {
        status: "insufficient",
        reason: "There is not enough verified Business Brain data to support a public page yet.",
      };
    }
    evidenceIds = verifiedFacts.map((f) => f.id);
    brainText = verifiedFacts
      .map((f) => `- id=${f.id} (${f.category}/${f.subcategory ?? "general"}) ${f.fact_key}: ${f.value_text ?? f.value_number ?? ""}`)
      .join("\n");
    ctaHref = "#contact";
    prompt = [
      `TARGET SEARCH: ${opportunity.keyword}`,
      `SEARCH INTENT: ${opportunity.search_intent ?? "local"}`,
      `PAGE TEMPLATE: ${opportunity.recommended_page_type ?? "service_location"}`,
      `BUSINESS: ${brain.businessName}${brain.industry ? ` (${brain.industry})` : ""}`,
      opportunity.service ? `SERVICE IN FOCUS: ${opportunity.service}` : "",
      opportunity.location ? `SERVICE AREA IN FOCUS: ${opportunity.location}` : "",
      "",
      "VERIFIED BUSINESS FACTS (the ONLY facts you may assert):",
      brainText,
      "",
      "Write a page with these sections, omitting any section the facts cannot support:",
      "intro, services, why_choose, location, booking, faq.",
      "The 'services' section must list only verified services. The 'location' section must only mention verified service areas.",
      "The FAQ must only ask questions the verified facts can answer accurately.",
      "",
      'Return JSON: {"title","meta_title","meta_description","h1","intro","sections":[{"key","heading","body"}],"faq":[{"question","answer"}],"cta":{"label","note"},"used_fact_ids":[]}',
      "meta_title must be 30-60 characters. meta_description must be 90-155 characters.",
      "Write at least 400 words of genuinely useful body copy.",
    ]
      .filter(Boolean)
      .join("\n");
  } else {
    const industry = PLATFORM_INDUSTRIES.find((i) => i.key === opportunity.industry);
    const problem = opportunity.problem ? PLATFORM_PROBLEMS[opportunity.problem] : null;
    ctaHref = "/auth";
    prompt = [
      `TARGET SEARCH: ${opportunity.keyword}`,
      `SEARCH INTENT: ${opportunity.search_intent ?? "commercial"}`,
      `PAGE TEMPLATE: ${opportunity.recommended_page_type ?? "industry_problem"}`,
      industry ? `AUDIENCE: owners of ${industry.plural}` : "AUDIENCE: small business owners",
      problem ? `PROBLEM: ${problem.label}` : "",
      "",
      "Explain the problem concretely for this audience, what usually causes it, what a durable fix looks like,",
      "and how the Business OS loop (Brain -> Diagnosis -> Blueprint -> 90-day plan -> Processes -> Metrics -> Experiments) addresses it.",
      "Be specific to the audience: use their real operational language, not generic business advice.",
      "",
      "Sections: intro, symptoms, what_usually_goes_wrong, how_business_os_helps, what_you_get, faq.",
      'Return JSON: {"title","meta_title","meta_description","h1","intro","sections":[{"key","heading","body"}],"faq":[{"question","answer"}],"cta":{"label","note"}}',
      "The CTA label should invite the owner to build their Business Brain.",
      "meta_title must be 30-60 characters. meta_description must be 90-155 characters.",
      "Write at least 500 words of genuinely useful body copy.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const aiResult = await chatJsonResult<AiPage>({
    model: AI_MODELS.planning,
    maxTokens: 9000,
    ...(accounting ? { accounting } : {}),
    messages: [
      { role: "system", content: siteType === "customer" ? CUSTOMER_SYSTEM : PLATFORM_SYSTEM },
      { role: "user", content: prompt },
    ],
  });

  if (!aiResult.ok) return { status: "ai_failed", reason: aiResult.reason };

  const ai = aiResult.data;
  const content = normaliseContent(ai, ctaHref);
  if (siteType === "customer") {
    const used = (ai.used_fact_ids ?? []).filter((id) => evidenceIds.includes(id));
    content.evidenceFactIds = used.length > 0 ? used : evidenceIds.slice(0, 12);
  }

  const title = (ai.title ?? opportunity.keyword).trim().slice(0, 160);
  const metaTitle = (ai.meta_title ?? title).trim().slice(0, 70);
  const metaDescription = (ai.meta_description ?? "").trim().slice(0, 180);
  const h1 = (ai.h1 ?? title).trim().slice(0, 160);

  const slugBase =
    siteType === "platform" && opportunity.recommended_page_type === "solution"
      ? slugify(String(opportunity.problem ?? opportunity.keyword))
      : siteType === "platform"
        ? slugify([opportunity.industry, opportunity.problem].filter(Boolean).join("-") || opportunity.keyword)
        : slugify(opportunity.keyword);

  const path = pagePath(site, { slug: slugBase, template: opportunity.recommended_page_type });
  const canonical = canonicalFor(site, path);

  // ---- duplicate and originality analysis against this site's existing pages
  const { data: siblings } = await db
    .from("seo_pages")
    .select("id, title, slug, canonical_url, content, status, content_fingerprint")
    .eq("seo_site_id", site.id)
    .neq("opportunity_id", opportunity.id)
    .limit(200);

  const bodyText = contentText(content);
  let maxSimilarity = 0;
  for (const sibling of siblings ?? []) {
    const other = contentText((sibling.content as PageContent | null) ?? null);
    if (!other) continue;
    maxSimilarity = Math.max(maxSimilarity, contentSimilarity(bodyText, other));
  }

  const swapped = [opportunity.location, opportunity.service, brain?.businessName].filter(Boolean) as string[];
  const fingerprint = contentFingerprint(bodyText, swapped);
  const fingerprintClash = (siblings ?? []).some(
    (s) => s.content_fingerprint === fingerprint && s.status !== "archived",
  );
  if (fingerprintClash) maxSimilarity = Math.max(maxSimilarity, 0.95);

  const quality = runQualityGate({
    content,
    title,
    metaTitle,
    metaDescription,
    h1,
    canonicalUrl: canonical,
    keyword: opportunity.keyword,
    schema: buildSchema({ siteType, title, metaDescription, canonical, content, brain, opportunity }),
    brainText,
    siteType,
    maxSimilarity,
    duplicateTitle: (siblings ?? []).some((s) => (s.title ?? "").toLowerCase() === title.toLowerCase()),
    duplicateSlug: (siblings ?? []).some((s) => s.slug.toLowerCase() === slugBase.toLowerCase()),
    duplicateCanonical: (siblings ?? []).some((s) => s.canonical_url === canonical),
    evidenceCount: content.evidenceFactIds?.length ?? 0,
  });

  const schema = buildSchema({ siteType, title, metaDescription, canonical, content, brain, opportunity });
  const status = quality.publishable ? "review" : "draft";

  const { data: existingPage } = await db
    .from("seo_pages")
    .select("id, version, slug")
    .eq("opportunity_id", opportunity.id)
    .maybeSingle();

  const row = {
    seo_site_id: site.id,
    opportunity_id: opportunity.id,
    business_id: opportunity.business_id,
    organization_id: opportunity.organization_id,
    slug: existingPage?.slug ?? slugBase,
    title,
    meta_title: metaTitle,
    meta_description: metaDescription,
    canonical_url: canonical,
    h1,
    content: content as never,
    schema_json: schema as never,
    status: status as Database["public"]["Enums"]["seo_page_status"],
    quality_score: quality.score,
    originality_score: quality.originality,
    business_relevance_score: quality.businessRelevance,
    factual_confidence: quality.factualConfidence,
    word_count: quality.wordCount,
    quality_report: quality as never,
    evidence_fact_ids: (content.evidenceFactIds ?? []) as never,
    content_fingerprint: fingerprint,
    indexable: false,
    updated_at: new Date().toISOString(),
  };

  let pageId: string;
  let version: number;
  if (existingPage) {
    version = (existingPage.version ?? 1) + 1;
    const { error } = await db
      .from("seo_pages")
      .update({ ...row, version })
      .eq("id", existingPage.id);
    if (error) throw error;
    pageId = existingPage.id;
  } else {
    version = 1;
    const { data, error } = await db
      .from("seo_pages")
      .insert({ ...row, version })
      .select("id")
      .single();
    if (error) throw error;
    pageId = data.id;
  }

  await snapshotVersion(db, pageId, version, options.userId ?? null);

  await db
    .from("seo_opportunities")
    .update({ status: "generated", updated_at: new Date().toISOString() })
    .eq("id", opportunity.id);

  await writeAudit({
    supabase: db,
    action: quality.publishable ? "seo.page_generated" : "seo.page_quality_failed",
    businessId: opportunity.business_id,
    organizationId: opportunity.organization_id,
    userId: options.userId ?? null,
    actor: "system",
    entity: "seo_pages",
    entityId: pageId,
    after: { title, status, qualityScore: quality.score, version },
    metadata: {
      keyword: opportunity.keyword,
      failures: quality.checks.filter((c) => !c.passed).map((c) => c.key),
    },
  });

  if (!quality.publishable) {
    return {
      status: "quality_failed",
      pageId,
      qualityScore: quality.score,
      reason: quality.checks.find((c) => c.blocking && !c.passed)?.detail ?? "Below the quality threshold.",
    };
  }

  return { status: "generated", pageId, qualityScore: quality.score };
}

function buildSchema(options: {
  siteType: SeoSiteType;
  title: string;
  metaDescription: string;
  canonical: string;
  content: PageContent;
  brain: BrainSeoContext | null;
  opportunity: OppRow;
}): Record<string, unknown> {
  const faq =
    options.content.faq.length > 0
      ? {
          "@type": "FAQPage",
          mainEntity: options.content.faq.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  if (options.siteType === "customer" && options.brain) {
    return {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: options.brain.businessName,
      description: options.metaDescription,
      url: options.canonical,
      ...(options.opportunity.location ? { areaServed: options.opportunity.location } : {}),
      ...(faq ? { subjectOf: faq } : {}),
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: options.title,
    description: options.metaDescription,
    url: options.canonical,
    publisher: { "@type": "Organization", name: "Business OS" },
    ...(faq ? { subjectOf: faq } : {}),
  };
}

async function snapshotVersion(db: Client, pageId: string, version: number, userId: string | null) {
  const { data: page } = await db.from("seo_pages").select("*").eq("id", pageId).single();
  if (!page) return;
  await db.from("seo_page_versions").upsert(
    {
      page_id: pageId,
      business_id: page.business_id,
      organization_id: page.organization_id,
      version,
      title: page.title,
      meta_title: page.meta_title,
      meta_description: page.meta_description,
      h1: page.h1,
      slug: page.slug,
      canonical_url: page.canonical_url,
      content: page.content,
      schema_json: page.schema_json,
      quality_score: page.quality_score,
      originality_score: page.originality_score,
      business_relevance_score: page.business_relevance_score,
      factual_confidence: page.factual_confidence,
      quality_report: page.quality_report,
      status: page.status,
      published_at: page.published_at,
      created_by: userId,
    },
    { onConflict: "page_id,version" },
  );
}

/* ------------------------------------------------------------------ enqueueing */

/** Deterministic job key so the same opportunity never generates twice. */
export function seoGenerationKey(opportunityId: string, templateVersion: string) {
  return `seo-generation:${opportunityId}:${templateVersion}`;
}

export async function enqueueSeoGeneration(options: {
  supabase: Client;
  opportunityIds: string[];
  userId: string;
}): Promise<{ enqueued: number; skipped: number }> {
  const { enqueueJob, kickWorker } = await import("./jobs.server");
  let enqueued = 0;
  let skipped = 0;

  // Never allow an unrestricted "generate everything" operation.
  const ids = options.opportunityIds.slice(0, 10);

  for (const opportunityId of ids) {
    const { data: opportunity } = await options.supabase
      .from("seo_opportunities")
      .select("id, status, business_id, organization_id, seo_site_id")
      .eq("id", opportunityId)
      .maybeSingle();
    if (!opportunity || opportunity.status === "rejected" || !opportunity.organization_id) {
      skipped += 1;
      continue;
    }
    if (!opportunity.business_id) {
      skipped += 1;
      continue;
    }
    await enqueueJob({
      jobType: "seo_page_generation",
      organizationId: opportunity.organization_id,
      businessId: opportunity.business_id,
      idempotencyKey: seoGenerationKey(opportunity.id, "v1"),
      input: { opportunityId: opportunity.id, userId: options.userId },
      priority: 6,
    });
    enqueued += 1;
  }

  if (enqueued > 0) kickWorker(["seo_page_generation"]);
  return { enqueued, skipped };
}

/* ------------------------------------------------------------------ review / publish */

export async function updatePage(options: {
  supabase: Client;
  pageId: string;
  userId: string;
  patch: {
    title?: string | undefined;
    metaTitle?: string | undefined;
    metaDescription?: string | undefined;
    h1?: string | undefined;
    intro?: string | undefined;
    sections?: { key: string; heading: string; body: string }[] | undefined;
    reviewNotes?: string | undefined;
  };
}): Promise<PageDetail> {
  const db = options.supabase;
  const { data: page, error } = await db.from("seo_pages").select("*").eq("id", options.pageId).single();
  if (error) throw error;

  const content = ((page.content as PageContent | null) ?? {
    intro: "",
    sections: [],
    faq: [],
    cta: { label: "Contact", href: "#contact" },
  }) as PageContent;
  if (options.patch.intro != null) content.intro = options.patch.intro;
  if (options.patch.sections) content.sections = options.patch.sections;

  const version = (page.version ?? 1) + 1;
  const { error: updateError } = await db
    .from("seo_pages")
    .update({
      title: options.patch.title ?? page.title,
      meta_title: options.patch.metaTitle ?? page.meta_title,
      meta_description: options.patch.metaDescription ?? page.meta_description,
      h1: options.patch.h1 ?? page.h1,
      content: content as never,
      review_notes: options.patch.reviewNotes ?? page.review_notes,
      version,
      updated_at: new Date().toISOString(),
    })
    .eq("id", options.pageId);
  if (updateError) throw updateError;

  await snapshotVersion(db, options.pageId, version, options.userId);
  await writeAudit({
    supabase: db,
    action: "seo.page_updated",
    businessId: page.business_id,
    organizationId: page.organization_id,
    userId: options.userId,
    entity: "seo_pages",
    entityId: page.id,
    after: { version },
  });

  return loadPage(db, options.pageId);
}

const TRANSITIONS: Record<string, string[]> = {
  draft: ["review", "archived"],
  generating: ["draft", "review"],
  review: ["approved", "draft", "archived"],
  approved: ["published", "review", "archived"],
  published: ["paused", "archived"],
  paused: ["published", "archived"],
  archived: [],
};

export async function setPageStatus(options: {
  supabase: Client;
  pageId: string;
  status: "review" | "approved" | "published" | "paused" | "archived" | "draft";
  userId: string;
  note?: string | null;
}): Promise<{ ok: boolean; reason?: string | undefined; page?: PageDetail | undefined }> {
  const db = options.supabase;
  const { data: page, error } = await db.from("seo_pages").select("*").eq("id", options.pageId).single();
  if (error) throw error;

  const allowed = TRANSITIONS[page.status] ?? [];
  if (!allowed.includes(options.status)) {
    return { ok: false, reason: `A ${page.status} page cannot move to ${options.status}.` };
  }

  if (options.status === "published") {
    const gate = await verifyPublishable(db, page);
    if (!gate.ok) return { ok: false, reason: gate.reason };
  }

  const now = new Date().toISOString();
  const publishing = options.status === "published";
  const hiding = options.status === "paused" || options.status === "archived";
  const patch = {
    status: options.status as Database["public"]["Enums"]["seo_page_status"],
    updated_at: now,
    review_notes: options.note ?? page.review_notes,
    ...(publishing
      ? { published_at: page.published_at ?? now, indexable: true, last_refreshed_at: now }
      : {}),
    ...(hiding ? { indexable: false } : {}),
  };

  const { error: updateError } = await db.from("seo_pages").update(patch).eq("id", options.pageId);
  if (updateError) throw updateError;

  await snapshotVersion(db, options.pageId, page.version ?? 1, options.userId);

  if (options.status === "published") {
    await db
      .from("seo_sites")
      .update({ sitemap_status: "current", updated_at: now })
      .eq("id", page.seo_site_id);
    if (page.opportunity_id) {
      await db.from("seo_opportunities").update({ status: "published", updated_at: now }).eq("id", page.opportunity_id);
    }
  }

  const action =
    options.status === "published"
      ? "seo.page_published"
      : options.status === "approved"
        ? "seo.page_approved"
        : options.status === "paused"
          ? "seo.page_paused"
          : options.status === "archived"
            ? "seo.page_archived"
            : "seo.page_updated";

  await writeAudit({
    supabase: db,
    action: action as never,
    businessId: page.business_id,
    organizationId: page.organization_id,
    userId: options.userId,
    entity: "seo_pages",
    entityId: page.id,
    before: { status: page.status },
    after: { status: options.status },
  });

  return { ok: true, page: await loadPage(db, options.pageId) };
}

/** Final server-side gate. Nothing reaches the public site without passing it. */
async function verifyPublishable(db: Client, page: PageRow): Promise<{ ok: boolean; reason: string }> {
  const quality = (page.quality_report ?? null) as QualityReport | null;
  if (!quality || Number(page.quality_score ?? 0) < QUALITY_THRESHOLD) {
    return {
      ok: false,
      reason: `Quality score ${Math.round(Number(page.quality_score ?? 0))} is below the ${QUALITY_THRESHOLD} threshold.`,
    };
  }
  if (quality.checks.some((c) => c.blocking && !c.passed)) {
    return { ok: false, reason: "A blocking quality check is still failing." };
  }
  if (!page.canonical_url) return { ok: false, reason: "The page has no canonical URL." };

  const { data: published } = await db
    .from("seo_pages")
    .select("id, title, slug, canonical_url, content, content_fingerprint")
    .eq("seo_site_id", page.seo_site_id)
    .eq("status", "published")
    .neq("id", page.id)
    .limit(200);

  for (const other of published ?? []) {
    if (other.canonical_url === page.canonical_url) return { ok: false, reason: "Another published page uses this canonical URL." };
    if (other.slug.toLowerCase() === page.slug.toLowerCase()) return { ok: false, reason: "Another published page uses this slug." };
    if ((other.title ?? "").toLowerCase() === (page.title ?? "").toLowerCase())
      return { ok: false, reason: "Another published page uses this title." };
    if (other.content_fingerprint && other.content_fingerprint === page.content_fingerprint)
      return { ok: false, reason: "This page is a near-identical variant of an already published page." };
    const similarity = contentSimilarity(
      contentText(page.content as PageContent | null),
      contentText(other.content as PageContent | null),
    );
    if (similarity >= DUPLICATE_SIMILARITY_LIMIT) {
      return {
        ok: false,
        reason: `This page is ${(similarity * 100).toFixed(0)}% similar to an already published page.`,
      };
    }
  }

  return { ok: true, reason: "" };
}

/* ------------------------------------------------------------------ measurement */

export async function recordPageMeasurement(options: {
  supabase: Client;
  pageId: string;
  metricKey: string;
  value: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  source?: string;
  note?: string | null;
  userId: string;
}): Promise<void> {
  const db = options.supabase;
  const { data: page, error } = await db
    .from("seo_pages")
    .select("id, business_id, organization_id, title, slug")
    .eq("id", options.pageId)
    .single();
  if (error) throw error;

  const { error: insertError } = await db.from("seo_page_measurements").insert({
    page_id: page.id,
    business_id: page.business_id,
    organization_id: page.organization_id,
    metric_key: options.metricKey,
    value: options.value,
    period_start: options.periodStart ?? null,
    period_end: options.periodEnd ?? null,
    source: options.source ?? "manual",
    note: options.note ?? null,
    recorded_by: options.userId,
  });
  if (insertError) throw insertError;

  // Meaningful outcomes become Brain memories — described, never causally claimed.
  if (page.business_id && ["leads", "enquiries", "bookings"].includes(options.metricKey) && options.value >= 5) {
    await writeMemory({
      supabase: db,
      memory: {
        businessId: page.business_id,
        memoryType: "seo_outcome",
        title: `SEO page result: ${page.title ?? page.slug}`,
        content: [
          `The published SEO page "${page.title ?? page.slug}" recorded ${options.value} ${options.metricKey}`,
          options.periodStart && options.periodEnd ? ` between ${options.periodStart} and ${options.periodEnd}` : "",
          `. Source of this measurement: ${options.source ?? "manual"}.`,
          " This is an observed association, not a proven cause.",
        ].join(""),
        metadata: {
          pageId: page.id,
          metric: options.metricKey,
          value: options.value,
          periodStart: options.periodStart ?? null,
          periodEnd: options.periodEnd ?? null,
          source: options.source ?? "manual",
        },
        sourceTable: "seo_pages",
        sourceId: page.id,
        confidence: options.source === "manual" ? 60 : 75,
        importance: 60,
      },
    });
  }
}

/* ------------------------------------------------------------------ reads */

function toPageView(row: PageRow, site: SiteRow, keyword?: string | null): PageView {
  return {
    id: row.id,
    siteId: row.seo_site_id,
    siteType: site.site_type as SeoSiteType,
    businessId: row.business_id,
    opportunityId: row.opportunity_id,
    slug: row.slug,
    path: pagePath(site, { slug: row.slug, template: null }),
    title: row.title,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    canonicalUrl: row.canonical_url,
    h1: row.h1,
    status: row.status,
    qualityScore: row.quality_score == null ? null : Number(row.quality_score),
    originalityScore: row.originality_score == null ? null : Number(row.originality_score),
    businessRelevanceScore: row.business_relevance_score == null ? null : Number(row.business_relevance_score),
    factualConfidence: row.factual_confidence == null ? null : Number(row.factual_confidence),
    wordCount: row.word_count,
    version: row.version ?? 1,
    indexable: row.indexable,
    reviewNotes: row.review_notes,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    keyword: keyword ?? null,
  };
}

export async function loadPage(db: Client, pageId: string): Promise<PageDetail> {
  const { data: page, error } = await db.from("seo_pages").select("*").eq("id", pageId).single();
  if (error) throw error;
  const { data: site } = await db.from("seo_sites").select("*").eq("id", page.seo_site_id).single();
  if (!site) throw new Error("SEO site missing.");

  const [{ data: opportunity }, { data: versions }, { data: measurements }] = await Promise.all([
    page.opportunity_id
      ? db.from("seo_opportunities").select("keyword, recommended_page_type").eq("id", page.opportunity_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("seo_page_versions")
      .select("version, status, quality_score, published_at, created_at, title")
      .eq("page_id", pageId)
      .order("version", { ascending: false })
      .limit(30),
    db
      .from("seo_page_measurements")
      .select("*")
      .eq("page_id", pageId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const factIds = (page.evidence_fact_ids ?? []) as string[];
  const evidence = factIds.length
    ? (
        await db
          .from("brain_facts")
          .select("id, category, fact_key, value_text, value_number, verified")
          .in("id", factIds.slice(0, 40))
      ).data ?? []
    : [];

  const view = toPageView(page, site, opportunity?.keyword ?? null);
  view.path = pagePath(site, { slug: page.slug, template: opportunity?.recommended_page_type ?? null });

  return {
    ...view,
    content: (page.content as PageContent | null) ?? null,
    schema: (page.schema_json as SeoJson | null) ?? null,
    quality: (page.quality_report as QualityReport | null) ?? null,
    evidence: evidence.map((f) => ({
      id: f.id,
      category: f.category,
      factKey: f.fact_key,
      value: f.value_text ?? (f.value_number != null ? String(f.value_number) : ""),
      verified: f.verified,
    })),
    versions: (versions ?? []).map((v) => ({
      version: v.version,
      status: v.status,
      qualityScore: v.quality_score == null ? null : Number(v.quality_score),
      publishedAt: v.published_at,
      createdAt: v.created_at,
      title: v.title,
    })),
    measurements: (measurements ?? []).map((m) => ({
      id: m.id,
      metricKey: m.metric_key,
      value: Number(m.value),
      periodStart: m.period_start,
      periodEnd: m.period_end,
      source: m.source,
      note: m.note,
      createdAt: m.created_at,
    })),
  };
}

export async function loadSeoOverview(options: {
  supabase: Client;
  businessId: string;
  scope: SeoSiteType;
}): Promise<SeoOverview> {
  const { supabase, businessId } = options;

  const site =
    options.scope === "customer"
      ? await ensureCustomerSite({ supabase, businessId })
      : await getPlatformSite(supabase);

  const [{ data: pages }, { data: opportunities }, { data: measurements }] = await Promise.all([
    supabase.from("seo_pages").select("*").eq("seo_site_id", site.id).order("updated_at", { ascending: false }).limit(300),
    supabase
      .from("seo_opportunities")
      .select("*")
      .eq("seo_site_id", site.id)
      .order("opportunity_score", { ascending: false, nullsFirst: false })
      .limit(200),
    supabase.from("seo_page_measurements").select("metric_key, value, source").eq("business_id", businessId).limit(500),
  ]);

  const pageRows = pages ?? [];
  const counts = {
    published: pageRows.filter((p) => p.status === "published").length,
    draft: pageRows.filter((p) => p.status === "draft").length,
    review: pageRows.filter((p) => p.status === "review").length,
    approved: pageRows.filter((p) => p.status === "approved").length,
    paused: pageRows.filter((p) => p.status === "paused").length,
    archived: pageRows.filter((p) => p.status === "archived").length,
    qualityFailures: pageRows.filter((p) => Number(p.quality_score ?? 0) < QUALITY_THRESHOLD && p.status !== "archived").length,
    opportunities: (opportunities ?? []).length,
    qualified: (opportunities ?? []).filter((o) => o.status === "qualified").length,
    rejected: (opportunities ?? []).filter((o) => o.status === "rejected").length,
  };

  const measuredMap = new Map<string, { metricKey: string; total: number; source: string }>();
  for (const row of measurements ?? []) {
    const key = `${row.metric_key}:${row.source}`;
    const bucket = measuredMap.get(key) ?? { metricKey: row.metric_key, total: 0, source: row.source };
    bucket.total += Number(row.value);
    measuredMap.set(key, bucket);
  }

  const brain = await loadSeoBrain(supabase, businessId);
  const verifiedServices = verifiedOnly(brain.services);
  const verifiedLocations = verifiedOnly(brain.locations);

  const { listJobs } = await import("./jobs.server");
  const jobs = await listJobs({ supabase, businessId, jobTypes: ["seo_page_generation"], limit: 8 });

  const opportunityViews = (opportunities ?? []).map((o) => toOpportunityView(o, site.site_type as SeoSiteType));
  const pageByOpportunity = new Map(pageRows.filter((p) => p.opportunity_id).map((p) => [p.opportunity_id!, p.id]));
  for (const view of opportunityViews) view.pageId = pageByOpportunity.get(view.id) ?? null;

  return {
    site: {
      id: site.id,
      siteType: site.site_type as SeoSiteType,
      name: site.name,
      domain: site.domain,
      subdomain: site.subdomain,
      status: site.status,
      sitemapStatus: site.sitemap_status,
      robotsStatus: site.robots_status,
      urlPattern: site.url_pattern,
    },
    counts,
    measured: [...measuredMap.values()],
    brain: {
      services: verifiedServices.map((s) => s.value).slice(0, 12),
      locations: verifiedLocations.map((l) => l.value).slice(0, 12),
      verifiedServices: verifiedServices.length,
      verifiedLocations: verifiedLocations.length,
      ready: verifiedServices.length > 0,
      reason:
        verifiedServices.length === 0
          ? "Business Discovery has not yet established what this business sells, so no customer pages can be grounded."
          : verifiedLocations.length === 0
            ? "No verified service areas yet — local pages stay locked until you confirm where you work."
            : "The Business Brain holds enough verified information to ground pages.",
    },
    opportunities: opportunityViews,
    pages: pageRows.map((p) => toPageView(p, site)),
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      label: j.label,
      progress: j.progress,
      errorMessage: j.errorMessage,
    })),
  };
}

/* ------------------------------------------------------------------ public reads */

export type PublicPage = {
  title: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  h1: string;
  content: PageContent;
  schema: unknown;
  updatedAt: string;
  publishedAt: string | null;
  businessName: string | null;
};

/** Anonymous read of a published page. RLS allows published rows only. */
export async function loadPublishedPage(options: {
  siteType: SeoSiteType;
  slug: string;
  siteId?: string;
}): Promise<PublicPage | null> {
  const db = await publicClient();

  let query = db
    .from("seo_pages")
    .select("*, seo_sites!inner(id, site_type, business_id, url_pattern, domain)")
    .eq("status", "published")
    .ilike("slug", options.slug);
  if (options.siteId) query = query.eq("seo_site_id", options.siteId);
  else query = query.eq("seo_sites.site_type", options.siteType);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error || !data) return null;

  let businessName: string | null = null;
  if (data.business_id) {
    const { data: business } = await db.from("businesses").select("name").eq("id", data.business_id).maybeSingle();
    businessName = business?.name ?? null;
  }

  return {
    title: data.title ?? options.slug,
    metaTitle: data.meta_title ?? data.title ?? options.slug,
    metaDescription: data.meta_description ?? "",
    canonicalUrl: data.canonical_url ?? `${PUBLIC_BASE_URL}/${options.slug}`,
    h1: data.h1 ?? data.title ?? options.slug,
    content: (data.content as PageContent | null) ?? { intro: "", sections: [], faq: [], cta: { label: "Get started", href: "/auth" } },
    schema: data.schema_json,
    updatedAt: data.updated_at,
    publishedAt: data.published_at,
    businessName,
  };
}

export type SitemapEntry = { path: string; lastmod: string | null };

/** Sitemap entries come from published pages only. */
export async function listSitemapEntries(): Promise<SitemapEntry[]> {
  const db = await publicClient();
  const entries: SitemapEntry[] = [];
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from("seo_pages")
      .select("slug, updated_at, published_at, seo_sites!inner(id, site_type, url_pattern), opportunity_id")
      .eq("status", "published")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error || !data) break;

    for (const row of data) {
      const site = row.seo_sites as unknown as { id: string; site_type: string; url_pattern: string };
      const path =
        site.site_type === "platform"
          ? `/business-os-for/${row.slug}`
          : `/sites/${site.id}${(site.url_pattern || "/{slug}").replace("{slug}", row.slug)}`;
      entries.push({ path, lastmod: row.updated_at ?? row.published_at });
    }
    if (data.length < pageSize) break;
  }

  return entries;
}

/** Server-side anonymous client: public content only, RLS still applies. */
async function publicClient(): Promise<Client> {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  }) as unknown as Client;
}

/** Platform-side operations run privileged, after an org-admin check. */
export async function runPlatformDiscovery(options: {
  supabase: Client;
  organizationId: string;
  userId: string;
}): Promise<{ created: OpportunityView[]; existing: number }> {
  const { data: isAdmin } = await options.supabase.rpc("is_org_admin", { target_org: options.organizationId });
  if (!isAdmin) throw new Error("Only an organisation owner or admin can run platform SEO discovery.");
  const db = await admin();
  return discoverPlatformOpportunities({ db, userId: options.userId, organizationId: options.organizationId });
}

export async function runPlatformGeneration(options: {
  supabase: Client;
  organizationId: string;
  userId: string;
  opportunityIds: string[];
}): Promise<{ generated: number; failed: number; reasons: string[] }> {
  const { data: isAdmin } = await options.supabase.rpc("is_org_admin", { target_org: options.organizationId });
  if (!isAdmin) throw new Error("Only an organisation owner or admin can generate platform SEO pages.");
  const db = await admin();

  let generated = 0;
  let failed = 0;
  const reasons: string[] = [];
  for (const opportunityId of options.opportunityIds.slice(0, 3)) {
    const result = await generateSeoPage({
      supabase: db,
      opportunityId,
      userId: options.userId,
      organizationId: options.organizationId,
    });
    if (result.status === "generated") generated += 1;
    else {
      failed += 1;
      if (result.reason) reasons.push(result.reason);
    }
  }
  return { generated, failed, reasons };
}

export async function setPlatformPageStatus(options: {
  supabase: Client;
  organizationId: string;
  userId: string;
  pageId: string;
  status: "review" | "approved" | "published" | "paused" | "archived" | "draft";
}) {
  const { data: isAdmin } = await options.supabase.rpc("is_org_admin", { target_org: options.organizationId });
  if (!isAdmin) throw new Error("Only an organisation owner or admin can change platform SEO pages.");
  const db = await admin();
  return setPageStatus({ supabase: db, pageId: options.pageId, status: options.status, userId: options.userId });
}
