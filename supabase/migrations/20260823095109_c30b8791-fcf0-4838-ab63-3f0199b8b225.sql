revoke execute on function public.is_org_member(uuid) from public, anon, authenticated;
revoke execute on function public.is_org_admin(uuid) from public, anon, authenticated;
revoke execute on function public.is_business_member(uuid) from public, anon, authenticated;
revoke execute on function public.is_business_manager(uuid) from public, anon, authenticated;
revoke execute on function public.update_interview_progress(uuid, text, text, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.match_business_memory(extensions.vector, uuid, float, integer) from public, anon, authenticated;
revoke execute on function public.claim_ai_job(text, text[]) from public, anon, authenticated;
revoke execute on function public.complete_ai_job(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_ai_job(uuid, text) from public, anon, authenticated;
revoke execute on function public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- membership checks are evaluated inside RLS policies as the querying role
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.is_business_manager(uuid) to authenticated;

-- called directly by the app for the resumable interview and memory recall
grant execute on function public.update_interview_progress(uuid, text, text, numeric, numeric) to authenticated;
grant execute on function public.match_business_memory(extensions.vector, uuid, float, integer) to authenticated;

-- server-side only
grant execute on function public.claim_ai_job(text, text[]) to service_role;
grant execute on function public.complete_ai_job(uuid, jsonb) to service_role;
grant execute on function public.fail_ai_job(uuid, text) to service_role;
grant execute on function public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, text) to service_role;