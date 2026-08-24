REVOKE EXECUTE ON FUNCTION public.reclaim_stalled_ai_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reclaim_stalled_ai_jobs(integer) TO service_role;