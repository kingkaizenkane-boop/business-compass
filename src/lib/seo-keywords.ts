/**
 * Deterministic keyword hygiene for the SEO engine.
 *
 * Everything here is pure and shared by the server engine and the UI, so the
 * reason a keyword was accepted or refused is identical in both places.
 *
 * Two rules drive the whole file:
 *  1. A keyword must read like something a human would type into a search box.
 *  2. Internal vocabulary (test markers, notes, placeholders, record ids) must
 *     never leak into a public keyword or page.
 */

/** Bracketed markers such as "[TEST]", "(demo)" and "{internal}". */
const BRACKETED = /[[({<][^\])}>]*[\])}>]/g;

/** Tokens that mean "this is internal", never "this is what people search for". */
const NOISE_TOKENS = new Set([
  "test",
  "tests",
  "testing",
  "demo",
  "demos",
  "sample",
  "samples",
  "example",
  "dummy",
  "placeholder",
  "internal",
  "draft",
  "staging",
  "sandbox",
  "lorem",
  "ipsum",
  "todo",
  "tbc",
  "tbd",
  "note",
  "notes",
  "misc",
  "various",
  "unknown",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
  "xxx",
  "asdf",
  "qa",
]);

/** Words that betray a sentence or a commentary rather than a name. */
const SENTENCE_LIKE =
  /[.;:!?]|\b(is|are|was|were|we|our|us|they|their|because|which|that|will|should|would|could|currently|approximately|per|via|about)\b/i;

/** Numbers, currency and percentages belong to metrics, not to keywords. */
const STAT_LIKE = /[0-9%£$€]|percent|per cent/i;

/** Anything that looks like an identifier rather than language. */
const ID_LIKE = /\b[0-9a-f]{8}-[0-9a-f]{4}|\b[a-z]+_[a-z_]+\b|\b[A-Z]{2,}\d+\b/;

const MIN_LENGTH = 6;
const MAX_LENGTH = 70;
const MIN_WORDS = 2;
const MAX_WORDS = 8;

export type KeywordCheck =
  | { ok: true; keyword: string }
  | { ok: false; keyword: string; reason: string };

/** Strips internal markers out of a business or entity name. */
export function cleanEntityName(raw: string | null | undefined): string {
  if (!raw) return "";
  const stripped = raw
    .replace(BRACKETED, " ")
    .replace(/["“”'`]/g, " ")
    .replace(/[_/\\|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = stripped
    .split(" ")
    .filter((word) => !NOISE_TOKENS.has(word.toLowerCase().replace(/[^a-z/]/g, "")));

  return words.join(" ").trim();
}

/** Lowercases and removes punctuation a searcher would never type. */
export function normalizeKeyword(raw: string): string {
  return cleanEntityName(raw)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s'&-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s?-\s?/g, "-")
    .trim();
}

/**
 * True when a Brain value reads like the *name* of a service, place or
 * industry — the only kind of value allowed to mint a keyword.
 */
export function isUsableEntity(raw: string | null | undefined): boolean {
  const value = cleanEntityName(raw);
  if (value.length < 3 || value.length > 60) return false;
  if (STAT_LIKE.test(value)) return false;
  if (SENTENCE_LIKE.test(value)) return false;
  if (ID_LIKE.test(value)) return false;
  const words = value.split(/\s+/);
  if (words.length > 6) return false;
  if (words.some((w) => NOISE_TOKENS.has(w.toLowerCase()))) return false;
  return /[a-z]{3}/i.test(value);
}

/**
 * The single gate every keyword passes, whether the engine synthesised it or
 * an owner typed it. Failures always carry a plain-English reason.
 */
export function validateKeyword(raw: string): KeywordCheck {
  const keyword = normalizeKeyword(raw);

  if (keyword.length < MIN_LENGTH) {
    return { ok: false, keyword, reason: "Too short to be a real search — searchers type at least a few words." };
  }
  if (keyword.length > MAX_LENGTH) {
    return { ok: false, keyword, reason: "Too long to be a real search phrase." };
  }

  const words = keyword.split(" ").filter(Boolean);
  if (words.length < MIN_WORDS) {
    return { ok: false, keyword, reason: "A single word is too broad to build an honest page around." };
  }
  if (words.length > MAX_WORDS) {
    return { ok: false, keyword, reason: "Reads like a sentence rather than a search phrase." };
  }
  if (words.some((word) => NOISE_TOKENS.has(word))) {
    return { ok: false, keyword, reason: "Contains internal wording (test, demo, note, placeholder) that must never reach a public page." };
  }
  if (STAT_LIKE.test(keyword)) {
    return { ok: false, keyword, reason: "Contains numbers or figures, which belong in metrics rather than a search phrase." };
  }
  if (SENTENCE_LIKE.test(keyword) && !/^how (to|do|does|can) /.test(keyword)) {
    return { ok: false, keyword, reason: "Reads like commentary from your Brain rather than something a customer would search." };
  }
  if (ID_LIKE.test(keyword)) {
    return { ok: false, keyword, reason: "Contains an internal identifier." };
  }
  for (let index = 1; index < words.length; index += 1) {
    if (words[index] === words[index - 1]) {
      return { ok: false, keyword, reason: "Contains a repeated word, so it is not a natural search phrase." };
    }
  }
  if (!/[a-z]{3}/.test(keyword)) {
    return { ok: false, keyword, reason: "Does not contain readable words." };
  }

  return { ok: true, keyword };
}

/* ------------------------------------------------------------------ blockers */

export type SeoBlockerKey = "services" | "locations" | "industry" | "brand";

export type SeoBlocker = {
  key: SeoBlockerKey;
  label: string;
  /** ready = this family of keywords can be produced today. */
  state: "ready" | "blocked";
  /** Why it is locked, or what it currently unlocks. */
  detail: string;
  /** The concrete step that unlocks it. */
  unlock: string;
  /** Where the owner goes to do that. */
  to: "/app/interview" | "/app/brain" | "/app/settings";
  /** Illustrative keywords this family produces — never presented as data. */
  examples: string[];
};

/**
 * Explains, per keyword family, whether it is available and exactly what the
 * owner must confirm to unlock it. Pure so the UI can render it verbatim.
 */
export function seoBlockers(input: {
  services: string[];
  locations: string[];
  industry: string | null;
  businessName: string | null;
}): SeoBlocker[] {
  const services = input.services.filter(isUsableEntity);
  const locations = input.locations.filter(isUsableEntity);
  const industry = isUsableEntity(input.industry) ? cleanEntityName(input.industry) : null;
  const brand = cleanEntityName(input.businessName);
  const brandOk = isUsableEntity(brand);

  const service = services[0] ?? "your main service";
  const location = locations[0] ?? "your town";

  return [
    {
      key: "services",
      label: "Service pages",
      state: services.length > 0 ? "ready" : "blocked",
      detail:
        services.length > 0
          ? `${services.length} verified service${services.length === 1 ? "" : "s"} can be written about.`
          : "No verified service names in the Business Brain, so there is nothing honest to write a service page about.",
      unlock: "Answer the services questions in Business Discovery, then verify them in the Brain.",
      to: services.length > 0 ? "/app/brain" : "/app/interview",
      examples: [`${service} pricing`, `book ${service}`],
    },
    {
      key: "locations",
      label: "Local pages",
      state: locations.length > 0 ? "ready" : "blocked",
      detail:
        locations.length > 0
          ? `${locations.length} verified service area${locations.length === 1 ? "" : "s"} available for local pages.`
          : "No verified service areas, so local searches stay locked — Business OS will not guess where you work.",
      unlock: "Confirm the towns, cities or areas you serve, then verify those facts in the Brain.",
      to: locations.length > 0 ? "/app/brain" : "/app/interview",
      examples: [`${service} in ${location}`],
    },
    {
      key: "industry",
      label: "Industry pages",
      state: industry ? "ready" : "blocked",
      detail: industry
        ? `Industry recorded as "${industry}", which unlocks category-level searches.`
        : "No industry recorded, so category-level searches cannot be produced.",
      unlock: "Set the industry on the business profile in Settings.",
      to: industry ? "/app/settings" : "/app/settings",
      examples: industry ? [`${industry} in ${location}`] : [`your industry in ${location}`],
    },
    {
      key: "brand",
      label: "Brand pages",
      state: brandOk ? "ready" : "blocked",
      detail: brandOk
        ? `Brand pages will use "${brand}".`
        : "The business name contains internal wording (for example a test marker), so it is not used in public keywords.",
      unlock: "Rename the business to its real public trading name in Settings.",
      to: "/app/settings",
      examples: brandOk ? [`${brand} ${service}`.toLowerCase()] : [],
    },
  ];
}
