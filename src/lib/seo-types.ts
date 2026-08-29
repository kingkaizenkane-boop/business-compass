/**
 * Client-safe SEO types, vocabularies and pure helpers.
 *
 * Two architecturally distinct engines share this file:
 *   PLATFORM  — acquisition pages for Business OS itself.
 *   CUSTOMER  — pages a Business OS customer publishes for its own business.
 *
 * Nothing here touches the database or the AI gateway.
 */

export const SEO_SITE_TYPES = ["platform", "customer"] as const;
export type SeoSiteType = (typeof SEO_SITE_TYPES)[number];

export const OPPORTUNITY_STATUSES = [
  "discovered",
  "qualified",
  "rejected",
  "generated",
  "published",
  "archived",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const PAGE_STATUSES = [
  "draft",
  "generating",
  "review",
  "approved",
  "published",
  "paused",
  "archived",
] as const;
export type SeoPageStatus = (typeof PAGE_STATUSES)[number];

export const PAGE_STATUS_LABELS: Record<SeoPageStatus, string> = {
  draft: "Draft",
  generating: "Generating",
  review: "Awaiting review",
  approved: "Approved",
  published: "Published",
  paused: "Paused",
  archived: "Archived",
};

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  discovered: "Discovered",
  qualified: "Qualified",
  rejected: "Rejected",
  generated: "Page generated",
  published: "Published",
  archived: "Archived",
};

/** The five deterministic components of an opportunity score. */
export const SCORE_WEIGHTS = {
  intentFit: 0.25,
  businessRelevance: 0.25,
  contentValue: 0.2,
  commercialIntent: 0.15,
  competitionOpportunity: 0.15,
} as const;

export type ScoreComponents = {
  intentFit: number;
  businessRelevance: number;
  contentValue: number;
  commercialIntent: number;
  competitionOpportunity: number;
};

/** The server is the only authority on the final score. */
export function computeOpportunityScore(components: ScoreComponents): number {
  const clamp = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
  const total =
    clamp(components.intentFit) * SCORE_WEIGHTS.intentFit +
    clamp(components.businessRelevance) * SCORE_WEIGHTS.businessRelevance +
    clamp(components.contentValue) * SCORE_WEIGHTS.contentValue +
    clamp(components.commercialIntent) * SCORE_WEIGHTS.commercialIntent +
    clamp(components.competitionOpportunity) * SCORE_WEIGHTS.competitionOpportunity;
  return Math.round(total);
}

/** Minimum deterministic quality score a page needs before it may publish. */
export const QUALITY_THRESHOLD = 75;

/** Above this similarity to an existing page, content counts as near-duplicate. */
export const DUPLICATE_SIMILARITY_LIMIT = 0.82;

export const SEARCH_INTENTS = [
  "informational",
  "commercial",
  "transactional",
  "local",
  "navigational",
] as const;
export type SearchIntent = (typeof SEARCH_INTENTS)[number];

/* ------------------------------------------------------------------ platform catalogue */

export type PlatformIndustry = {
  key: string;
  label: string;
  plural: string;
  /** Owner problems where a dedicated page genuinely has something to say. */
  problems: string[];
};

export const PLATFORM_PROBLEMS: Record<string, { label: string; intent: SearchIntent }> = {
  "get-more-customers": { label: "get more customers", intent: "commercial" },
  "automate-bookings": { label: "automate bookings", intent: "commercial" },
  "improve-customer-retention": { label: "improve customer retention", intent: "informational" },
  "reduce-owner-dependency": { label: "reduce owner dependency", intent: "informational" },
  "improve-sales-follow-up": { label: "improve sales follow-up", intent: "commercial" },
  "increase-repeat-business": { label: "increase repeat business", intent: "informational" },
};

export const PLATFORM_INDUSTRIES: PlatformIndustry[] = [
  {
    key: "barbers",
    label: "barber",
    plural: "barbers",
    problems: ["improve-customer-retention", "automate-bookings", "increase-repeat-business", "get-more-customers"],
  },
  {
    key: "house-painters",
    label: "house painter",
    plural: "house painters",
    problems: ["get-more-customers", "improve-sales-follow-up", "reduce-owner-dependency"],
  },
  {
    key: "immigration-solicitors",
    label: "immigration solicitor",
    plural: "immigration solicitors",
    problems: ["improve-sales-follow-up", "reduce-owner-dependency", "get-more-customers"],
  },
  {
    key: "restaurants",
    label: "restaurant",
    plural: "restaurants",
    problems: ["increase-repeat-business", "improve-customer-retention", "get-more-customers"],
  },
  {
    key: "accountants",
    label: "accountant",
    plural: "accountants",
    problems: ["reduce-owner-dependency", "improve-sales-follow-up", "improve-customer-retention"],
  },
  {
    key: "photographers",
    label: "photographer",
    plural: "photographers",
    problems: ["get-more-customers", "improve-sales-follow-up", "automate-bookings"],
  },
  {
    key: "consultants",
    label: "consultant",
    plural: "consultants",
    problems: ["reduce-owner-dependency", "improve-sales-follow-up"],
  },
  {
    key: "plumbers",
    label: "plumber",
    plural: "plumbers",
    problems: ["get-more-customers", "automate-bookings", "improve-sales-follow-up"],
  },
  {
    key: "electricians",
    label: "electrician",
    plural: "electricians",
    problems: ["get-more-customers", "automate-bookings", "reduce-owner-dependency"],
  },
];

export const PLATFORM_STAGES: Record<string, string> = {
  solo: "solo owner",
  "small-team": "small team",
  growing: "growing business",
};

/* ------------------------------------------------------------------ shapes */

export type PageSection = { key: string; heading: string; body: string };

export type PageContent = {
  intro: string;
  sections: PageSection[];
  faq: { question: string; answer: string }[];
  cta: { label: string; href: string; note?: string };
  /** Brain fact ids that support the factual claims on the page. */
  evidenceFactIds?: string[];
};

export type QualityCheck = {
  key: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  detail: string;
  score: number;
};

export type QualityReport = {
  score: number;
  originality: number;
  businessRelevance: number;
  factualConfidence: number;
  wordCount: number;
  checks: QualityCheck[];
  publishable: boolean;
};

export type OpportunityView = {
  id: string;
  siteId: string;
  siteType: SeoSiteType;
  businessId: string | null;
  keyword: string;
  intent: string | null;
  topic: string | null;
  location: string | null;
  service: string | null;
  industry: string | null;
  problem: string | null;
  businessStage: string | null;
  score: number | null;
  relevanceScore: number | null;
  competitionScore: number | null;
  businessFitScore: number | null;
  contentValueScore: number | null;
  commercialScore: number | null;
  status: OpportunityStatus;
  reason: string | null;
  recommendedPageType: string | null;
  createdAt: string;
  pageId?: string | null;
};

export type PageView = {
  id: string;
  siteId: string;
  siteType: SeoSiteType;
  businessId: string | null;
  opportunityId: string | null;
  slug: string;
  path: string;
  title: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  h1: string | null;
  status: SeoPageStatus;
  qualityScore: number | null;
  originalityScore: number | null;
  businessRelevanceScore: number | null;
  factualConfidence: number | null;
  wordCount: number | null;
  version: number;
  indexable: boolean;
  reviewNotes: string | null;
  publishedAt: string | null;
  updatedAt: string;
  keyword?: string | null;
};

export type PageDetail = PageView & {
  content: PageContent | null;
  schema: Record<string, unknown> | null;
  quality: QualityReport | null;
  evidence: { id: string; category: string; factKey: string; value: string; verified: boolean }[];
  versions: {
    version: number;
    status: string | null;
    qualityScore: number | null;
    publishedAt: string | null;
    createdAt: string;
    title: string | null;
  }[];
  measurements: {
    id: string;
    metricKey: string;
    value: number;
    periodStart: string | null;
    periodEnd: string | null;
    source: string;
    note: string | null;
    createdAt: string;
  }[];
};

export type SeoOverview = {
  site: {
    id: string;
    siteType: SeoSiteType;
    name: string | null;
    domain: string | null;
    subdomain: string | null;
    status: string;
    sitemapStatus: string;
    robotsStatus: string;
    urlPattern: string;
  } | null;
  counts: {
    published: number;
    draft: number;
    review: number;
    approved: number;
    paused: number;
    archived: number;
    qualityFailures: number;
    opportunities: number;
    qualified: number;
    rejected: number;
  };
  /** Real measurements only — never invented search-engine data. */
  measured: { metricKey: string; total: number; source: string }[];
  brain: {
    services: string[];
    locations: string[];
    verifiedServices: number;
    verifiedLocations: number;
    ready: boolean;
    reason: string;
  };
  opportunities: OpportunityView[];
  pages: PageView[];
  jobs: { id: string; status: string; label: string; progress: string | null; errorMessage: string | null }[];
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);
}

export function scoreTone(score: number | null | undefined): "good" | "warn" | "bad" {
  if (score == null) return "warn";
  if (score >= QUALITY_THRESHOLD) return "good";
  if (score >= 55) return "warn";
  return "bad";
}
