-- P2.2 Experiments & Learning Engine
create type public.experiment_status as enum ('draft','planned','running','paused','completed','cancelled');
create type public.experiment_type as enum ('before_after','controlled','observational');
create type public.experiment_learning_status as enum ('pending','positive','negative','inconclusive');

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  hypothesis text,
  hypothesis_intervention text,
  hypothesis_expected_change text,
  hypothesis_rationale text,
  rationale text,
  status public.experiment_status not null default 'draft',
  experiment_type public.experiment_type not null default 'before_after',
  intervention_summary text,
  comparison_definition text,
  start_date date,
  end_date date,
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  primary_metric_id uuid references public.metric_definitions(id) on delete set null,
  baseline_value numeric,
  baseline_period_start date,
  baseline_period_end date,
  baseline_source text,
  baseline_observation_id uuid references public.business_metrics(id) on delete set null,
  target_value numeric,
  final_value numeric,
  absolute_change numeric,
  percent_change numeric,
  target_achieved boolean,
  result_data jsonb not null default '{}'::jsonb,
  conclusion text,
  learning text,
  limitation text,
  recommendation text,
  confidence numeric,
  confidence_level public.confidence_level,
  learning_status public.experiment_learning_status not null default 'pending',
  learning_generated_at timestamptz,
  source_diagnosis_run_id uuid references public.diagnosis_runs(id) on delete set null,
  source_diagnosis_item_id uuid references public.diagnosis_items(id) on delete set null,
  source_blueprint_id uuid references public.business_blueprints(id) on delete set null,
  source_blueprint_version integer,
  source_task_id uuid references public.tasks(id) on delete set null,
  process_id uuid references public.processes(id) on delete set null,
  process_version integer,
  process_execution_id uuid references public.process_executions(id) on delete set null,
  evidence jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  definition_locked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.experiment_metrics (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  metric_id uuid not null references public.metric_definitions(id) on delete cascade,
  role text not null default 'secondary',
  created_at timestamptz not null default now(),
  constraint experiment_metrics_role_check check (role in ('primary','secondary','guardrail')),
  constraint experiment_metrics_unique unique (experiment_id, metric_id)
);

create index experiments_business_status_idx on public.experiments (business_id, status, created_at desc);
create index experiments_primary_metric_idx on public.experiments (primary_metric_id);
create index experiments_source_diagnosis_item_idx on public.experiments (source_diagnosis_item_id);
create index experiments_source_task_idx on public.experiments (source_task_id);
create index experiments_process_idx on public.experiments (process_id);
create index experiment_metrics_metric_idx on public.experiment_metrics (metric_id);

grant select, insert, update, delete on public.experiments to authenticated;
grant all on public.experiments to service_role;
grant select, insert, update, delete on public.experiment_metrics to authenticated;
grant all on public.experiment_metrics to service_role;

alter table public.experiments enable row level security;
alter table public.experiment_metrics enable row level security;

create policy "experiments_select_members" on public.experiments
  for select to authenticated
  using (public.is_business_member(business_id));

create policy "experiments_insert_managers" on public.experiments
  for insert to authenticated
  with check (public.is_business_manager(business_id));

create policy "experiments_update_managers" on public.experiments
  for update to authenticated
  using (public.is_business_manager(business_id))
  with check (public.is_business_manager(business_id));

create policy "experiment_metrics_select_members" on public.experiment_metrics
  for select to authenticated
  using (exists (
    select 1 from public.experiments e
    where e.id = experiment_metrics.experiment_id
      and public.is_business_member(e.business_id)
  ));

create policy "experiment_metrics_write_managers" on public.experiment_metrics
  for insert to authenticated
  with check (exists (
    select 1 from public.experiments e
    where e.id = experiment_metrics.experiment_id
      and public.is_business_manager(e.business_id)
  ));

create policy "experiment_metrics_delete_managers" on public.experiment_metrics
  for delete to authenticated
  using (exists (
    select 1 from public.experiments e
    where e.id = experiment_metrics.experiment_id
      and public.is_business_manager(e.business_id)
  ));

create trigger trg_experiments_updated_at
  before update on public.experiments
  for each row execute function public.set_updated_at();