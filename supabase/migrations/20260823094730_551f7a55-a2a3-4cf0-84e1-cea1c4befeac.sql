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