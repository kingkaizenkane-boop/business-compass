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

---

## 6. P0 AI infrastructure milestone — delivered 24 August 2026

### 6.1 AI job queue — Implemented

- **Files:** `src/lib/jobs.server.ts`, `src/lib/jobs.functions.ts`, `src/routes/api/public/ai-jobs-worker.ts`, `src/components/business-os/job-status.tsx`
- Interview extraction, diagnosis, blueprint and action-plan runs are enqueued as `ai_jobs` rows; nothing long-running remains in the request path.
- Drain path: `drainAiJobs()` reclaims stalled jobs, then claims a bounded batch (max 10) via `claim_ai_job()` with `FOR UPDATE SKIP LOCKED`, and finishes each through `complete_ai_job()` / `fail_ai_job()`.
- Triggers: an in-request background kick after enqueue, a nudge while the UI polls, and an authenticated cron endpoint at `/api/public/ai-jobs-worker` guarded by the cron bearer secret.
- Idempotency: every job carries an idempotency key (`extract:<response_id>` for extraction), so retries reuse the same row and never create duplicate Brain facts.

### 6.2 Evidence linkage — Implemented

- Extraction writes one `evidence` row keyed to the interview response and links every resulting fact through `brain_fact_evidence` (upsert on `fact_id, evidence_id`). Unchanged facts are re-linked rather than duplicated.

### 6.3 Fact versioning — Implemented

- A changed answer inserts a new `brain_facts` row with `version + 1` and `supersedes_fact_id`, then marks the prior row `active = false` with `superseded_at` / `superseded_by_fact_id`. Interview answers chain through `supersedes_response_id`. History is never overwritten.

### 6.4 AI memory and embeddings — Implemented

- **Files:** `src/lib/embeddings.server.ts`, `src/lib/memory.server.ts`
- Every new fact produces a durable `ai_memory` row with a 1536-dimension embedding (`openai/text-embedding-3-small`), deduplicated on `(business_id, memory_type, source_table, source_id)`.
- Diagnosis, blueprint and action-plan prompts now open with a long-term memory digest retrieved through `match_business_memory()`, scoped strictly to the business.

### 6.5 Observability — Implemented

- `ai_jobs` carries status, progress text, attempts / max attempts, failure reason, heartbeat and lifecycle timestamps. `getJobStatus` exposes them to members, and `JobStatusStrip` shows queued / running / completed / failed / paused state with retry counts on the interview, diagnosis, blueprint and action-plan pages.

### 6.6 Cost controls — Implemented

- **File:** `src/lib/ai-usage.server.ts`
- Every gateway call records tokens and estimated spend into `ai_usage`. `organization_ai_limits` sets monthly token and spend ceilings; the worker checks the budget before each job and parks work as `cancelled` with a reason when the ceiling is hit.
- Model routing: extraction and memory use `gemini-2.5-flash-lite`, planning uses `gemini-2.5-flash`, and diagnosis / blueprint reasoning uses `gemini-2.5-pro`.

### 6.7 Security

- RLS unchanged; `ai_jobs`, `ai_usage` and `organization_ai_limits` are readable by members and writable only by the service role. The queue worker uses the service-role client server-side only, and AI credentials are read inside handlers. Tenant isolation is preserved.

### 6.8 Remaining in this area

- Scheduled cron invocation of `/api/public/ai-jobs-worker` still has to be registered against the published URL.
- Two-tenant RLS verification test and an admin-facing usage dashboard remain outstanding.

---

## P0.1 — Production Hardening Report (verified 2026-08-24)

### 1. AI worker scheduling — DONE (activates on publish)
- `pg_cron` job `ai-jobs-worker` runs every 2 minutes and POSTs to
  `/api/public/ai-jobs-worker` with a bearer cron secret; the endpoint URL lives in
  `public.cron_job_config` (service-role only) and can be disabled without touching SQL.
- Fixed a real defect: the scheduled command called `extensions.net_http_post`, which does
  not exist — every run since scheduling had failed. It now calls `net.http_post`.
  Latest run: `succeeded`, HTTP response received.
- The configured endpoint is the **published** app URL, so it returns 404 until the project
  is published for the first time. Nothing else is required after publish.
- Each run drains a bounded batch (max 5 jobs), so the schedule can never storm.

### 2. Two-tenant RLS — VERIFIED
A throwaway second tenant (org, business, brain fact, memory, job, usage row, audit row)
was created and read back while acting as the real signed-in user. Zero cross-tenant rows
were visible in `organizations`, `businesses`, `brain_facts`, `ai_memory`, `ai_jobs`,
`ai_usage` or `audit_logs`. Test data was removed afterwards.

### 3. AI memory isolation — VERIFIED
`match_business_memory` is SECURITY INVOKER and filters on `business_id`, so recall runs
under the caller's RLS. Cross-tenant memory rows are unreadable (covered by the test above).

### 4. Embeddings — VERIFIED
All 5 stored memories carry a 1536-dimension vector; `memories_without_embedding = 0`.
Embedding failures caused by gateway 402/403 pause the organization rather than writing
silent nulls.

### 5. Cost ceiling and circuit breakers — DONE
- Per-organization monthly token and USD ceilings in `organization_ai_limits`, enforced in
  `drainAiJobs` before a job runs; over-budget jobs are cancelled with a human-readable reason.
- Gateway `402`/`403` pause all AI work for the organization. A paused org gets at most one
  probe job per drain run so out-of-band recovery (credits topped up) resumes automatically.
- `429`/`5xx` are retried with bounded backoff; jobs then fall back to the queue's retry budget.

### 6. AI usage visibility — DONE
`/app/ai-usage` (linked in the sidebar) shows month-to-date spend and tokens against the
ceiling, breakdowns by model, operation and day, recent failures, and lets an org admin
edit ceilings or resume paused AI work.

### 7. Job idempotency — DONE
- Extraction: `extract:<responseId>` — one job per submitted answer, replays deduplicate.
- Engines: keyed on a `brainStateKey` (fact count + newest fact timestamp), so re-triggering
  against unchanged knowledge reuses the existing run and new knowledge starts a fresh one.
- Failed/cancelled jobs are reset in place, so a retry never creates a duplicate row.

### 8. Failure recovery — DONE
`reclaim_stalled_ai_jobs()` requeues jobs whose heartbeat went stale; attempts are capped by
`max_attempts` before a job is marked failed, and each drain tracks processed ids so a
reclaimed job cannot loop within one batch.

### 9. Auth hardening — DONE
Google sign-in through the managed broker (provider enabled), email/password, and a
password reset flow at `/reset-password`. Protected routes stay under `_authenticated`.

### 10. Audit logging — DONE
`audit_logs` now records organization creation, business creation, interview responses,
fact verification/unverification, AI job enqueue, job completion/failure and AI limit changes.

### 11. Security review — CLEAN (with documented exceptions)
The linter's remaining findings are intentional and recorded in security memory:
the `is_*` membership helpers must stay executable by signed-in users because RLS policies
call them, and `cron_job_config` is deliberately policy-free (service-role only).

### Remaining before launch
- Publish the app once so the scheduled worker endpoint resolves.
- Metrics ingestion, experiments and programmatic SEO remain P2 placeholders.
