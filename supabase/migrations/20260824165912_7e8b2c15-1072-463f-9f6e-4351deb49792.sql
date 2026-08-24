-- ============================================================ enums
do $$ begin
  create type public.process_trigger_type as enum (
    'manual','scheduled','event','inbound_lead','customer_action','metric_threshold','ai_recommendation'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.process_owner_type as enum ('human','ai','hybrid','system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.process_step_type as enum (
    'action','decision','wait','approval','notification','data_capture','ai_generation','integration','end'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.process_execution_status as enum (
    'queued','running','waiting','approval_required','completed','failed','cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.process_approval_status as enum ('pending','approved','rejected','paused','expired');
exception when duplicate_object then null; end $$;

-- ============================================================ processes
alter table public.processes
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists purpose text,
  add column if not exists trigger_type public.process_trigger_type not null default 'manual',
  add column if not exists trigger_definition jsonb not null default '{}'::jsonb,
  add column if not exists owner_type public.process_owner_type not null default 'human',
  add column if not exists owner_id uuid,
  add column if not exists autonomy_level integer not null default 1,
  add column if not exists success_definition text,
  add column if not exists created_from_action_id uuid references public.tasks(id) on delete set null,
  add column if not exists created_from_diagnosis_id uuid references public.diagnosis_runs(id) on delete set null,
  add column if not exists created_from_blueprint_version integer,
  add column if not exists version integer not null default 1,
  add column if not exists supersedes_process_id uuid references public.processes(id) on delete set null;

update public.processes p
set organization_id = b.organization_id
from public.businesses b
where b.id = p.business_id and p.organization_id is null;

do $$ begin
  alter table public.processes
    add constraint processes_autonomy_level_check check (autonomy_level between 0 and 4);
exception when duplicate_object then null; end $$;

create index if not exists processes_business_status_idx on public.processes (business_id, status);
create index if not exists processes_supersedes_idx on public.processes (supersedes_process_id);

-- ============================================================ process_steps
alter table public.process_steps
  add column if not exists step_type public.process_step_type not null default 'action',
  add column if not exists owner_type public.process_owner_type not null default 'human',
  add column if not exists owner_id uuid,
  add column if not exists autonomy_level integer not null default 1,
  add column if not exists input_definition jsonb not null default '{}'::jsonb,
  add column if not exists output_definition jsonb not null default '{}'::jsonb,
  add column if not exists condition_definition jsonb not null default '{}'::jsonb,
  add column if not exists required boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.process_steps
    add constraint process_steps_autonomy_level_check check (autonomy_level between 0 and 4);
exception when duplicate_object then null; end $$;

create unique index if not exists process_steps_process_sequence_idx
  on public.process_steps (process_id, sequence);

drop trigger if exists trg_process_steps_updated_at on public.process_steps;
create trigger trg_process_steps_updated_at
  before update on public.process_steps
  for each row execute function public.set_updated_at();

alter table public.process_steps enable row level security;

drop policy if exists "managers can manage process steps" on public.process_steps;
create policy "managers can manage process steps"
  on public.process_steps for all to authenticated
  using (exists (select 1 from public.processes p where p.id = process_steps.process_id and public.is_business_manager(p.business_id)))
  with check (exists (select 1 from public.processes p where p.id = process_steps.process_id and public.is_business_manager(p.business_id)));

-- ============================================================ process_executions
create table if not exists public.process_executions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  process_id uuid not null references public.processes(id) on delete cascade,
  process_version integer not null default 1,
  status public.process_execution_status not null default 'queued',
  trigger_source text not null default 'manual',
  trigger_payload jsonb not null default '{}'::jsonb,
  current_step_id uuid references public.process_steps(id) on delete set null,
  current_step_sequence integer,
  initiated_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  output jsonb not null default '{}'::jsonb,
  step_log jsonb not null default '[]'::jsonb,
  duration_ms integer,
  completed boolean not null default false,
  failed boolean not null default false,
  success boolean,
  metric_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.process_executions to authenticated;
grant all on public.process_executions to service_role;

alter table public.process_executions enable row level security;

create policy "members can view process executions"
  on public.process_executions for select to authenticated
  using (public.is_business_member(business_id));

create index if not exists process_executions_business_idx
  on public.process_executions (business_id, created_at desc);
create index if not exists process_executions_process_idx
  on public.process_executions (process_id, created_at desc);

create trigger trg_process_executions_updated_at
  before update on public.process_executions
  for each row execute function public.set_updated_at();

-- ============================================================ process_approvals
create table if not exists public.process_approvals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  process_id uuid not null references public.processes(id) on delete cascade,
  execution_id uuid not null references public.process_executions(id) on delete cascade,
  step_id uuid references public.process_steps(id) on delete set null,
  step_sequence integer,
  status public.process_approval_status not null default 'pending',
  title text not null,
  what_will_happen text,
  why_recommended text,
  data_used jsonb not null default '{}'::jsonb,
  external_effect text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, update on public.process_approvals to authenticated;
grant all on public.process_approvals to service_role;

alter table public.process_approvals enable row level security;

create policy "members can view process approvals"
  on public.process_approvals for select to authenticated
  using (public.is_business_member(business_id));

create policy "managers can decide process approvals"
  on public.process_approvals for update to authenticated
  using (public.is_business_manager(business_id))
  with check (public.is_business_manager(business_id));

create index if not exists process_approvals_business_status_idx
  on public.process_approvals (business_id, status, created_at desc);
create index if not exists process_approvals_execution_idx
  on public.process_approvals (execution_id);

create trigger trg_process_approvals_updated_at
  before update on public.process_approvals
  for each row execute function public.set_updated_at();
