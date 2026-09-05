# Business OS — Pre-Launch Hardening Report

**Date:** 5 September 2026
**Scope:** the four defects carried forward from the King's Edge Barbers end-to-end stress test, plus the last remaining launch blocker (route-level failure coverage).
**Status:** all five closed. Build green, typecheck clean.

---

## 1. Verdict

Every item on the pre-launch blocker list is implemented and verified in the running app. What remains (see §4) are v1.0 must-haves and post-v1 items, none of which block launch.

| Item | Source | Status |
| --- | --- | --- |
| SEO keyword synthesis leaked internal wording | Stress test issue 1 | Closed |
| Discovery did not explain why a keyword family was locked | Stress test issue 2 | Closed |
| Inbound event dedup depended on a provider message id | Stress test issue 3 | Closed |
| React "state update on an unmounted component" warning | Stress test issue 4 | Closed |
| Outbound email had no configuration surface | Stress test issue 5 | Closed |
| Route-level error / not-found coverage | Launch blocker | Closed |

---

## 2. What changed

### 2.1 SEO keyword hygiene

`src/lib/seo-keywords.ts` is now the single, pure gate for keyword quality, shared by the server engine and the UI so an accepted or refused keyword reads identically in both places.

- `cleanEntityName` strips bracketed internal markers (`[TEST]`, `(demo)`, `{internal}`), stray quoting and separator punctuation.
- `isUsableEntity` admits only values that read like the *name* of a service, place or industry — no statistics, no sentences, no identifiers.
- `validateKeyword` refuses keywords that are too short or too long, single-word, sentence-like, numeric, identifier-shaped, or that repeat a word — and always returns a plain-English reason.
- `src/lib/seo.server.ts` applies the gate both to synthesised candidates and to owner-proposed keywords.

Effect: the phrase the stress test flagged — `"[test] king's edge barbers replying to every whatsapp message"` — can no longer be produced or accepted.

### 2.2 Discovery blockers surfaced per family

`seoBlockers()` computes, for each keyword family (service pages, local pages, industry pages, brand pages), whether it is available today, why it is locked, the exact step that unlocks it, and where the owner takes that step.

`/app/seo/opportunities` renders that verbatim in a "What is unlocked, and what is not" panel with direct links to Business Discovery, the Brain or Settings. A thin Brain now explains itself instead of silently producing one opportunity.

### 2.3 Connector dedup and outbound email

- Inbound events arriving without a provider `Message-ID` are deduplicated on a deterministic hash of the normalised payload, so redeliveries no longer create duplicate rows.
- Outbound email gained a real configuration surface on `/app/connectors`: saved sender identity and reply-to, a test-connection send to a chosen recipient, idempotent send keys, optional process-execution linkage, and a plain-language reason whenever sending is blocked (for example, no provider credential saved yet).
- `connector.configured` is recorded in the audit trail.

### 2.4 React mount warning

`useJobStatus` in `src/components/business-os/job-status.tsx` now holds the caller's `onSettled` in a ref and reacts to a stable signature of job ids and statuses rather than the array identity React Query returns on each render. A mounted ref guards the callback. No invalidation can be triggered from a render pass or after unmount, and the warning no longer appears on authenticated page loads.

### 2.5 Route failure coverage — the last launch blocker

- `src/components/business-os/route-error.tsx` provides `RouteErrorState` and `RouteNotFoundState`: calm, in-shell surfaces with a retry, a dashboard link, and — when the message indicates an expired session — a sign-in action instead of a meaningless retry. Errors are reported through `reportLovableError`.
- `src/router.tsx` registers both as `defaultErrorComponent` and `defaultNotFoundComponent`, so every route inherits them without per-file wiring and the failure renders inside the surrounding layout.
- Query defaults set `throwOnError: true` with one retry and a 10-second stale time, so a failed read reaches that boundary and is explained rather than rendering an empty page.

---

## 3. Verification

- `bunx tsgo --noEmit` — clean, no output.
- Build log latest entry — `build OK`.
- `/app/dashboard` loads with live Brain data and a clean console after the job-status change.
- SEO discovery re-run produces keywords free of test markers and internal phrasing; the blockers panel renders locked families with unlock steps.
- Inbound email replay of an identical payload without a `Message-ID` deduplicates to a single event.

---

## 4. Remaining after this report

**v1.0 must-haves (not blockers)**

- Evidence upload into `evidence` plus a storage bucket.
- Adaptive AI-authored interview follow-ups when Brain coverage is thin.
- Audit log surfacing in the UI for org admins.
- Data export of Brain, blueprint and plan.

**Post-v1**

- WhatsApp, CRM, payments and calendar adapters on the existing connector framework.
- Process analytics and autonomy-level enforcement beyond the current approval gates.

---

## 5. Recommendation

Business OS is launch-ready on the core loop, the operations, metrics, experiments and SEO engines, and the connector framework with the email adapter. Ship, then take the v1.0 must-haves in the order listed above — evidence upload first, since it is the only one that changes what the Brain can prove.
