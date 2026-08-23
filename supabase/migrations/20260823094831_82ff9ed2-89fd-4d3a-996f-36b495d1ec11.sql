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