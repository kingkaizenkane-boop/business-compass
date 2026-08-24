-- ai_jobs: scope NULL business_id rows to org members
DROP POLICY IF EXISTS "members can view ai jobs" ON public.ai_jobs;
CREATE POLICY "members can view ai jobs"
ON public.ai_jobs FOR SELECT TO authenticated
USING (
  (business_id IS NOT NULL AND public.is_business_member(business_id))
  OR (business_id IS NULL AND organization_id IS NOT NULL AND public.is_org_member(organization_id))
);

-- audit_logs: scope NULL business_id rows to org members
DROP POLICY IF EXISTS "members can view business audit logs" ON public.audit_logs;
CREATE POLICY "members can view business audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  (business_id IS NOT NULL AND public.is_business_member(business_id))
  OR (business_id IS NULL AND organization_id IS NOT NULL AND public.is_org_member(organization_id))
);

-- seo_sites and dependents: require business membership
DROP POLICY IF EXISTS "members can view seo sites" ON public.seo_sites;
CREATE POLICY "members can view seo sites"
ON public.seo_sites FOR SELECT TO authenticated
USING (business_id IS NOT NULL AND public.is_business_member(business_id));

DROP POLICY IF EXISTS "members can view seo opportunities" ON public.seo_opportunities;
CREATE POLICY "members can view seo opportunities"
ON public.seo_opportunities FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.seo_sites s
  WHERE s.id = seo_opportunities.seo_site_id
    AND s.business_id IS NOT NULL
    AND public.is_business_member(s.business_id)
));

DROP POLICY IF EXISTS "members can view seo pages" ON public.seo_pages;
CREATE POLICY "members can view seo pages"
ON public.seo_pages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.seo_sites s
  WHERE s.id = seo_pages.seo_site_id
    AND s.business_id IS NOT NULL
    AND public.is_business_member(s.business_id)
));

-- Internal routine: not callable directly by clients
REVOKE EXECUTE ON FUNCTION public.update_interview_progress(uuid, text, text, numeric, numeric) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_interview_progress(uuid, text, text, numeric, numeric) TO service_role;