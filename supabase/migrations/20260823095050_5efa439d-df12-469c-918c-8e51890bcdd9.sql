drop policy if exists "members can view business audit logs" on public.audit_logs;
create policy "members can view business audit logs"
on public.audit_logs for select to authenticated
using (
  business_id is null or public.is_business_member(business_id)
);

drop policy if exists "members can view seo page templates" on public.seo_page_templates;
create policy "members can view seo page templates"
on public.seo_page_templates for select to authenticated
using (active = true);

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
set search_path = public, extensions
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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- DATA API GRANTS (required for PostgREST access; RLS still applies)
-- ============================================================

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

revoke execute on function public.claim_ai_job(text, text[]) from anon, authenticated;
revoke execute on function public.complete_ai_job(uuid, jsonb) from anon, authenticated;
revoke execute on function public.fail_ai_job(uuid, text) from anon, authenticated;
revoke execute on function public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, text) from anon, authenticated;
revoke execute on function public.update_interview_progress(uuid, text, text, numeric, numeric) from anon;
revoke execute on function public.match_business_memory(extensions.vector, uuid, float, integer) from anon;
revoke execute on function public.is_org_member(uuid) from anon;
revoke execute on function public.is_org_admin(uuid) from anon;
revoke execute on function public.is_business_member(uuid) from anon;
revoke execute on function public.is_business_manager(uuid) from anon;

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
  tpl_id uuid;
begin
  select id into tpl_id
  from public.interview_templates
  where name = 'Business DNA Master Interview'
    and version = 1;

  insert into public.interview_stages (
    template_id, stage_key, name, description, sequence, completion_weight
  )
  values
    (tpl_id,'identity','Business Identity','Understand what the business is and how it operates.',1,1),
    (tpl_id,'products_services','Products & Services','Understand what customers buy.',2,1),
    (tpl_id,'customers','Customers','Understand current and ideal customers.',3,1),
    (tpl_id,'problems','Customer Problems','Understand the problems the business solves.',4,1),
    (tpl_id,'transformation','Transformation','Understand the outcomes produced.',5,1),
    (tpl_id,'differentiation','Differentiation','Understand why customers choose the business.',6,1),
    (tpl_id,'methodology','Methodology & Delivery','Map how value is delivered.',7,1),
    (tpl_id,'sales_marketing','Sales & Marketing','Understand acquisition and conversion.',8,1),
    (tpl_id,'operations','Operations','Understand the internal operating model.',9,1),
    (tpl_id,'people','People & Resources','Understand team structure and dependencies.',10,1),
    (tpl_id,'economics','Business Economics','Understand revenue, costs, capacity and economics.',11,1),
    (tpl_id,'technology','Technology','Understand the existing technology stack.',12,1),
    (tpl_id,'problems_bottlenecks','Bottlenecks','Identify major constraints.',13,1),
    (tpl_id,'goals','Goals','Understand desired outcomes.',14,1),
    (tpl_id,'vision','Vision','Define the target operating model.',15,1),
    (tpl_id,'evidence','Evidence & Verification','Verify important business claims.',16,0.5)
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