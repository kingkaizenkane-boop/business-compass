create type public.metric_direction as enum ('higher_is_better','lower_is_better','target_range');
create type public.metric_frequency as enum ('daily','weekly','monthly','quarterly','custom');
create type public.metric_source as enum ('manual','process','integration','import','system','ai');

create table public.metric_definitions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  metric_key text not null,
  category text,
  unit text,
  description text,
  source public.metric_source not null default 'manual',
  direction public.metric_direction not null default 'higher_is_better',
  frequency public.metric_frequency not null default 'monthly',
  baseline_value numeric,
  baseline_at timestamptz,
  target_value numeric,
  target_min numeric,
  target_max numeric,
  current_value numeric,
  current_recorded_at timestamptz,
  active boolean not null default true,
  goal_id uuid references public.business_goals(id) on delete set null,
  diagnosis_item_id uuid references public.diagnosis_items(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  process_id uuid references public.processes(id) on delete set null,
  process_execution_id uuid references public.process_executions(id) on delete set null,
  rationale text,
  hypothesis text,
  intervention text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, metric_key)
);

grant select, insert, update, delete on public.metric_definitions to authenticated;
grant all on public.metric_definitions to service_role;

alter table public.metric_definitions enable row level security;

create policy "members can view metric definitions"
  on public.metric_definitions for select to authenticated
  using (public.is_business_member(business_id));

create policy "managers can manage metric definitions"
  on public.metric_definitions for all to authenticated
  using (public.is_business_manager(business_id))
  with check (public.is_business_manager(business_id));

create trigger trg_metric_definitions_updated_at
  before update on public.metric_definitions
  for each row execute function public.set_updated_at();

create index idx_metric_definitions_business on public.metric_definitions (business_id, active);
create index idx_metric_definitions_task on public.metric_definitions (task_id);
create index idx_metric_definitions_process on public.metric_definitions (process_id);

alter table public.business_metrics
  add column metric_id uuid references public.metric_definitions(id) on delete cascade,
  add column notes text,
  add column created_by uuid references auth.users(id) on delete set null;

create index idx_business_metrics_metric on public.business_metrics (metric_id, recorded_at desc);