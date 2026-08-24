# Business OS — Implementation Audit

**Date:** 24 August 2026
**Scope:** Repository-wide audit of Business OS (React 19 · TanStack Start · Tailwind v4 · Lovable Cloud / Postgres + pgvector · Lovable AI Gateway)
**Method:** Inspection of server modules, server functions, route components, and live row counts across the 34-table schema.

---

## 1. Executive summary

The strategic core of the product — Brain, Diagnosis, Blueprint, Action Plan — is implemented and has been verified end to end against real interview data. What is missing is the *infrastructure beneath it* (async job execution, embeddings, evidence linkage) and the *operational surface above it* (metrics, processes, experiments, SEO execution).

The single largest production risk is that all four AI engines run synchronously inside the request path with 8k–16k token budgets. The single largest trust risk is that evidence linkage is claimed in the UI but not yet fully persisted.

| Area | Status |
| --- | --- |
| Business Brain | Implemented |
| Diagnosis Engine | Implemented |
| Blueprint Engine | Implemented |
| Action Plan Engine | Implemented |
| Evidence & versioning | Partial |
| Authentication & security | Partial |
| Audit logging | Partial |
| AI job queue | Missing |
| AI memory & embeddings | Missing |
| Processes / workflow execution | Missing |
| Metrics ingestion | Missing |
| Experiments | Missing |
| Programmatic SEO | Missing |

---

## 2. Detailed findings

### 2.1 Business Brain — Implemented

- **Files:** `src/lib/interview.server.ts`, `src/lib/interview.functions.ts`, `src/lib/brain.functions.ts`, `src/routes/_authenticated/app.brain.tsx`
- **Tables:** `interview_sessions`, `interview_responses`, `brain_facts`, `interview_stages`, `interview_questions`
- Sessions resolve, resume, and persist. Answers are extracted into typed `brain_facts` with confidence and verification state. Category filtering and verify/unverify work from the UI.
- **Risk:** extraction is a single synchronous AI call; a slow model response blocks the answer submission.

### 2.2 Diagnosis Engine — Implemented

- **Files:** `src/lib/diagnosis.server.ts`, `src/lib/diagnosis.functions.ts`, `src/routes/_authenticated/app.diagnosis.tsx`
- **Tables:** `diagnosis_runs`, `diagnosis_items`
- Readiness gate (~10 facts minimum), deterministic scoring `(impact*0.35 + urgency*0.25 + confidence*0.2 + opportunity*0.2) − effort penalty`, versioned runs, evidence drawer per finding.
- **Risk:** long single-shot generation; retry logic exists in `ai.server.ts` but there is no persistence of partial progress.

### 2.3 Blueprint Engine — Implemented

- **Files:** `src/lib/blueprint.server.ts`, `src/lib/blueprint.functions.ts`, `src/routes/_authenticated/app.blueprint.tsx`
- **Tables:** `business_blueprints`
- Eleven strategic sections generated from Brain facts plus latest diagnosis, per-section confidence derived from verification status of underlying facts, version history, per-pillar rationale drawer.

### 2.4 Action Plan Engine — Implemented

- **Files:** `src/lib/action-plan.server.ts`, `src/lib/action-plan.functions.ts`, `src/routes/_authenticated/app.action-plan.tsx`
- **Tables:** `tasks`
- Three horizons (Now / Next / Later), deterministic sequencing and priority assignment, due dates, Approve → Start → Done workflow, stale-version retirement that preserves in-progress and completed work.
- **Gap:** generated processes are not written to the `processes` table, so the Operations page stays empty.

### 2.5 Evidence & versioning — Partial

- **Tables:** `evidence` (populated), `brain_fact_evidence` (**0 rows**), `brain_facts.version`
- Evidence rows are created during extraction, but the join table linking facts to evidence is not written. `brain_facts.version` does not increment when an owner re-answers a question, so there is no supersession history in practice.
- **Production risk:** the UI presents findings as traceable to evidence; that claim is currently only partially backed by the database. This is the highest-trust-cost gap in the system.
- **Missing entirely:** owner-facing evidence upload (documents, screenshots, financials) into a storage bucket.

### 2.6 Authentication & security — Partial

- **Files:** `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`, `src/integrations/supabase/auth-middleware.ts`, `src/start.ts`
- Email/password auth works; every server function is behind `requireSupabaseAuth`; RLS is enabled on all 34 tables with org/business membership helpers; CSRF middleware is installed; no privileged key reaches the client bundle.
- **Missing:** Google sign-in, password reset, email confirmation flow, session-expiry UX, per-org AI spend ceilings, and a two-tenant RLS verification test.

### 2.7 Audit logging — Partial

- **Table / RPC:** `audit_logs`, `write_audit_log()`
- Wired for diagnosis, blueprint and action-plan runs.
- **Missing:** business creation, interview submissions, fact verification, and any surfacing of the log in the UI for org admins.

### 2.8 AI job queue — Missing

- **Tables / RPCs:** `ai_jobs`, `claim_ai_job()`, `complete_ai_job()`, `fail_ai_job()` — all present, none used.
- Nothing enqueues jobs and nothing drains the queue. Every AI run is synchronous.
- **Production risk:** highest. Diagnosis and blueprint generation are the longest calls in the product and will time out under real latency or larger Brains. There is no retry, no progress reporting, and a failed run leaves the user with nothing.

### 2.9 AI memory & embeddings — Missing

- **Table / RPC:** `ai_memory`, `match_business_memory()`
- `ai_memory.embedding` is never populated, so semantic recall returns nothing. The compounding-understanding moat described in the product thesis is not yet operative.

### 2.10 Processes / workflow execution — Missing

- **Table:** `processes` (empty). `src/routes/_authenticated/app.operations.tsx` is a static placeholder.

### 2.11 Metrics ingestion — Missing

- **Table:** `business_metrics` (empty). `app.metrics.tsx` renders no live data. Progress is asserted, not measured.

### 2.12 Experiments — Missing

- No hypothesis tracking, no outcome capture, no learning loop back into the Brain. `app.experiments.tsx` is a placeholder.

### 2.13 Programmatic SEO — Missing

- **Tables:** `seo_sites` and template rows seeded (5 templates), but no opportunity scoring, generation, quality gate or publish path. `app.seo.tsx` is scaffolding.

---

## 3. Production risks, ranked

1. **Synchronous AI in the request path.** Timeouts on diagnosis/blueprint under real load; no retry or partial recovery.
2. **Unbacked traceability claim.** `brain_fact_evidence` empty while the UI promises evidence-linked reasoning.
3. **No cost ceiling.** Unbounded AI spend per organization; no model routing enforcement.
4. **No embeddings.** Long-term recall dead; each session reasons from scratch.
5. **Auth surface incomplete.** No password reset or email confirmation; account recovery is impossible today.
6. **Thin error/empty-state coverage** on routes with loaders — a failed read can blank a page.
7. **Silent audit gaps** on the mutations that matter most for multi-seat and agency use.
8. **Fact versioning inert.** Corrections overwrite rather than supersede, so conflict history is lost.

---

## 4. Prioritized roadmap

### P0 — Stability and traceability
1. **AI job queue worker.** Enqueue diagnosis, blueprint, action-plan and extraction runs; drain via a public cron route; report status in the UI. Removes the timeout class of failure entirely.
2. **Evidence linkage.** Write `brain_fact_evidence` on every extraction; increment `brain_facts.version` with a supersession chain on re-answer.
3. **Google sign-in** plus password reset and email confirmation.

### P1 — Operationalization
4. **Embeddings and AI memory.** Generate and persist embeddings; use `match_business_memory()` for per-business recall in every engine prompt.
5. **Processes engine.** Write action-plan-derived processes into `processes` and make the Operations page live.
6. **Metrics ingestion.** Manual entry first, so the plan can be measured against outcomes.
7. **Audit completeness** plus an admin-facing audit view.
8. **Cost controls.** Per-org token ceilings and explicit model routing (cheap extraction, expensive reasoning only at diagnosis/blueprint).

### P2 — Scale and expansion
9. CRUD for offers, leads and customers.
10. Programmatic SEO execution: opportunity scoring → generation → quality gate → publish.
11. Experiments module with hypothesis tracking and outcome learning.
12. Evidence upload with storage bucket, plus Brain/blueprint/plan data export.

---

## 5. Recommended next action

Start with the **AI job queue worker**. It resolves the top-ranked production risk, unblocks embeddings and any future long-running generation, and is a prerequisite for honest progress reporting in the UI.
