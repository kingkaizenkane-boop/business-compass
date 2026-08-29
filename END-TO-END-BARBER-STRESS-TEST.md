# Business OS — End-to-End Stress Test: King's Edge Barbers

**Date:** 29 August 2026
**Tenant under test:** `[TEST] King's Edge Barbers` (business `b0b49432-9c1d-4813-9a2e-e3c658af665f`), Lagos barbershop, 3 barbers, owner-run, WhatsApp-first.
**Method:** authenticated browser harness driving the real server functions (no mocks, no direct table writes except test-data repair), plus SQL verification of persisted state.

---

## 1. Verdict

The full loop works end to end on a realistic small business: **DNA interview → Brain → Diagnosis → Blueprint → 90-day plan → Processes → Metrics → Experiments → SEO → Connectors**, with evidence linkage, async AI jobs, cost accounting and audit trail intact.

| Area | Result |
| --- | --- |
| DNA interview (37 answers, pause/resume) | Pass |
| Fact extraction, versioning, evidence links | Pass — 121 facts, all evidence-linked |
| AI memory / embeddings | Pass — 126 memories, 1536-dim |
| Diagnosis / Blueprint / Action plan | Pass — owner dependency correctly named as the primary constraint |
| Processes (generation, validation, activation gate) | Pass — 4 barbershop processes |
| Metrics & outcome detection | Pass — repeat customers +44%, trend classified |
| Experiments & learning synthesis | Pass after one defect fix (measurement window) |
| SEO engine (discover → generate → gate → publish → public page → sitemap) | Pass after one defect fix (re-score on edit) |
| Connectors (inbound email → lead, bad token) | Pass |
| AI jobs | 44 completed, 0 failed |
| Cost controls | 43,300 tokens, ~$0.027 for the whole run |
| Audit trail | 65 audit records |
| Mobile (390×844) & desktop (1280×1800) on 10 app pages | Pass — no horizontal overflow, single H1 per page |

---

## 2. What the system concluded about the business

From verified Brain facts only, the engine identified the real bottleneck: the owner personally answers every WhatsApp message and chases every rebooking, with no rebooking process and a 38% repeat rate. The Blueprint and 90-day plan both centred on removing that dependency (rebooking at checkout, follow-up automation, barber standards). The diagnosis narrative cited specific facts rather than generic advice — the intended behaviour.

Metrics and experiments closed the loop: a "Weekly repeat customers" metric with 14 observations, and a "WhatsApp rebooking nudge" experiment that completed with **+44% change, 100% data completeness, high confidence**, and an AI learning note written back to the Brain.

---

## 3. Defects found and fixed during the test

**3.1 Experiment measurement window excluded backdated observations (fixed)**
`periodBounds` in `src/lib/experiments.server.ts` used `started_at` as the lower bound, so measurements recorded for dates inside the declared window but logged before the row was started were silently ignored (observation count 0). Now the declared `start_date`/`end_date` win when earlier/later than the lifecycle timestamps. After the fix the same experiment counted 14 observations.

**3.2 Missing INSERT policies for `audit_logs` and `ai_memory` (fixed)**
User-path writes were failing silently under RLS because only the service role could insert. Member-scoped INSERT policies were added by migration; `experiment.completed` and `experiment.learning_generated` now persist.

**3.3 Owner edits never re-scored an SEO page (fixed)**
`updatePage` in `src/lib/seo.server.ts` saved new copy but left the stored `quality_report` untouched. Consequences: a page whose blocking claim had just been removed could never publish, and a page edited into worse shape could still publish on a stale pass. The quality gate is now recomputed on every owner edit (`rescoreQuality`), including originality/duplicate analysis against sibling pages. Verified: the page went 91 (blocked, unsupported "guarantees" claim) → 92 (claim cleared, thin copy correctly blocked) → 99 (publishable), then published, served at `/sites/{siteId}/{slug}` with valid JSON-LD and listed in `/sitemap.xml`.

---

## 4. Behaviour that is correct but worth noting

- **The quality gate really blocks.** The first generated page scored 91 yet was refused publication because the AI wrote "guarantees", a claim no Brain fact supported. Score alone never publishes a page; every blocking check must pass.
- **Status flow is strict.** `draft → review → approved → published` only; skipping a step is rejected.
- **Verified facts gate SEO breadth.** Location pages were not created because no service-area fact was verified — the engine said so explicitly instead of inventing locations.
- **Insufficient-evidence refusal works.** Customer pages require ≥6 verified facts.

---

## 5. Open issues (not fixed, ranked)

1. **Opportunity keywords inherit the raw business name.** Discovery produced `"[test] king's edge barbers replying to every whatsapp message"` — the business name is concatenated with an operational pain phrase, which is a navigational keyword nobody searches. Keyword synthesis should prefer service + location + intent, and should not pass through bracketed prefixes or internal phrasing.
2. **Only one customer opportunity was created** for a business with 121 facts, because service-area and service facts were largely unverified. Discovery should surface *why* each opportunity family is locked, per family, in the UI.
3. **Inbound event dedup depends on a provider message id.** An identical email payload without a `Message-ID` was stored twice (no duplicate lead was created, so lead routing is safe). Consider hashing the normalised payload as a fallback dedup key.
4. **React warning on app routes:** "Can't perform a React state update on a component that hasn't mounted yet" appears on nearly every authenticated page load. Cosmetic today, but it indicates an async state write during render in a shared shell component.
5. **Outbound email is not connected.** The email connector reports `outboundReady: false` until a provider secret is set, so send-path testing was not possible in this environment.

---

## 6. Evidence summary (persisted state after the run)

```
brain_facts            121      ai_memory (embedded)   126
ai_jobs completed       44      ai_jobs failed           0
processes                4      tasks                    8
experiments              6      leads                    1
connector_events         2      published SEO pages      1
audit_logs              65      tokens used         43,300  (~$0.027)
```

## 7. Recommendation

The core loop is production-viable for a single-owner service business. Before launch, fix keyword synthesis (issue 1) so the customer SEO engine produces searchable keywords, surface per-family discovery blockers (issue 2), and clear the React state warning (issue 4). Nothing found in this run blocks the loop itself.
