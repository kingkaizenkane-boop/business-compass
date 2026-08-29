-- User-initiated actions (experiments, metrics, processes, interview answers)
-- write their audit trail through the caller's RLS session. Without an INSERT
-- policy every one of those writes was rejected and silently dropped, leaving
-- the audit trail complete only for service-role worker jobs.
create policy "members can append business audit logs"
on public.audit_logs
for insert
to authenticated
with check (
  (business_id is not null and public.is_business_member(business_id))
  or (business_id is null and organization_id is not null and public.is_org_member(organization_id))
);

-- Outcome memory written on the user's path (metric observations, experiment
-- results) needs the same treatment. Reads already require business membership.
create policy "members can write ai memory"
on public.ai_memory
for insert
to authenticated
with check (public.is_business_member(business_id));

create policy "members can update ai memory"
on public.ai_memory
for update
to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

grant select, insert on public.audit_logs to authenticated;
grant select, insert, update on public.ai_memory to authenticated;
grant all on public.audit_logs to service_role;
grant all on public.ai_memory to service_role;