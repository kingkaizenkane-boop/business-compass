# Business OS — Implementation Audit

**Date:** 29 August 2026
**Scope:** Repository-wide audit of Business OS (React 19 · TanStack Start · Tailwind v4 · Lovable Cloud / Postgres + pgvector · Lovable AI Gateway)
**Method:** Inspection of server modules, server functions, route components, and live row counts across the 34-table schema.

---

## 1. Executive summary

The strategic core of the product — Brain, Diagnosis, Blueprint, Action Plan — is implemented and verified end to end against real interview data. The P0 AI infrastructure (async job queue, embeddings, evidence linkage, fact versioning, cost controls, auth hardening), the P1 Operations / Process Engine (process library, step builder, execution engine, approvals, action-plan conversion), and the P2.1 Metrics & Outcome Engine (metric definitions, append-only observations, trend classification, Brain memory feedback) are all implemented and published.

What remains is the *growth surface* (experiments, programmatic SEO, evidence uploads) and real outbound connectors for process steps.

| Area | Status |
| --- | --- |
| Business Brain | Implemented |
| Diagnosis Engine | Implemented |
| Blueprint Engine | Implemented |
| Action Plan Engine | Implemented (process linkage in §8.1) |
| Evidence & versioning | Partial (storage upload still P2) |
| Authentication & security | Implemented (§6.7 / P0.1) |
| Audit logging | Implemented (§6.10 / P0.1) |
| AI job queue | Implemented (§6.1) |
| AI memory & embeddings | Implemented (§6.4) |
| Processes / workflow execution | Implemented (§7 / §8) |
| Metrics ingestion | Implemented (§9) |
| Experiments | Implemented (P2.2) |
| Programmatic SEO | Implemented (P2.3) |
| Connector framework | Implemented (P3.1, email adapter live — see §12) |

---

## 2. Detailed findings

### 2.1 Business Brain — Implemented

- **Files:** `src/lib/interview.server.ts`, `src/lib/interview.functions.ts`, `src/lib/brain.functions.ts`, `src/routes/_authenticated/app.brain.tsx`
- **Tables:** `interview_sessions`, `interview_responses`, `brain_facts`, `interview_stages`, `interview_questions`
- Sessions resolve, resume, and persist. Answers are extracted into typed `brain_facts` with confidence and verification state. Category filtering and verify/unverify work from the UI.
- Extraction runs through the async `ai_jobs` queue; the UI polls job status and shows progress without blocking submission.

### 2.2 Diagnosis Engine — Implemented

- **Files:** `src/lib/diagnosis.server.ts`, `src/lib/diagnosis.functions.ts`, `src/routes/_authenticated/app.diagnosis.tsx`
- **Tables:** `diagnosis_runs`, `diagnosis_items`
- Readiness gate (~10 facts minimum), deterministic scoring `(impact*0.35 + urgency*0.25 + confidence*0.2 + opportunity*0.2) − effort penalty`, versioned runs, evidence drawer per finding.
- Generation runs through the async `ai_jobs` queue with retries, heartbeats, and budget enforcement. Partial progress within a single run is not persisted, but failed jobs can be retried from the queue.

### 2.3 Blueprint Engine — Implemented

- **Files:** `src/lib/blueprint.server.ts`, `src/lib/blueprint.functions.ts`, `src/routes/_authenticated/app.blueprint.tsx`
- **Tables:** `business_blueprints`
- Eleven strategic sections generated from Brain facts plus latest diagnosis, per-section confidence derived from verification status of underlying facts, version history, per-pillar rationale drawer.

### 2.4 Action Plan Engine — Implemented

- **Files:** `src/lib/action-plan.server.ts`, `src/lib/action-plan.functions.ts`, `src/routes/_authenticated/app.action-plan.tsx`
- **Tables:** `tasks`
- Three horizons (Now / Next / Later), deterministic sequencing and priority assignment, due dates, Approve → Start → Done workflow, stale-version retirement that preserves in-progress and completed work.
- **Gap closed in P1.1:** actions can be converted into evidence-linked draft processes; the Action Plan surfaces the linked process status and version. See §8.1.
- **Gap closed in P2.1:** each action carries a `MetricView` when a metric is linked to the task, so progress can be measured against the action's outcome. See §9.4.

### 2.5 Evidence & versioning — Partial

- **Tables:** `evidence`, `brain_fact_evidence`, `brain_facts.version`
- **Gap closed in P0:** extraction writes `evidence` rows and links every resulting fact through `brain_fact_evidence`; changed answers create new `brain_facts` versions with a supersession chain. See §6.2 and §6.3.
- **Remaining gap:** owner-facing evidence upload (documents, screenshots, financials) into a storage bucket is still P2.

### 2.6 Authentication & security — Implemented

- **Files:** `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`, `src/integrations/supabase/auth-middleware.ts`, `src/start.ts`
- Email/password auth, Google OAuth, password reset, and email confirmation are in place. Every server function is behind `requireSupabaseAuth`; RLS is enabled on all 34 tables with org/business membership helpers; CSRF middleware is installed; no privileged key reaches the client bundle.
- Per-org AI spend ceilings and two-tenant RLS isolation were verified in P0.1. See §6.6 and §6.7.

### 2.7 Audit logging — Implemented

- **Table / RPC:** `audit_logs`, `write_audit_log()`
- Wired for organization creation, business creation, interview responses, fact verification/unverification, AI job enqueue/completion/failure, AI limit changes, metric creation/updates/baselines/observations, and the full process lifecycle. See §6.10, §7.6, and §9.5.
- **Remaining gap:** an admin-facing audit log view in the UI is not yet built (P2).

### 2.8 AI job queue — Implemented

- **Files:** `src/lib/jobs.server.ts`, `src/lib/jobs.functions.ts`, `src/routes/api/public/ai-jobs-worker.ts`, `src/components/business-os/job-status.tsx`
- **Tables / RPCs:** `ai_jobs`, `claim_ai_job()`, `complete_ai_job()`, `fail_ai_job()`
- Interview extraction, diagnosis, blueprint, action-plan and process generation are all enqueued as `ai_jobs` rows. A scheduled cron worker drains the queue every 2 minutes with bounded batching, `FOR UPDATE SKIP LOCKED`, heartbeats, retries, idempotency keys, and budget ceilings.

### 2.9 AI memory & embeddings — Implemented

- **Files:** `src/lib/embeddings.server.ts`, `src/lib/memory.server.ts`
- **Table / RPC:** `ai_memory`, `match_business_memory()`
- Every new fact produces a 1536-dimension embedding (`openai/text-embedding-3-small`) and is stored in `ai_memory`. Diagnosis, blueprint and action-plan prompts open with a tenant-scoped semantic digest retrieved through `match_business_memory()`.

### 2.10 Processes / workflow execution — Implemented

- **Files:** `src/lib/process.server.ts`, `src/lib/process.functions.ts`, `src/routes/_authenticated/app.operations.index.tsx`, `src/routes/_authenticated/app.operations.$processId.tsx`
- **Tables:** `processes`, `process_steps`, `process_executions`, `process_approvals`
- Process library, step builder, versioned definitions, execution engine, approval gates, and Operations UI are all implemented. See §7 and §8.

### 2.11 Metrics ingestion — Implemented

- **Files:** `src/lib/metrics.server.ts`, `src/lib/metrics.functions.ts`, `src/lib/metrics-types.ts`, `src/routes/_authenticated/app.metrics.index.tsx`, `src/routes/_authenticated/app.metrics.$metricId.tsx`, `src/components/business-os/metric-form.tsx`, `src/components/business-os/metric-format.tsx`
- **Tables:** `metric_definitions`, `business_metrics`
- Metrics are normalized: `metric_definitions` holds the configuration (name, key, category, unit, frequency, direction, baseline, target, links to goal/diagnosis/task/process), and `business_metrics` holds append-only observations.
- Deterministic trend classification (`higher_is_better`, `lower_is_better`, `target_range`) produces `improving` / `declining` / `stable` / `target_achieved` / `target_missed` / `insufficient_data` without AI.
- Alerts fire on declining readings, target at risk, target achieved, unexpected changes, and stale data based on frequency windows.
- Brain integration writes durable `metric_outcome` memories when significant changes (±10% from baseline) occur, closing the learning loop.
- Manual ingestion UI supports single observations with period bounds and notes.

### 2.12 Experiments — Implemented (P2.2, see §10)

- No hypothesis tracking, no outcome capture, no learning loop back into the Brain. `app.experiments.tsx` is a placeholder.

### 2.13 Programmatic SEO — Implemented (P2.3, see §11)

- Two separated engines (platform acquisition and customer lead generation), deterministic opportunity scoring, queued AI generation, a 75/100 quality gate, human review/publish, public page routes and a sitemap driven by published pages only.

---

## 3. Production risks, ranked

1. **Thin error/empty-state coverage** on routes with loaders — a failed read can blank a page.
2. **No real outbound connectors.** Email, CRM, and messaging steps are typed and gated but not yet executable.
3. **No scheduled / event triggers.** Processes must be started manually or from the queue today.
4. **No evidence upload.** Owners cannot attach documents, screenshots, or financials to Brain facts.
7. **P0/P1/P2.1 risks resolved:** synchronous AI, unbacked traceability, cost ceilings, embeddings, auth surface, audit gaps, fact versioning, process execution, and metrics ingestion are all implemented.

---

## 4. Prioritized roadmap

### Completed milestones
- **P0 — Stability and traceability:** AI job queue, evidence linkage, fact versioning, Google sign-in, password reset, email confirmation. See §6.
- **P0.1 — Production hardening:** scheduled worker, RLS verification, AI memory isolation, cost ceilings, idempotency, failure recovery, audit completeness. See §6.5–6.10.
- **P1 — Operations / Process Engine:** process data model, evidence-bound generation, versioning, execution engine, approvals, Operations UI. See §7.
- **P1.1 — Process Engine Foundation:** Action Plan ↔ Process conversion, library search/filter, manual creation, activation quality gate, autonomy safety. See §8.
- **P2.1 — Metrics & Outcome Engine:** metric definitions, append-only observations, deterministic trend classification, alerts, Brain memory feedback, dashboard and detail UI. See §9.

### P2 — Scale and expansion
1. **Real outbound connectors.** Email, messaging, CRM, and payment step handlers with credential management.
2. **Scheduled and event triggers.** Automatically start processes on time, state change, or webhook.
3. ~~**Programmatic SEO execution.**~~ Delivered in P2.3: opportunity scoring → generation → quality gate → review → publish. See §11.
4. ~~**Experiments module.**~~ Delivered in P2.2: hypothesis tracking, deterministic outcome capture, and the learning loop back into the Brain. See §10.
5. **Evidence upload.** Storage-backed documents, screenshots, financials attached to Brain facts.
6. **CRM surface.** CRUD for offers, leads, and customers.
7. **Admin audit view.** Read-only audit log for organization admins.

---

## 5. Recommended next action

Start with **real outbound connectors** for process steps. Metrics ingestion is now live, so the next step is to make processes actually *do* things (send emails, update CRMs, post messages) rather than only recording what should happen. This turns the Operations engine from a planning tool into an operating system.

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

- The published app URL must resolve for the `pg_cron` invocation of `/api/public/ai-jobs-worker` to return 200. This happens automatically on first publish.

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

### 6.11 Security review — CLEAN (with documented exceptions)
The linter's remaining findings are intentional and recorded in security memory:
the `is_*` membership helpers must stay executable by signed-in users because RLS policies
call them, and `cron_job_config` is deliberately policy-free (service-role only).

### Remaining before launch
- Publish the app once so the scheduled worker endpoint resolves.
- Experiments shipped in P2.2 (see §10); Programmatic SEO shipped in P2.3 (see §11).

---

## 7. P1 Operations / Process Engine milestone — delivered 27 August 2026

The loop is now **Brain → Diagnosis → Blueprint → Action Plan → Processes → Execution**.
One-time actions stay in `tasks`; anything repeatable becomes a versioned process definition
with typed steps, an owner, an autonomy ceiling and an execution history.

### 7.1 Data model — Implemented

- `processes` extended with `organization_id`, `purpose`, `trigger_type` / `trigger_definition`,
  `owner_type` / `owner_id`, `autonomy_level`, `success_definition`, provenance
  (`created_from_action_id`, `created_from_diagnosis_id`, `created_from_blueprint_version`)
  and versioning (`version`, `supersedes_process_id`).
- `process_steps` extended with `step_type` (action, decision, wait, approval, notification,
  data_capture, ai_generation, integration, end), `owner_type` / `owner_id`, `autonomy_level`,
  `input_definition`, `output_definition`, `condition_definition`, `required`.
- New: `process_executions` (status, trigger source/payload, current step, step log, output,
  duration, metric values) and `process_approvals` (what will happen, why recommended,
  data used, external effect, decision + decider).
- RLS: every new table and column is scoped through `is_business_member` /
  `is_business_manager`; writes are manager-only, execution rows are service-role written.

### 7.2 Generation engine — Implemented

- **Files:** `src/lib/process.server.ts`, `src/lib/process.functions.ts`
- Process generation is evidence-bound: prompts are built from Brain facts, the latest
  diagnosis findings, blueprint sections and the originating action — never generic advice.
- Runs through the existing async queue as the `process_generation` job type, so it inherits
  idempotency, retries, heartbeats, budget ceilings and model routing.
- Deterministic validation rejects malformed graphs (missing terminal step, broken
  dependencies, duplicate sequences, unknown step types) before anything is persisted.
- Autonomy defaults are conservative: anything with an external effect is capped so it
  requires human approval unless an owner deliberately raises the ceiling.

### 7.3 Versioning — Implemented

- Editing an **active** process never mutates the running definition: it writes a new version
  with `supersedes_process_id` set, leaving in-flight executions on the version they started on.
- Draft processes are edited in place.

### 7.4 Execution engine — Implemented

- Start, resume, pause and cancel; step-by-step advance with a persisted `step_log`, current
  step pointer, output payload and duration.
- Approval gate: a step whose autonomy is below its requirement parks the execution as
  `approval_required` and opens a `process_approvals` row describing what will happen, why it
  was recommended, the data used and the external effect. Approve resumes, reject stops.

### 7.5 Operations UI — Implemented

- **Files:** `src/routes/_authenticated/app.operations.index.tsx`,
  `src/routes/_authenticated/app.operations.$processId.tsx`
- Overview: process library with status, autonomy, owner, version, step count, run statistics
  and diagnosis provenance; inline pending-approval cards (approve / pause / reject); AI
  generation trigger with live job status; active/draft/paused/approval counts; recent runs;
  empty state that routes back to the Action Plan.
- Detail: definition and trigger editing, autonomy ceiling control, full step builder
  (add / edit / reorder / delete with type, owner, autonomy, inputs, outputs, conditions),
  version-safe save, activate / pause / archive / duplicate / run-now, execution history with
  resume and cancel, approval decisions, and the evidence behind the process.

### 7.6 Audit logging — Implemented

`process.created`, `process.updated`, `process.activated`, `process.paused`, `process.archived`,
`process.execution_started` / `_completed` / `_failed` / `_cancelled`,
`process.approval_requested` / `_approved` / `_rejected`.

### 7.7 Remaining in this area

- Real integration step handlers (email, messaging, CRM) — steps are typed and gated, but
  outbound side effects still need connectors.
- Scheduled and event triggers are stored but not yet dispatched automatically; runs are
  started manually or from the queue.
- Process-level metrics captured per execution are now aggregated into the Metrics page
  through `metric_definitions` linked to the process. See §9.

---

## 8. P1.1 — Process Engine Foundation milestone — delivered 28 August 2026

P1.1 hardens the hand-off from the 90-day Action Plan into repeatable, evidence-bound
processes. It keeps the existing strategic core untouched and focuses on activation quality,
library discoverability, and safe autonomy defaults.

### 8.1 Action Plan ↔ Process connection — Implemented

- **Files:** `src/lib/action-plan.server.ts`, `src/lib/process.server.ts`,
  `src/routes/_authenticated/app.action-plan.tsx`
- Every action card in the Action Plan now shows a linked process once one exists, and a
  **Convert to process** button when none exists.
- Conversion calls `createProcessDraft({ fromTaskId })`, which creates a draft process
  referencing the action via `processes.created_from_action_id` without duplicating the task.
- Re-converting the same action returns the existing non-archived process, so accidental
  double-clicks never spawn duplicates.
- The Action Plan view loads the newest non-archived process per source action and surfaces
  its name, status, and version.

### 8.2 Process Library updates — Implemented

- **File:** `src/routes/_authenticated/app.operations.index.tsx`
- Search by name, purpose, category, or description.
- Status filter tabs: All / Active / Draft / Paused / Archived.
- Manual **Create process** button that inserts an empty draft for the active business.
- Statistics refreshed from `processes`, `process_steps`, `process_executions` and
  `process_approvals`.

### 8.3 Activation Quality Gate — Implemented

- **File:** `src/lib/process.server.ts` (`setProcessStatus`)
- A process cannot be activated until it passes a strict validation gate:
  - name ≥ 3 characters,
  - purpose ≥ 10 characters,
  - trigger description present,
  - success definition ≥ 5 characters,
  - at least one step,
  - autonomy level between 0 and 4.
- The user receives a single human-readable sentence listing everything still missing.
- Activating a newer version automatically archives the version it supersedes.

### 8.4 Evidence-bound generation — Implemented

- Process generation (`process_generation` job type) builds prompts from Brain facts, latest
  diagnosis findings, blueprint sections, and the originating action.
- Generated drafts carry provenance columns (`created_from_action_id`,
  `created_from_diagnosis_id`, `created_from_blueprint_version`) so the Operations detail page
  can render the exact evidence behind each process.
- Deterministic validation rejects malformed AI output before persistence.

### 8.5 Autonomy Safety — Implemented

- Conservative default autonomy (`DEFAULT_PROCESS_AUTONOMY = 1`, Recommend).
- External-effect step types (email, messaging, integration, payment) are typed but gated:
  no outbound side effect is executed automatically in this milestone; they require approval
  regardless of the autonomy ceiling.
- The builder lets owners raise autonomy up to level 4 only after the definition is complete;
  the engine still pauses for approval on any step whose requirement exceeds the execution
  context's ceiling.

### 8.6 Reliability — Implemented

- **Files:** `src/lib/process.server.ts`, `src/routes/_authenticated/app.operations.$processId.tsx`
- Versioned saving: active definitions are never overwritten; edits spawn a new version.
- Simple step builder: add, edit, reorder, delete steps with type, owner, autonomy, inputs,
  outputs, and conditions.
- Generation runs asynchronously through the existing `ai_jobs` queue, inheriting retries,
  heartbeats, budget ceilings, and job-status polling.
- Audit logging covers `process.created` for both manual and AI-generated processes.

### 8.7 Remaining after P1.1

| Area | Status |
| --- | --- |
| Processes / workflow execution | Implemented |
| Real outbound connectors (email, CRM, etc.) | Missing (P2) |
| Scheduled / event triggers | Missing (P2) |
| Metrics ingestion | Implemented (P2.1) |
| Experiments | Implemented (P2.2) |
| Programmatic SEO | Implemented (P2.3) |
| Evidence upload to storage | Missing (P2) |

**Recommended next action:** real outbound connectors, so processes can execute their
external-effect steps and the OS moves from planning to operation.

---

## 9. P2.1 — Metrics & Outcome Engine milestone — delivered 29 August 2026

P2.1 closes the learning loop by measuring the outcomes of the Action Plan and Processes
against baselines and targets. It replaces assertion with observation, and feeds significant
changes back into the Business Brain as durable memories.

### 9.1 Data model — Implemented

- **Table:** `metric_definitions` (new) — the configuration for each metric:
  `business_id`, `organization_id`, `metric_key`, `name`, `category`, `unit`, `description`,
  `rationale`, `source`, `direction`, `frequency`, `active`, `baseline_value`, `target_value`,
  plus link columns `goal_id`, `diagnosis_item_id`, `task_id`, `process_id`, `hypothesis`,
  and `intervention`.
- **Table:** `business_metrics` (extended) — append-only observations now carry
  `metric_id` (FK to `metric_definitions`), `metric_key`, `metric_name`, `value`, `unit`,
  `recorded_at`, `period_start`, `period_end`, `source`, `notes`, and optional
  `process_execution_id`.
- RLS: both tables are scoped through `is_business_member` / `is_business_manager`;
  observations are manager-created, reads are member-visible.

### 9.2 Deterministic outcome classification — Implemented

- **File:** `src/lib/metrics.server.ts` (`classifyTrend`)
- No AI is used to classify trends. The engine compares current value against previous and
  baseline according to `direction` (`higher_is_better`, `lower_is_better`, `target_range`).
- Trends: `improving`, `declining`, `stable`, `target_achieved`, `target_missed`,
  `insufficient_data`.
- A 2% noise floor prevents trivial jitter from being reported as movement.
- Derived fields include `changeFromBaseline`, `changeFromBaselinePercent`,
  `changeFromPrevious`, `distanceToTarget`, `targetProgressPercent`, `freshnessDays`, and
  a confidence score based on observation count and recency.

### 9.3 Alerts — Implemented

- **File:** `src/lib/metrics.server.ts` (`buildAlerts`)
- Quiet alert logic fires only when meaningful:
  - `declining` — latest reading moved against the intended direction.
  - `target_at_risk` — current value is moving away from target.
  - `target_achieved` — target reached.
  - `unexpected_change` — large single-period swing (>20%).
  - `stale` — no reading within the frequency window.
- Severity is `info` / `warning` / `critical` based on the combination of trend, target state,
  and freshness.

### 9.4 UI — Implemented

- **Files:** `src/routes/_authenticated/app.metrics.index.tsx`,
  `src/routes/_authenticated/app.metrics.$metricId.tsx`,
  `src/components/business-os/metric-form.tsx`,
  `src/components/business-os/metric-format.tsx`
- **Dashboard (`/app/metrics`):** performance summary cards (improving, declining, on target,
  needs attention), signals list, search, and a grid of metric cards showing baseline,
  current, target, progress bar, trend badge, and outcome sentence.
- **Detail (`/app/metrics/:id`):** definition, linked goal/diagnosis/action/process, baseline
  and target editing, a time-series chart of observations, append-only observation log,
  and a manual **Record observation** form with value, date, period bounds, source, and notes.
- **Action Plan linkage:** `ActionView` in `src/lib/action-plan.server.ts` now includes a
  `MetricView` for tasks with a linked metric, so owners can see measured progress next to
  each action.
- **Process linkage:** the process detail page surfaces linked metrics and their latest
  outcome, connecting process execution to business results.

### 9.5 Brain integration — Implemented

- **File:** `src/lib/metrics.server.ts` (`recordObservation`)
- When a new observation moves a metric by ≥10% from baseline, or achieves a target, the
  engine writes a durable `metric_outcome` memory row into `ai_memory` via
  `src/lib/memory.server.ts`.
- The memory includes the metric name, direction, baseline, current, target, and a plain
  outcome sentence. It is embedded and becomes available to future Diagnosis, Blueprint, and
  Action Plan runs through `match_business_memory()`.

### 9.6 Audit logging — Implemented

`metric.created`, `metric.updated`, `metric.baseline_established`, `metric.observation_added`,
`metric.target_changed`, `metric.archived`.

### 9.7 Server functions — Implemented

- **File:** `src/lib/metrics.functions.ts`
- `getMetrics` — full portfolio with summary and alerts.
- `getMetric` — single metric with history and links.
- `getMetricLinkOptions` — goals, tasks, processes, and diagnosis items the metric can be
  attached to.
- `saveMetric` — create or update a metric definition (idempotent on `metric_key`).
- `addMetricObservation` — append one manual observation and recompute the outcome.
- `getProcessMetrics` — metrics linked to a specific process.

### 9.8 Remaining after P2.1

| Area | Status |
| --- | --- |
| Metrics ingestion | Implemented |
| Automatic integration imports | Missing (P2) |
| Process metric aggregation dashboards | Partial (linked, no dedicated analytics view) |
| Experiments | Implemented (P2.2) |
| Programmatic SEO | Implemented (P2.3) |
| Evidence upload to storage | Missing (P2) |
| Real outbound connectors | Missing (P2) |

**Recommended next action:** real outbound connectors, so processes can execute their
external-effect steps and measured outcomes actually drive automated operations.

---

## 10. P2.2 — Experiments & Learning Engine milestone — delivered 29 August 2026

P2.2 makes change testable. Every significant intervention can be framed as a
hypothesis, measured against a stated baseline, and resolved into a learning that
is written back into the Business Brain.

### 10.1 Data model — Implemented

- `experiments` — hypothesis (IF / THEN / BECAUSE), experiment type, lifecycle
  status, baseline value and source, target value, guardrails, decision, learning
  narrative, `learning_generated_at`, and provenance to the originating diagnosis
  item, task, process or blueprint.
- `experiment_metrics` — the metrics an experiment measures, with primary/guardrail
  roles, linked to `metric_definitions`.
- Enums for experiment status, type and learning classification.
- Tenant-isolated RLS on both tables plus `updated_at` triggers and GRANTs.

### 10.2 Deterministic outcome — Implemented

`computeOutcome` in `src/lib/experiments.server.ts` is pure: it compares the
primary metric's observations against baseline and target, respects the metric's
direction, and returns the change, target attainment and a confidence score that
is earned from observation count, baseline source, data completeness and
experiment type. AI never decides whether an experiment succeeded.

### 10.3 AI synthesis and Brain feedback — Implemented

- `draftExperiment` turns a diagnosis finding, action or process into a draft
  experiment with an evidence-bound hypothesis. Drafts never start automatically.
- On completion an async `experiment_learning` job synthesises the narrative and
  writes a durable `experiment_outcome` memory into the Brain. The idempotency key
  is versioned by `learning_generated_at`, so learning is re-runnable exactly once
  per generated narrative.

### 10.4 UI — Implemented

- `/app/experiments` — dashboard with summary stats and status filtering.
- `/app/experiments/$experimentId` — hypothesis, baseline, interventions,
  measurement recording, deterministic result panel and the AI learning narrative.
- `src/components/business-os/experiment-form.tsx` — structured hypothesis entry
  with baseline pull-through from the linked metric.
- Entry points: "Test this" on diagnosis findings, "Test this action" on action-plan
  items, and "Test this process" on the process detail page.

### 10.5 Remaining

- Programmatic SEO engine — delivered in P2.3 (see §11).
- Automated experiment cohorting / control groups beyond the current
  observational and controlled types.

---

## 11. P2.3 — Programmatic SEO & Acquisition Engine milestone — delivered 29 August 2026

Two engines, one codebase, permanently separated datasets:

- **Engine A — Platform SEO.** Pages that market Business OS itself, managed only by
  organization admins (`is_org_admin`), served publicly at `/business-os-for/$slug`.
- **Engine B — Customer SEO.** Pages that generate leads for a customer business,
  served at `/sites/$siteId/$slug`. Platform and customer rows never mix.

### 11.1 Data model — Implemented

- `seo_sites` (site type, org/business mapping), `seo_opportunities` (intent, service,
  location, component scores, status and rejection reason), `seo_pages` (content, metadata,
  schema, quality report, lifecycle status).
- Tenant-isolated RLS with anonymous SELECT limited to published pages; drafts are private.

### 11.2 Deterministic scoring and quality gate — Implemented

- `computeOpportunityScore` in `src/lib/seo-types.ts` produces a 0–100 score from business
  fit, relevance, content value and competition. A keyword only qualifies when verified
  Brain facts can substantiate a real page; unsupported keywords are rejected *with a reason*.
- `runQualityGate` in `src/lib/seo.server.ts` scores nine checks server-side — content depth,
  business relevance, search intent, originality, internal linking, metadata, schema,
  canonical URL, indexability. Threshold is 75/100 and nothing can publish below it.
- `nameLike` filtering keeps statistical and sentence-like facts out of the keyword seed set,
  so no page is built on a fragment such as "70 percent of customers".

### 11.3 Generation, review and publishing — Implemented

- `seo_page_generation` runs through the existing AI job queue with separate strict prompts
  per engine; every claim must trace to a Brain fact. Generation always lands as a draft.
- Review workflow: draft → review → approved → published, with pause and archive.
- `recordPageMeasurement` feeds real measured performance into the Metrics Engine and the
  Brain outcome loop. Search numbers are never estimated or invented.

### 11.4 UI and public surfaces — Implemented

- `/app/seo` (overview), `/app/seo/opportunities`, `/app/seo/library`,
  `/app/seo/pages/$pageId` (quality report, metadata editor, evidence drawer),
  `/app/seo/platform` (admin-only).
- Public: `/business-os-for/$slug`, `/sites/$siteId/$slug`, and `/sitemap.xml` generated
  from published pages only, with JSON-LD injected per page.

### 11.5 Remaining

- Evidence upload to storage.
- Search Console / analytics ingestion to populate measured performance automatically.

---

## 12. P3.1 — Connector Framework + Email Connector — delivered

WhatsApp, CRM and payments are **not** separate systems. There is exactly one connector
framework; each channel is a provider entry with an adapter, and only the adapter differs.

### 12.1 Data model — Implemented

- `connector_connections` — organization/business scoped connection with provider,
  capabilities, status (`draft`/`connected`/`error`/`disabled`), hashed rotating inbound
  secret, outbound credential *name* (never the value), counters and `last_error`.
- `connector_events` — normalised event store: direction, event type, contact identity,
  subject, body, raw payload, routing outcome, status and error.
- Tenant-isolated RLS on both tables; a unique index on
  `(connection_id, external_id)` makes redelivery a no-op.

### 12.2 Unified contract — Implemented

- `src/lib/connectors-types.ts` holds `CONNECTOR_REGISTRY` (email available; WhatsApp, CRM,
  payments and calendar registered as planned) plus the single `NormalizedConnectorEvent`
  shape every adapter must produce.
- `src/lib/connectors.server.ts` owns the provider-agnostic pipeline:
  verify caller → normalise → deduplicate → persist → route → audit. Adding a channel means
  adding one adapter, not a new subsystem.

### 12.3 Routing and lead creation — Implemented

- Inbound enquiries upsert into `leads` by email/phone match, so the same person does not
  become two leads. Only real inbound activity creates a lead; nothing is synthesised.
- Outbound sending goes through the same event log, so every message the business sends is
  auditable alongside what it received.

### 12.4 Security — Implemented

- Inbound tokens are shown once, stored as SHA-256 hashes, and rotatable; a stale token
  fails closed with 401.
- The public webhook `/api/public/connectors/$connectionId` authenticates the caller inside
  the handler and validates the payload before any write.
- Outbound credentials are referenced by secret name and read server-side only.
- Audit vocabulary: `connector.created`, `connector.enabled`, `connector.disabled`,
  `connector.secret_rotated`, `connector.events_ingested`, `connector.message_sent`.

### 12.5 UI — Implemented

- `/app/connectors`: connector health, available channels from the registry, per-connection
  endpoint and token management, enable/disable, rotate, outbound compose, and a live feed of
  normalised events with routing outcome.

### 12.6 Verified end to end

- Inbound email webhook → 1 event stored → 1 lead created; redelivery of the same
  `messageId` → 0 stored, 1 duplicate; invalid token → 401.

### 12.7 Remaining

- WhatsApp, CRM, payments and calendar adapters (framework and registry already in place).
- Connector events as first-class evidence attachments on Brain facts.



## 13. End-to-end barber stress test — 29 August 2026

A full-loop stress test was run against a realistic Lagos barbershop tenant
(`[TEST] King's Edge Barbers`). Report: `END-TO-END-BARBER-STRESS-TEST.md`.

Result: the loop (interview → Brain → diagnosis → blueprint → 90-day plan →
processes → metrics → experiments → SEO → connectors) passed end to end.
44 AI jobs completed with zero failures for ~$0.027 of model spend, and
mobile/desktop layouts were clean on all ten app pages.

Defects fixed as part of the run:

- `experiments.server.ts` measurement window ignored backdated observations.
- Missing member INSERT policies on `audit_logs` and `ai_memory`.
- `seo.server.ts` `updatePage` never re-scored the quality gate after an owner
  edit, so a corrected page could never publish and a degraded page could.

Open issues carried forward: customer SEO keyword synthesis inherits the raw
business name, per-family discovery blockers are not surfaced in the UI,
inbound connector dedup needs a payload-hash fallback, and a React
"state update before mount" warning appears on authenticated routes.
