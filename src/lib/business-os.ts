/**
 * Shared vocabulary for the Business OS core loop.
 * Pure data + types only — no data fetching, no browser APIs.
 * The persistence layer lands once the authoritative migration is applied.
 */

export type LoopStageId =
  | "onboarding"
  | "dna"
  | "brain"
  | "diagnosis"
  | "blueprint"
  | "action"
  | "execution"
  | "measurement"
  | "learning";

export type LoopStage = {
  id: LoopStageId;
  index: number;
  label: string;
  summary: string;
};

export const LOOP_STAGES: LoopStage[] = [
  {
    id: "onboarding",
    index: 1,
    label: "Business onboarding",
    summary: "The basics: what the business does, where, and for whom.",
  },
  {
    id: "dna",
    index: 2,
    label: "Business DNA interview",
    summary: "An adaptive conversation that maps how the business actually works.",
  },
  {
    id: "brain",
    index: 3,
    label: "Business Brain",
    summary: "Structured facts, evidence and confidence — the source of truth.",
  },
  {
    id: "diagnosis",
    index: 4,
    label: "Diagnosis",
    summary: "Where the constraints and the largest opportunities sit today.",
  },
  {
    id: "blueprint",
    index: 5,
    label: "Blueprint",
    summary: "Positioning, offer, acquisition, retention and operating model.",
  },
  {
    id: "action",
    index: 6,
    label: "Action plan",
    summary: "The next 90 days, sequenced by impact and effort.",
  },
  {
    id: "execution",
    index: 7,
    label: "Execution",
    summary: "Processes, owners and automation carrying the plan out.",
  },
  {
    id: "measurement",
    index: 8,
    label: "Measurement",
    summary: "What actually moved, against a stated baseline.",
  },
  {
    id: "learning",
    index: 9,
    label: "Learning",
    summary: "Outcomes feed back and the Brain's understanding is revised.",
  },
];

export type Confidence = "high" | "medium" | "low" | "inferred";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  inferred: "AI inference",
};

export type VerificationState = "verified" | "unverified" | "conflicted" | "obsolete";

export const VERIFICATION_LABEL: Record<VerificationState, string> = {
  verified: "Verified",
  unverified: "Unverified",
  conflicted: "Conflict",
  obsolete: "Obsolete",
};

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4;

export const AUTONOMY_LABEL: Record<AutonomyLevel, string> = {
  0: "Observe",
  1: "Recommend",
  2: "Prepare",
  3: "Approval required",
  4: "Autonomous",
};

export const BRAIN_CATEGORIES = [
  "Overview",
  "Identity",
  "Customers",
  "Offers",
  "Operations",
  "Marketing",
  "Sales",
  "Economics",
  "People",
  "Technology",
  "Goals",
  "Evidence",
  "AI Memory",
] as const;

export const DIAGNOSIS_CATEGORIES = [
  "Revenue",
  "Marketing",
  "Sales",
  "Conversion",
  "Retention",
  "Operations",
  "Finance",
  "Automation",
  "Owner dependency",
  "Growth",
  "SEO",
] as const;

export const BLUEPRINT_SECTIONS = [
  "Positioning",
  "Ideal customer",
  "Core problem",
  "Transformation",
  "Differentiation",
  "Offer",
  "Pricing strategy",
  "Acquisition strategy",
  "Retention strategy",
  "Operating model",
  "Owner role",
  "Growth strategy",
] as const;

export const INTERVIEW_STAGES = [
  "Identity & positioning",
  "Customers & acquisition",
  "Offers & pricing",
  "Operations & delivery",
  "People & owner dependency",
  "Economics & finance",
  "Goals & constraints",
] as const;
