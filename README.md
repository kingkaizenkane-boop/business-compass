# Business OS

**An AI-powered Business Intelligence, Strategy and Operating System for small businesses.**

Business OS interviews a business owner, builds a structured understanding of their business, diagnoses what is holding it back, produces a strategic blueprint, and turns that blueprint into a prioritised action plan. It refuses to guess: every fact carries a source, a confidence level and a verification state.

---

## 1. The core loop

```text
Business  ->  DNA Interview  ->  Brain  ->  Diagnosis  ->  Blueprint  ->  Action Plan  ->  Execution  ->  Measurement  ->  Learning
                    ^                                                                                                        |
                    +--------------------------------------------------------------------------------------------------------+
```

| Stage | What happens | Where it lives |
| --- | --- | --- |
| Onboarding | Business basics captured (name, industry, location, model) | `/business/new` |
| DNA Interview | Persistent, resumable, staged conversation across 16 stages | `/app/interview` |
| Brain | Structured facts extracted from answers, each with confidence + verification | `/app/brain` |
| Diagnosis | Scored assessment across revenue, ops, marketing, sales, retention, automation, owner dependency, growth | `/app/diagnosis` |
| Blueprint | Positioning, ideal customer, offer, pricing, acquisition, retention, operating model | `/app/blueprint` |
| Action Plan | Prioritised 90-day roadmap of tasks and processes | `/app/action-plan` |
| Execution & Learning | Tasks, experiments, metrics, SEO engine | `/app/*` |

**Core rule:** inference is never displayed as fact. Anything the AI derives is labelled *inferred* and *unverified* until the owner confirms it.

---

## 2. Investor brief

### The problem
Small businesses do not lack tools — they lack understanding. Owners run on memory and instinct. Consultants who can produce real strategy cost $5k–$50k per engagement, take weeks, and leave behind a static PDF that decays immediately. Existing SaaS (CRMs, bookkeeping, dashboards) records activity but never explains the business.

### The product
Business OS is the layer above the tools: a persistent, structured, machine-readable model of a single business (the **Brain**), plus an AI operator that continuously diagnoses it, proposes strategy, and executes work against it. Consulting-grade thinking at software cost, and it compounds instead of decaying.

### Why now
- Frontier LLMs are finally reliable at structured extraction and long-context reasoning.
- Vector memory (pgvector) makes durable, business-specific recall cheap.
- Owners have been trained by AI chat to expect conversational software.

### Defensible moat
1. **The Brain.** A per-business, versioned, evidence-linked fact graph. It cannot be scraped or copied; it accrues from usage and gets more valuable per session.
2. **The interview architecture.** 16 stages, adaptive questions, coverage scoring, resumable state. The hard part isn't the model — it's the elicitation.
3. **Switching cost.** Once diagnosis, blueprint and action plan are grounded in the Brain, leaving means restarting understanding from zero.

### Business model
- **Subscription per business** (org can hold many businesses), tiered by autonomy level and AI usage.
- **Expansion:** additional businesses, additional seats, SEO page generation volume.
- **Adjacent:** agency/consultant tier (multi-client orgs already supported by the org/member/business schema), and white-label.

### Traction shape to target
Time-to-first-blueprint, interview completion rate, Brain coverage %, verified-fact ratio, week-4 action-plan completion. These are the leading indicators of retention because they measure understanding, not logins.

### Risks and mitigations
| Risk | Mitigation |
| --- | --- |
| AI hallucination damaging trust | Fact/inference separation enforced at the data layer; verification workflow; evidence links |
| AI cost per user | Model routing (cheap extraction model, expensive reasoning only at diagnosis/blueprint), async job queue, caching in `ai_memory` |
| Interview abandonment | Persistent sessions, resume context, progress + coverage scoring, short stages |
| Tenant data leakage | Row-level security on all 34 tables, org/business membership helpers, service-role never in client code |

---

## 3. Admin brief (operators, agencies, internal team)

### Tenancy model
```text
organization
  └── organization_members (owner | admin | manager | member | viewer)
  └── businesses
        └── brain_facts, evidence, interview_sessions, diagnosis_runs,
            business_blueprints, tasks, processes, leads, customers,
            seo_sites, ai_memory, audit_logs
```
Every business-scoped table is isolated by `is_business_member()` / `is_business_manager()`. Every org-scoped table by `is_org_member()` / `is_org_admin()`. An agency can hold many client businesses in one organization without any cross-visibility outside membership.

### Admin surfaces
- **Business selector** — switch active business; all pages re-scope instantly.
- **Settings → AI autonomy (Level 0–4)** — from "suggest only" to "act and report". Governs what the AI may do without confirmation.
- **Audit log** (`audit_logs`) — actor, action, table, record, old/new values. Written by `write_audit_log()`.
- **AI job queue** (`ai_jobs`) — queued / running / completed / failed, with attempts, locking and retry. Claimed via `claim_ai_job()`, resolved via `complete_ai_job()` / `fail_ai_job()`.
- **Notifications** — quiet by design; only material changes surface.

### Operational responsibilities
- Monitor the AI job queue for repeated failures (attempts approaching `max_attempts`).
- Watch verified-fact ratio per business; a low ratio means diagnosis is standing on unconfirmed ground.
- Review audit logs before any destructive schema or data operation.
- Secrets live server-side only. Service-role credentials and AI keys are never reachable from the browser.

---

## 4. User brief (the business owner)

### What you do
1. **Create your business.** Two minutes. Name, industry, location, what you do. Nothing is guessed for you.
2. **Do the discovery interview.** A conversation, not a form. Answer in your own words. Stop whenever you like — it remembers exactly where you were and why.
3. **Read your Brain.** Everything the system understood, in plain language, each item marked *verified* or *inferred*. Confirm what's right, correct what isn't.
4. **Get your diagnosis.** Where the money leaks, where you're the bottleneck, what's actually urgent versus merely loud.
5. **Get your blueprint.** Who you're for, what you sell, what you charge, how customers arrive, how they stay, how the business runs without you.
6. **Work the plan.** A prioritised 90-day list. Each item explains WHAT, WHY and WHAT NEXT.

### What it will never do
- Show you a number it invented.
- Present a guess as a fact.
- Bury you in dashboards you didn't ask for.
- Take an action above your chosen autonomy level.

### The 16 interview stages
Identity · Products & services · Customers · Market & competition · Economics · Pricing · Sales · Marketing · Operations · Team & roles · Technology · Finance · Growth · Risks · Goals · Evidence

Coverage and confidence scores tell you how well the system understands you and which gaps matter most.

---

## 5. Technical architecture

**Stack:** React 19 · TypeScript · TanStack Start (SSR + server functions) · Vite 7 · Tailwind v4 · shadcn/ui · framer-motion · Supabase (Postgres + Auth + pgvector) · Lovable AI Gateway.

### Boundaries
| Concern | Location |
| --- | --- |
| Client UI | `src/routes/**`, `src/components/**` |
| Auth gate | `src/routes/_authenticated/route.tsx` (client-only gate, redirects to `/auth`) |
| Server functions (RPC) | `src/lib/*.functions.ts` |
| Server-only logic + AI calls | `src/lib/*.server.ts` |
| Vocabulary and types of the loop | `src/lib/business-os.ts` |
| Design tokens | `src/styles.css` (OKLCH, "ink on warm paper") |

`src/lib/ai.server.ts` is the only module that talks to the AI gateway. No AI key, no service-role key, and no privileged query ever reaches the browser.

### Key database objects
- **34 tables**, all with RLS enabled and explicit grants.
- **Interview persistence:** `interview_sessions` (status, current stage, current question, progress %, coverage score, resume context) + `interview_responses` (raw + structured, confidence, supersession chain).
- **Brain:** `brain_facts` (category, fact_key, typed value, `fact_type`, confidence + `confidence_level`, verified, active, versioned) linked to `evidence` and to each other via `brain_fact_relationships`.
- **Vector memory:** `ai_memory` with `match_business_memory()` for per-business semantic recall.
- **Functions:** `is_org_member`, `is_org_admin`, `is_business_member`, `is_business_manager`, `update_interview_progress`, `claim_ai_job`, `complete_ai_job`, `fail_ai_job`, `match_business_memory`, `write_audit_log`, `handle_new_user`.

### Design language
Premium, calm, intelligent. Editorial serif headings (Instrument Serif) over a quiet sans (Manrope), warm paper surfaces, restrained motion, generous whitespace. Empty states explain what's missing and why — never fake data, never a spinner where a sentence would do.

---

## 6. Status

### Shipped
- Design system, primitives, app shell, loop diagram, landing page.
- Full route tree (21 app routes) behind an auth gate.
- Production schema applied: 34 tables, enums, indexes, RLS policies, grants, RPCs, seed data (16 stages, 37 baseline questions, 5 SEO templates).
- Email/password auth, auto-provisioned organization, business creation, business switching.
- DNA interview end to end: session resolution, resume, submit, progress + coverage, AI fact extraction into `brain_facts`.
- Brain page: live facts, category filter, confidence/verification badges, verify/unverify.
- Dashboard: live Brain health and totals.

### Launch blockers
1. **Diagnosis engine** — `diagnosis_runs` / `diagnosis_items` are unwritten. Without it there is no product, only an interview.
2. **Blueprint generation** — `business_blueprints` unwritten; the strategic payoff of the loop.
3. **Action plan** — turn diagnosis items into `tasks` / `processes` with priority scoring.
4. **AI job queue worker** — long AI runs (diagnosis, blueprint, embeddings) must be async; the queue exists but nothing drains it.
5. **Embedding writes** — `ai_memory.embedding` is never populated, so `match_business_memory()` returns nothing and long-term recall is dead.
6. **Google sign-in + provider configuration** — currently email/password only.
7. **Auth hardening** — email confirmation flow, password reset, session-expiry UX.
8. **Error and empty-state coverage on every route with a loader** — `errorComponent` / `notFoundComponent` so a failed read never blanks the app.
9. **Cost controls** — per-org AI usage ceilings and model routing before any real traffic.
10. **Security pass** — verify no privileged import reaches a client bundle; confirm RLS with a two-tenant test.

### Must-haves (v1.0)
- Fact editing with version history and conflict resolution UI.
- Evidence upload (documents, screenshots, financials) into `evidence` + storage bucket.
- Adaptive question generation: AI-authored follow-ups when coverage is thin, not just the static bank.
- Diagnosis explainability: every item shows the facts it stands on.
- Autonomy levels actually enforced at the server-function layer, not just displayed in settings.
- Onboarding-to-first-blueprint flow that a first-time owner completes unaided.
- Metrics ingestion (`business_metrics`) so progress is measured, not asserted.
- Audit log surfacing in the UI for org admins.
- Mobile-quality interview experience — most owners will answer from a phone.
- Data export (Brain + blueprint + plan) so the user owns their understanding.

### Good-to-haves (post-v1)
- SEO engine execution: opportunity scoring → page generation → quality gate → publish (schema is ready, generation isn't).
- Experiments module with hypothesis tracking and outcome learning.
- Voice interview input.
- WhatsApp / email interview continuation for owners who won't sit at a desk.
- Multi-business benchmarking within an org.
- Agency white-label and client-facing report generation.
- Integrations for automatic evidence: payment processor, bookkeeping, calendar, ad platforms.
- Weekly digest email driven by what actually changed.
- Industry-specific interview templates (`interview_templates.industry_code` is already schema-supported).
- Public shareable blueprint page with OG preview.

---

## 7. Local development

```bash
bun install
bun run dev        # http://localhost:8080
```

Backend is Lovable Cloud (Supabase). Client-visible config comes from `VITE_SUPABASE_*`; server-only secrets are read inside server-function handlers via `process.env` and never at module scope.

### Conventions
- App-internal server logic → `createServerFn` in `*.functions.ts`. Webhooks and external callers → `src/routes/api/public/*`.
- Server-only helpers → `*.server.ts` (blocked from client bundles by filename).
- Authenticated pages → `src/routes/_authenticated/`. Public pages → top level, no auth gate.
- Colors, gradients and shadows come from design tokens only. No hardcoded color utilities.
