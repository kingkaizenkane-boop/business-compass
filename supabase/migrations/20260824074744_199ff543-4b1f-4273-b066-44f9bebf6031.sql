-- 1. AI job queue hardening
ALTER TABLE public.ai_jobs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS progress text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ai_jobs_idempotency_key_uidx
  ON public.ai_jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_jobs_business_status_idx
  ON public.ai_jobs (business_id, status, created_at DESC);

-- Requeue jobs that were claimed but never finished.
CREATE OR REPLACE FUNCTION public.reclaim_stalled_ai_jobs(stale_seconds integer DEFAULT 300)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  reclaimed integer;
begin
  with stalled as (
    update public.ai_jobs
    set
      status = case when attempts < max_attempts then 'queued'::public.ai_job_status else 'failed'::public.ai_job_status end,
      error_message = coalesce(error_message, 'Job stalled and was reclaimed by the worker.'),
      last_error_at = now(),
      locked_at = null,
      locked_by = null
    where status = 'running'
      and coalesce(heartbeat_at, locked_at, started_at, created_at) < now() - make_interval(secs => stale_seconds)
    returning 1
  )
  select count(*) into reclaimed from stalled;
  return reclaimed;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.reclaim_stalled_ai_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reclaim_stalled_ai_jobs(integer) TO service_role;

-- 2. Fact versioning + evidence traceability
ALTER TABLE public.brain_facts
  ADD COLUMN IF NOT EXISTS supersedes_fact_id uuid REFERENCES public.brain_facts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by_fact_id uuid REFERENCES public.brain_facts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_response_id uuid REFERENCES public.interview_responses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS brain_facts_business_key_active_idx
  ON public.brain_facts (business_id, fact_key, active);

CREATE INDEX IF NOT EXISTS brain_facts_source_id_idx
  ON public.brain_facts (source_id);

CREATE UNIQUE INDEX IF NOT EXISTS brain_fact_evidence_uidx
  ON public.brain_fact_evidence (fact_id, evidence_id);

-- 3. AI memory de-duplication per source
CREATE UNIQUE INDEX IF NOT EXISTS ai_memory_source_uidx
  ON public.ai_memory (business_id, memory_type, source_table, source_id)
  WHERE source_id IS NOT NULL;

-- 4. Per-organization AI usage accounting
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.ai_jobs(id) ON DELETE SET NULL,
  operation text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric NOT NULL DEFAULT 0,
  succeeded boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view org ai usage" ON public.ai_usage;
CREATE POLICY "members can view org ai usage"
  ON public.ai_usage FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE INDEX IF NOT EXISTS ai_usage_org_created_idx
  ON public.ai_usage (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.organization_ai_limits (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  monthly_token_limit bigint NOT NULL DEFAULT 3000000,
  monthly_cost_limit_usd numeric NOT NULL DEFAULT 25,
  paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  paused_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.organization_ai_limits TO authenticated;
GRANT ALL ON public.organization_ai_limits TO service_role;
ALTER TABLE public.organization_ai_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view org ai limits" ON public.organization_ai_limits;
CREATE POLICY "members can view org ai limits"
  ON public.organization_ai_limits FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "admins can create org ai limits" ON public.organization_ai_limits;
CREATE POLICY "admins can create org ai limits"
  ON public.organization_ai_limits FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "admins can update org ai limits" ON public.organization_ai_limits;
CREATE POLICY "admins can update org ai limits"
  ON public.organization_ai_limits FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

DROP TRIGGER IF EXISTS trg_organization_ai_limits_updated_at ON public.organization_ai_limits;
CREATE TRIGGER trg_organization_ai_limits_updated_at
  BEFORE UPDATE ON public.organization_ai_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
