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