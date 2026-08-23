-- ============================================================
-- BUSINESS OS
-- Production Supabase Migration v1.0
-- Canonical database schema for Business OS
-- ============================================================
--
-- Architecture:
-- Organization -> Business -> Business DNA -> Business Brain
-- -> Diagnosis -> Blueprint -> Action -> Measurement -> Learning
--
-- IMPORTANT:
-- This file is the authoritative schema for the Business OS build.
-- Apply it to a fresh Supabase project before connecting Lovable.
-- Do not allow the frontend to bypass RLS or use service-role keys.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;

-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type public.organization_role as enum ('owner','admin','manager','member','viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.organization_status as enum ('active','trial','suspended','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.interview_status as enum ('not_started','in_progress','paused','completed','abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_type as enum (
    'text','long_text','single_select','multi_select','number','currency',
    'percentage','boolean','date','url','file','location','rating'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.response_status as enum (
    'answered','skipped','needs_input','needs_verification','superseded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fact_type as enum (
    'fact','claim','inference','assumption','goal','preference','metric','observation'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.confidence_level as enum (
    'very_low','low','medium','high','very_high'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.evidence_type as enum (
    'conversation','document','image','url','testimonial','review',
    'analytics','financial_record','manual_entry','system_generated'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.diagnosis_category as enum (
    'revenue','marketing','sales','conversion','retention','operations',
    'time','people','finance','technology','automation',
    'customer_experience','seo','growth','strategy'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.priority_level as enum ('critical','high','medium','low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.opportunity_status as enum (
    'identified','validated','planned','in_progress','completed','dismissed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.process_status as enum ('draft','active','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum (
    'todo','in_progress','blocked','completed','cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('urgent','high','medium','low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum (
    'new','contacted','qualified','proposal','won','lost','archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.source_type as enum (
    'website','seo','google','social','whatsapp','email',
    'referral','advertising','direct','other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_job_status as enum (
    'queued','running','completed','failed','cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.seo_page_status as enum (
    'draft','generating','published','paused','archived'
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- PROFILES / TENANCY
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  timezone text not null default 'UTC',
  locale text not null default 'en',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.organization_status not null default 'trial',
  plan_code text not null default 'free',
  created_by uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists idx_org_members_user on public.organization_members(user_id);
create index if not exists idx_org_members_org on public.organization_members(organization_id);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  legal_name text,
  industry text,
  sub_industry text,
  business_model text,
  customer_model text,
  description text,
  founded_year integer,
  website_url text,
  primary_location jsonb,
  service_area jsonb,
  employee_count integer,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists idx_businesses_org on public.businesses(organization_id);
create index if not exists idx_businesses_industry on public.businesses(industry);

-- ============================================================
-- INTERVIEW / BUSINESS DNA
-- ============================================================

create table if not exists public.interview_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null default 1,
  industry_code text,
  description text,
  active boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(name, version)
);

create table if not exists public.interview_stages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.interview_templates(id) on delete cascade,
  stage_key text not null,
  name text not null,
  description text,
  sequence integer not null,
  completion_weight numeric(8,4) not null default 1,
  minimum_coverage numeric(5,2) not null default 80,
  configuration jsonb not null default '{}'::jsonb,
  unique(template_id, stage_key)
);

create index if not exists idx_interview_stages_template
  on public.interview_stages(template_id, sequence);

create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.interview_stages(id) on delete cascade,
  question_key text not null,
  question_text text not null,
  question_type public.question_type not null,
  sequence integer,
  required boolean not null default false,
  ai_generated boolean not null default false,
  condition jsonb,
  extraction_schema jsonb,
  validation_rules jsonb,
  help_text text,
  unique(stage_id, question_key)
);

create index if not exists idx_questions_stage
  on public.interview_questions(stage_id, sequence);

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  template_id uuid references public.interview_templates(id),
  status public.interview_status not null default 'not_started',
  current_stage text,
  current_question_key text,
  progress_percent numeric(5,2) not null default 0,
  coverage_score numeric(5,2) not null default 0,
  last_activity_at timestamptz,
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  resume_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_interview_sessions_business
  on public.interview_sessions(business_id);
create index if not exists idx_interview_sessions_user
  on public.interview_sessions(user_id);
create index if not exists idx_interview_sessions_status
  on public.interview_sessions(status);
create index if not exists idx_interview_sessions_activity
  on public.interview_sessions(last_activity_at desc);

create table if not exists public.interview_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  question_id uuid references public.interview_questions(id),
  question_key text not null,
  raw_response text,
  structured_response jsonb,
  status public.response_status not null default 'answered',
  confidence numeric(5,2),
  answered_at timestamptz not null default now(),
  supersedes_response_id uuid references public.interview_responses(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_interview_responses_session
  on public.interview_responses(session_id, created_at);
create index if not exists idx_interview_responses_question
  on public.interview_responses(question_key);

-- ============================================================
-- AI CONVERSATION
-- ============================================================

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  session_id uuid references public.interview_sessions(id) on delete set null,
  user_id uuid references auth.users(id),
  conversation_type text not null,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_conversations_business
  on public.ai_conversations(business_id);
create index if not exists idx_ai_conversations_session
  on public.ai_conversations(session_id);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('system','user','assistant','tool')),
  content text,
  structured_output jsonb,
  token_count integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_messages_conversation
  on public.ai_messages(conversation_id, created_at);

-- ============================================================
-- BUSINESS BRAIN / EVIDENCE / MEMORY
-- ============================================================

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  evidence_type public.evidence_type not null,
  title text,
  description text,
  source_url text,
  storage_path text,
  content_text text,
  metadata jsonb not null default '{}'::jsonb,
  verified boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_evidence_business
  on public.evidence(business_id);

create table if not exists public.brain_facts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null,
  subcategory text,
  fact_key text not null,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_json jsonb,
  fact_type public.fact_type not null default 'fact',
  confidence numeric(5,2) not null default 50,
  confidence_level public.confidence_level not null default 'medium',
  verified boolean not null default false,
  active boolean not null default true,
  source_type public.evidence_type,
  source_id uuid,
  valid_from timestamptz,
  valid_until timestamptz,
  version integer not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_brain_facts_business
  on public.brain_facts(business_id);
create index if not exists idx_brain_facts_category
  on public.brain_facts(business_id, category);
create index if not exists idx_brain_facts_key
  on public.brain_facts(business_id, fact_key);
create index if not exists idx_brain_facts_active
  on public.brain_facts(business_id, active);

create table if not exists public.brain_fact_relationships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  source_fact_id uuid not null references public.brain_facts(id) on delete cascade,
  target_fact_id uuid not null references public.brain_facts(id) on delete cascade,
  relationship_type text not null,
  confidence numeric(5,2) not null default 50,
  created_at timestamptz not null default now(),
  unique(source_fact_id, target_fact_id, relationship_type)
);

create table if not exists public.brain_fact_evidence (
  fact_id uuid not null references public.brain_facts(id) on delete cascade,
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  relevance numeric(5,2) not null default 100,
  primary key(fact_id, evidence_id)
);

create table if not exists public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  memory_type text not null,
  title text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  source_table text,
  source_id uuid,
  importance numeric(5,2) not null default 50,
  confidence numeric(5,2) not null default 50,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_memory_business
  on public.ai_memory(business_id);
create index if not exists idx_ai_memory_type
  on public.ai_memory(business_id, memory_type);
create index if not exists idx_ai_memory_embedding
  on public.ai_memory using hnsw (embedding vector_cosine_ops);

-- ============================================================
-- COMMERCIAL / CRM
-- ============================================================

create table if not exists public.business_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  service_type text not null default 'service',
  description text,
  price numeric(14,2),
  currency char(3) default 'USD',
  pricing_model text,
  duration_minutes integer,
  capacity integer,
  cost_estimate numeric(14,2),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_services_business
  on public.business_services(business_id);

create table if not exists public.business_offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  offer_type text,
  price numeric(14,2),
  currency char(3) default 'USD',
  target_customer text,
  transformation text,
  guarantee text,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_offers_business
  on public.business_offers(business_id);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  source public.source_type,
  status public.lead_status not null default 'new',
  estimated_value numeric(14,2),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leads_business on public.leads(business_id);
create index if not exists idx_leads_status on public.leads(business_id, status);
create index if not exists idx_leads_source on public.leads(business_id, source);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  lead_id uuid references public.leads(id),
  first_name text,
  last_name text,
  email text,
  phone text,
  customer_segment text,
  lifetime_value numeric(14,2) not null default 0,
  first_purchase_at timestamptz,
  last_purchase_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_business on public.customers(business_id);
create index if not exists idx_customers_segment on public.customers(business_id, customer_segment);

-- ============================================================
-- OPERATIONS
-- ============================================================

create table if not exists public.processes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  process_category text,
  status public.process_status not null default 'draft',
  owner_user_id uuid references auth.users(id),
  automation_score numeric(5,2),
  owner_dependency_score numeric(5,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_processes_business on public.processes(business_id);

create table if not exists public.process_steps (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  name text not null,
  description text,
  sequence integer not null,
  responsible_role text,
  automation_type text not null default 'manual',
  estimated_minutes integer,
  depends_on_step_id uuid references public.process_steps(id),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_process_steps_process
  on public.process_steps(process_id, sequence);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  process_id uuid references public.processes(id),
  process_step_id uuid references public.process_steps(id),
  assigned_to uuid references auth.users(id),
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_business on public.tasks(business_id);
create index if not exists idx_tasks_assignee on public.tasks(assigned_to, status);
create index if not exists idx_tasks_due on public.tasks(business_id, due_at);

-- ============================================================
-- DIAGNOSIS / BLUEPRINT
-- ============================================================

create table if not exists public.diagnosis_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  brain_version integer,
  overall_score numeric(5,2),
  revenue_score numeric(5,2),
  operations_score numeric(5,2),
  marketing_score numeric(5,2),
  sales_score numeric(5,2),
  retention_score numeric(5,2),
  automation_score numeric(5,2),
  owner_dependency_score numeric(5,2),
  growth_score numeric(5,2),
  summary text,
  created_at timestamptz not null default now()
);

create index if not exists idx_diagnosis_runs_business
  on public.diagnosis_runs(business_id, created_at desc);

create table if not exists public.diagnosis_items (
  id uuid primary key default gen_random_uuid(),
  diagnosis_run_id uuid not null references public.diagnosis_runs(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  category public.diagnosis_category not null,
  title text not null,
  description text,
  impact_score numeric(5,2),
  urgency_score numeric(5,2),
  confidence_score numeric(5,2),
  effort_score numeric(5,2),
  priority_score numeric(8,2),
  priority_level public.priority_level,
  status public.opportunity_status not null default 'identified',
  recommendation text,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_diagnosis_items_business
  on public.diagnosis_items(business_id);
create index if not exists idx_diagnosis_items_priority
  on public.diagnosis_items(business_id, priority_score desc);

create table if not exists public.business_blueprints (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  diagnosis_run_id uuid references public.diagnosis_runs(id),
  version integer not null default 1,
  status text not null default 'draft',
  positioning text,
  ideal_customer text,
  core_problem text,
  transformation text,
  differentiation text,
  methodology text,
  pricing_strategy text,
  acquisition_strategy text,
  retention_strategy text,
  operating_model text,
  owner_role text,
  executive_summary text,
  blueprint_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id, version)
);

-- ============================================================
-- GOALS / METRICS
-- ============================================================

create table if not exists public.business_goals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  category text,
  target_value numeric,
  current_value numeric,
  unit text,
  target_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_goals_business
  on public.business_goals(business_id, status);

create table if not exists public.business_metrics (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  metric_key text not null,
  metric_name text not null,
  value numeric,
  unit text,
  period_start date,
  period_end date,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_business_metrics
  on public.business_metrics(business_id, metric_key, recorded_at desc);

-- ============================================================
-- SEO
-- ============================================================

create table if not exists public.seo_sites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  site_type text not null check (site_type in ('platform','customer')),
  domain text,
  active boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_seo_sites_business on public.seo_sites(business_id);
create index if not exists idx_seo_sites_type on public.seo_sites(site_type);

create table if not exists public.seo_opportunities (
  id uuid primary key default gen_random_uuid(),
  seo_site_id uuid not null references public.seo_sites(id) on delete cascade,
  keyword text not null,
  search_intent text,
  topic_cluster text,
  geographic_modifier text,
  commercial_score numeric(5,2),
  relevance_score numeric(5,2),
  competition_score numeric(5,2),
  opportunity_score numeric(8,2),
  recommended_page_type text,
  status text not null default 'identified',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_seo_opportunities_site
  on public.seo_opportunities(seo_site_id, opportunity_score desc);

create table if not exists public.seo_page_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  page_type text not null,
  template_config jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_pages (
  id uuid primary key default gen_random_uuid(),
  seo_site_id uuid not null references public.seo_sites(id) on delete cascade,
  opportunity_id uuid references public.seo_opportunities(id),
  template_id uuid references public.seo_page_templates(id),
  slug text not null,
  title text,
  meta_description text,
  h1 text,
  content jsonb,
  canonical_url text,
  schema_json jsonb,
  status public.seo_page_status not null default 'draft',
  indexable boolean not null default true,
  published_at timestamptz,
  last_refreshed_at timestamptz,
  quality_score numeric(5,2),
  unique(seo_site_id, slug)
);

create index if not exists idx_seo_pages_site on public.seo_pages(seo_site_id);
create index if not exists idx_seo_pages_status on public.seo_pages(seo_site_id, status);

-- ============================================================
-- AI JOBS / AUDIT
-- ============================================================

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  job_type text not null,
  status public.ai_job_status not null default 'queued',
  priority integer not null default 5,
  input_data jsonb not null default '{}'::jsonb,
  output_data jsonb,
  error_message text,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_jobs_queue
  on public.ai_jobs(status, priority desc, created_at);
create index if not exists idx_ai_jobs_business on public.ai_jobs(business_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id),
  actor_type text not null check (actor_type in ('user','ai','system')),
  action text not null,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_business
  on public.audit_logs(business_id, created_at desc);
create index if not exists idx_audit_org
  on public.audit_logs(organization_id, created_at desc);

-- ============================================================
-- SECURITY HELPERS
-- ============================================================

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = (select auth.uid())
      and om.role in ('owner','admin')
  );
$$;

create or replace function public.is_business_member(target_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    join public.organization_members om
      on om.organization_id = b.organization_id
    where b.id = target_business
      and om.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_business_manager(target_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    join public.organization_members om
      on om.organization_id = b.organization_id
    where b.id = target_business
      and om.user_id = (select auth.uid())
      and om.role in ('owner','admin','manager')
  );
$$;

-- ============================================================
-- UPDATED_AT
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Attach only when trigger doesn't already exist.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','organizations','businesses','interview_sessions',
    'brain_facts','ai_memory','business_services','business_offers',
    'leads','customers','processes','tasks','diagnosis_items',
    'business_blueprints','business_goals'
  ]
  loop
    execute format(
      'drop trigger if exists trg_%I_updated_at on public.%I',
      t, t
    );
    execute format(
      'create trigger trg_%I_updated_at before update on public.%I
       for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- AUTO-CREATE PROFILE
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.businesses enable row level security;

alter table public.interview_templates enable row level security;
alter table public.interview_stages enable row level security;
alter table public.interview_questions enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_responses enable row level security;

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

alter table public.evidence enable row level security;
alter table public.brain_facts enable row level security;
alter table public.brain_fact_relationships enable row level security;
alter table public.brain_fact_evidence enable row level security;
alter table public.ai_memory enable row level security;

alter table public.business_services enable row level security;
alter table public.business_offers enable row level security;
alter table public.leads enable row level security;
alter table public.customers enable row level security;

alter table public.processes enable row level security;
alter table public.process_steps enable row level security;
alter table public.tasks enable row level security;

alter table public.diagnosis_runs enable row level security;
alter table public.diagnosis_items enable row level security;
alter table public.business_blueprints enable row level security;

alter table public.business_goals enable row level security;
alter table public.business_metrics enable row level security;

alter table public.seo_sites enable row level security;
alter table public.seo_opportunities enable row level security;
alter table public.seo_page_templates enable row level security;
alter table public.seo_pages enable row level security;

alter table public.ai_jobs enable row level security;
alter table public.audit_logs enable row level security;

-- ============================================================
-- PROFILE POLICIES
-- ============================================================

drop policy if exists "users can view own profile" on public.profiles;
create policy "users can view own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- ============================================================
-- ORGANIZATION POLICIES
-- ============================================================

drop policy if exists "members can view organizations" on public.organizations;
create policy "members can view organizations"
on public.organizations for select to authenticated
using (public.is_org_member(id));

drop policy if exists "authenticated users can create organizations" on public.organizations;
create policy "authenticated users can create organizations"
on public.organizations for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "admins can update organizations" on public.organizations;
create policy "admins can update organizations"
on public.organizations for update to authenticated
using (public.is_org_admin(id))
with check (public.is_org_admin(id));

-- ============================================================
-- MEMBER POLICIES
-- ============================================================

drop policy if exists "members can view organization members" on public.organization_members;
create policy "members can view organization members"
on public.organization_members for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "admins can add organization members" on public.organization_members;
create policy "admins can add organization members"
on public.organization_members for insert to authenticated
with check (
  public.is_org_admin(organization_id)
  or (user_id = (select auth.uid()) and role = 'owner')
);

drop policy if exists "admins can update organization members" on public.organization_members;
create policy "admins can update organization members"
on public.organization_members for update to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists "admins can remove organization members" on public.organization_members;
create policy "admins can remove organization members"
on public.organization_members for delete to authenticated
using (public.is_org_admin(organization_id));

-- ============================================================
-- BUSINESS POLICIES
-- ============================================================

drop policy if exists "members can view businesses" on public.businesses;
create policy "members can view businesses"
on public.businesses for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "members can create businesses" on public.businesses;
create policy "members can create businesses"
on public.businesses for insert to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "managers can update businesses" on public.businesses;
create policy "managers can update businesses"
on public.businesses for update to authenticated
using (
  public.is_org_admin(organization_id)
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = businesses.organization_id
      and om.user_id = (select auth.uid())
      and om.role = 'manager'
  )
)
with check (public.is_org_member(organization_id));

-- ============================================================
-- INTERVIEW POLICIES
-- ============================================================

drop policy if exists "members can view interview templates" on public.interview_templates;
create policy "members can view interview templates"
on public.interview_templates for select to authenticated
using (active = true);

drop policy if exists "members can view interview stages" on public.interview_stages;
create policy "members can view interview stages"
on public.interview_stages for select to authenticated
using (
  exists (
    select 1 from public.interview_templates t
    where t.id = interview_stages.template_id and t.active = true
  )
);

drop policy if exists "members can view interview questions" on public.interview_questions;
create policy "members can view interview questions"
on public.interview_questions for select to authenticated
using (
  exists (
    select 1
    from public.interview_stages s
    join public.interview_templates t on t.id = s.template_id
    where s.id = interview_questions.stage_id and t.active = true
  )
);

drop policy if exists "members can view interview sessions" on public.interview_sessions;
create policy "members can view interview sessions"
on public.interview_sessions for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can create interview sessions" on public.interview_sessions;
create policy "members can create interview sessions"
on public.interview_sessions for insert to authenticated
with check (
  public.is_business_member(business_id)
  and user_id = (select auth.uid())
);

drop policy if exists "members can update interview sessions" on public.interview_sessions;
create policy "members can update interview sessions"
on public.interview_sessions for update to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists "members can view interview responses" on public.interview_responses;
create policy "members can view interview responses"
on public.interview_responses for select to authenticated
using (
  exists (
    select 1 from public.interview_sessions s
    where s.id = interview_responses.session_id
      and public.is_business_member(s.business_id)
  )
);

drop policy if exists "members can create interview responses" on public.interview_responses;
create policy "members can create interview responses"
on public.interview_responses for insert to authenticated
with check (
  exists (
    select 1 from public.interview_sessions s
    where s.id = interview_responses.session_id
      and public.is_business_member(s.business_id)
  )
);

drop policy if exists "members can update interview responses" on public.interview_responses;
create policy "members can update interview responses"
on public.interview_responses for update to authenticated
using (
  exists (
    select 1 from public.interview_sessions s
    where s.id = interview_responses.session_id
      and public.is_business_member(s.business_id)
  )
)
with check (
  exists (
    select 1 from public.interview_sessions s
    where s.id = interview_responses.session_id
      and public.is_business_member(s.business_id)
  )
);

-- ============================================================
-- AI CONVERSATIONS / MESSAGES
-- ============================================================

drop policy if exists "members can view ai conversations" on public.ai_conversations;
create policy "members can view ai conversations"
on public.ai_conversations for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can view ai messages" on public.ai_messages;
create policy "members can view ai messages"
on public.ai_messages for select to authenticated
using (
  exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and public.is_business_member(c.business_id)
  )
);

-- ============================================================
-- BRAIN / EVIDENCE
-- ============================================================

drop policy if exists "members can view evidence" on public.evidence;
create policy "members can view evidence"
on public.evidence for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can create evidence" on public.evidence;
create policy "members can create evidence"
on public.evidence for insert to authenticated
with check (public.is_business_member(business_id));

drop policy if exists "managers can update evidence" on public.evidence;
create policy "managers can update evidence"
on public.evidence for update to authenticated
using (public.is_business_manager(business_id))
with check (public.is_business_manager(business_id));

drop policy if exists "members can view brain facts" on public.brain_facts;
create policy "members can view brain facts"
on public.brain_facts for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can create brain facts" on public.brain_facts;
create policy "members can create brain facts"
on public.brain_facts for insert to authenticated
with check (public.is_business_member(business_id));

drop policy if exists "managers can update brain facts" on public.brain_facts;
create policy "managers can update brain facts"
on public.brain_facts for update to authenticated
using (public.is_business_manager(business_id))
with check (public.is_business_manager(business_id));

drop policy if exists "members can view brain relationships" on public.brain_fact_relationships;
create policy "members can view brain relationships"
on public.brain_fact_relationships for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can view fact evidence" on public.brain_fact_evidence;
create policy "members can view fact evidence"
on public.brain_fact_evidence for select to authenticated
using (
  exists (
    select 1 from public.brain_facts f
    where f.id = brain_fact_evidence.fact_id
      and public.is_business_member(f.business_id)
  )
);

drop policy if exists "members can view ai memory" on public.ai_memory;
create policy "members can view ai memory"
on public.ai_memory for select to authenticated
using (public.is_business_member(business_id));

-- ============================================================
-- SERVICES / OFFERS / CRM
-- ============================================================

drop policy if exists "members can view services" on public.business_services;
create policy "members can view services"
on public.business_services for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "managers can manage services" on public.business_services;
create policy "managers can manage services"
on public.business_services for all to authenticated
using (public.is_business_manager(business_id))
with check (public.is_business_manager(business_id));

drop policy if exists "members can view offers" on public.business_offers;
create policy "members can view offers"
on public.business_offers for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "managers can manage offers" on public.business_offers;
create policy "managers can manage offers"
on public.business_offers for all to authenticated
using (public.is_business_manager(business_id))
with check (public.is_business_manager(business_id));

drop policy if exists "members can view leads" on public.leads;
create policy "members can view leads"
on public.leads for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can manage leads" on public.leads;
create policy "members can manage leads"
on public.leads for all to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists "members can view customers" on public.customers;
create policy "members can view customers"
on public.customers for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can manage customers" on public.customers;
create policy "members can manage customers"
on public.customers for all to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

-- ============================================================
-- OPERATIONS
-- ============================================================

drop policy if exists "members can view processes" on public.processes;
create policy "members can view processes"
on public.processes for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "managers can manage processes" on public.processes;
create policy "managers can manage processes"
on public.processes for all to authenticated
using (public.is_business_manager(business_id))
with check (public.is_business_manager(business_id));

drop policy if exists "members can view process steps" on public.process_steps;
create policy "members can view process steps"
on public.process_steps for select to authenticated
using (
  exists (
    select 1 from public.processes p
    where p.id = process_steps.process_id
      and public.is_business_member(p.business_id)
  )
);

drop policy if exists "members can view tasks" on public.tasks;
create policy "members can view tasks"
on public.tasks for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can manage tasks" on public.tasks;
create policy "members can manage tasks"
on public.tasks for all to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

-- ============================================================
-- DIAGNOSIS / BLUEPRINT / GOALS / METRICS
-- ============================================================

drop policy if exists "members can view diagnosis" on public.diagnosis_runs;
create policy "members can view diagnosis"
on public.diagnosis_runs for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can view diagnosis items" on public.diagnosis_items;
create policy "members can view diagnosis items"
on public.diagnosis_items for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can view blueprints" on public.business_blueprints;
create policy "members can view blueprints"
on public.business_blueprints for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "members can view goals" on public.business_goals;
create policy "members can view goals"
on public.business_goals for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "managers can manage goals" on public.business_goals;
create policy "managers can manage goals"
on public.business_goals for all to authenticated
using (public.is_business_manager(business_id))
with check (public.is_business_manager(business_id));

drop policy if exists "members can view metrics" on public.business_metrics;
create policy "members can view metrics"
on public.business_metrics for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists "managers can manage metrics" on public.business_metrics;
create policy "managers can manage metrics"
on public.business_metrics for all to authenticated
using (public.is_business_manager(business_id))
with check (public.is_business_manager(business_id));

-- ============================================================
-- SEO
-- ============================================================

drop policy if exists "members can view seo sites" on public.seo_sites;
create policy "members can view seo sites"
on public.seo_sites for select to authenticated
using (
  business_id is null
  or public.is_business_member(business_id)
);

drop policy if exists "managers can manage customer seo sites" on public.seo_sites;
create policy "managers can manage customer seo sites"
on public.seo_sites for all to authenticated
using (
  business_id is not null
  and public.is_business_manager(business_id)
)
with check (
  business_id is not null
  and public.is_business_manager(business_id)
);

drop policy if exists "members can view seo opportunities" on public.seo_opportunities;
create policy "members can view seo opportunities"
on public.seo_opportunities for select to authenticated
using (
  exists (
    select 1 from public.seo_sites s
    where s.id = seo_opportunities.seo_site_id
      and (s.business_id is null or public.is_business_member(s.business_id))
  )
);

drop policy if exists "members can view seo pages" on public.seo_pages;
create policy "members can view seo pages"
on public.seo_pages for select to authenticated
using (
  exists (
    select 1 from public.seo_sites s
    where s.id = seo_pages.seo_site_id
      and (s.business_id is null or public.is_business_member(s.business_id))
  )
);

-- ============================================================
-- AI JOBS / AUDIT
-- ============================================================

drop policy if exists "members can view ai jobs" on public.ai_jobs;
create policy "members can view ai jobs"
on public.ai_jobs for select to authenticated
using (
  business_id is null or public.is_business_member(business_id)
);

drop policy if exists "members can view business audit logs" on public.audit_logs;
create policy "members can view business audit logs"
on public.audit_logs for select to authenticated
using (
  business_id is null or public.is_business_member(business_id)
);

-- ============================================================
-- VECTOR SEARCH
-- ============================================================

create or replace function public.match_business_memory(
  query_embedding extensions.vector(1536),
  match_business_id uuid,
  match_threshold float default 0.75,
  match_count integer default 10
)
returns table (
  id uuid,
  memory_type text,
  title text,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    m.id,
    m.memory_type,
    m.title,
    m.content,
    1 - (m.embedding <=> query_embedding) as similarity
  from public.ai_memory m
  where m.business_id = match_business_id
    and m.embedding is not null
    and 1 - (m.embedding <=> query_embedding) >= match_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- INTERVIEW PROGRESS
-- ============================================================

create or replace function public.update_interview_progress(
  target_session uuid,
  new_stage text,
  new_question_key text,
  new_progress numeric,
  new_coverage numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.interview_sessions
  set
    current_stage = new_stage,
    current_question_key = new_question_key,
    progress_percent = greatest(0, least(100, new_progress)),
    coverage_score = greatest(0, least(100, new_coverage)),
    last_activity_at = now()
  where id = target_session
    and public.is_business_member(business_id);
end;
$$;

-- ============================================================
-- AI JOB QUEUE
-- ============================================================

create or replace function public.claim_ai_job(
  worker_id text,
  requested_job_types text[] default null
)
returns public.ai_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.ai_jobs;
begin
  update public.ai_jobs
  set
    status = 'running',
    locked_at = now(),
    locked_by = worker_id,
    started_at = now(),
    attempts = attempts + 1
  where id = (
    select id
    from public.ai_jobs
    where status = 'queued'
      and (
        requested_job_types is null
        or job_type = any(requested_job_types)
      )
    order by priority desc, created_at
    for update skip locked
    limit 1
  )
  returning * into claimed;

  return claimed;
end;
$$;

create or replace function public.complete_ai_job(
  job_id uuid,
  result jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_jobs
  set
    status = 'completed',
    output_data = result,
    completed_at = now(),
    locked_at = null,
    locked_by = null
  where id = job_id;
end;
$$;

create or replace function public.fail_ai_job(
  job_id uuid,
  error_text text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_attempts integer;
  current_max integer;
begin
  select attempts, max_attempts
  into current_attempts, current_max
  from public.ai_jobs
  where id = job_id;

  update public.ai_jobs
  set
    status = case
      when current_attempts < current_max
        then 'queued'::public.ai_job_status
      else
        'failed'::public.ai_job_status
    end,
    error_message = error_text,
    locked_at = null,
    locked_by = null
  where id = job_id;
end;
$$;

-- ============================================================
-- AUDIT HELPER
-- ============================================================

create or replace function public.write_audit_log(
  target_business uuid,
  action_name text,
  target_table text,
  target_record uuid,
  old_value jsonb,
  new_value jsonb,
  actor text default 'system'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org uuid;
begin
  select organization_id into target_org
  from public.businesses
  where id = target_business;

  insert into public.audit_logs (
    organization_id,
    business_id,
    user_id,
    actor_type,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  )
  values (
    target_org,
    target_business,
    auth.uid(),
    actor,
    action_name,
    target_table,
    target_record,
    old_value,
    new_value
  );
end;
$$;

-- ============================================================
-- SEED: MASTER INTERVIEW
-- ============================================================

insert into public.interview_templates (
  name, version, industry_code, description, configuration
)
values (
  'Business DNA Master Interview',
  1,
  'universal',
  'Universal adaptive interview for discovering the structure, economics, operations and growth model of a business.',
  '{
    "adaptive": true,
    "persistent": true,
    "allow_pause": true,
    "allow_resume": true,
    "cross_device": true,
    "contradiction_detection": true,
    "confidence_scoring": true,
    "evidence_collection": true,
    "industry_specialization": true
  }'::jsonb
)
on conflict (name, version) do nothing;

do $$
declare
  template_id uuid;
begin
  select id into template_id
  from public.interview_templates
  where name = 'Business DNA Master Interview'
    and version = 1;

  insert into public.interview_stages (
    template_id, stage_key, name, description, sequence, completion_weight
  )
  values
    (template_id,'identity','Business Identity','Understand what the business is and how it operates.',1,1),
    (template_id,'products_services','Products & Services','Understand what customers buy.',2,1),
    (template_id,'customers','Customers','Understand current and ideal customers.',3,1),
    (template_id,'problems','Customer Problems','Understand the problems the business solves.',4,1),
    (template_id,'transformation','Transformation','Understand the outcomes produced.',5,1),
    (template_id,'differentiation','Differentiation','Understand why customers choose the business.',6,1),
    (template_id,'methodology','Methodology & Delivery','Map how value is delivered.',7,1),
    (template_id,'sales_marketing','Sales & Marketing','Understand acquisition and conversion.',8,1),
    (template_id,'operations','Operations','Understand the internal operating model.',9,1),
    (template_id,'people','People & Resources','Understand team structure and dependencies.',10,1),
    (template_id,'economics','Business Economics','Understand revenue, costs, capacity and economics.',11,1),
    (template_id,'technology','Technology','Understand the existing technology stack.',12,1),
    (template_id,'problems_bottlenecks','Bottlenecks','Identify major constraints.',13,1),
    (template_id,'goals','Goals','Understand desired outcomes.',14,1),
    (template_id,'vision','Vision','Define the target operating model.',15,1),
    (template_id,'evidence','Evidence & Verification','Verify important business claims.',16,0.5)
  on conflict (template_id, stage_key) do nothing;
end $$;

-- ============================================================
-- SEED: SEO TEMPLATES
-- ============================================================

insert into public.seo_page_templates (name, page_type, template_config)
values
  ('Industry Solution','industry','{"audience":"business_owner","purpose":"platform_acquisition"}'::jsonb),
  ('Problem Solution','problem','{"audience":"business_owner","purpose":"platform_acquisition"}'::jsonb),
  ('Industry Problem','industry_problem','{"audience":"business_owner","purpose":"platform_acquisition"}'::jsonb),
  ('Industry Location','industry_location','{"audience":"business_owner","purpose":"platform_acquisition"}'::jsonb),
  ('Customer Service Location','customer_service_location','{"audience":"customer","purpose":"customer_acquisition"}'::jsonb)
on conflict do nothing;

-- ============================================================
-- END
-- ============================================================
