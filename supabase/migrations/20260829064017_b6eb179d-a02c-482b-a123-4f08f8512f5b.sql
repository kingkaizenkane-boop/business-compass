-- ============================================================
-- P2.3 Programmatic SEO + Acquisition Engine
-- ============================================================

-- ---------- seo_sites ----------
ALTER TABLE public.seo_sites
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS subdomain text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS sitemap_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS robots_status text NOT NULL DEFAULT 'allow',
  ADD COLUMN IF NOT EXISTS url_pattern text NOT NULL DEFAULT '/{slug}',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.seo_sites s
SET organization_id = b.organization_id
FROM public.businesses b
WHERE s.business_id = b.id AND s.organization_id IS NULL;

DO $$ BEGIN
  ALTER TABLE public.seo_sites ADD CONSTRAINT seo_sites_site_type_check
    CHECK (site_type IN ('platform', 'customer'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.seo_sites ADD CONSTRAINT seo_sites_status_check
    CHECK (status IN ('draft', 'active', 'paused'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.seo_sites ADD CONSTRAINT seo_sites_customer_needs_business
    CHECK (site_type <> 'customer' OR business_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS seo_sites_customer_unique
  ON public.seo_sites (business_id) WHERE site_type = 'customer';

-- ---------- seo_opportunities ----------
ALTER TABLE public.seo_opportunities
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS service text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS problem text,
  ADD COLUMN IF NOT EXISTS business_stage text,
  ADD COLUMN IF NOT EXISTS business_fit_score numeric,
  ADD COLUMN IF NOT EXISTS content_value_score numeric,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.seo_opportunities o
SET business_id = s.business_id, organization_id = s.organization_id
FROM public.seo_sites s
WHERE o.seo_site_id = s.id AND o.business_id IS NULL;

DO $$ BEGIN
  ALTER TABLE public.seo_opportunities ADD CONSTRAINT seo_opportunities_status_check
    CHECK (status IN ('discovered', 'qualified', 'rejected', 'generated', 'published', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS seo_opportunities_site_keyword_unique
  ON public.seo_opportunities (seo_site_id, lower(keyword));
CREATE INDEX IF NOT EXISTS seo_opportunities_business_idx
  ON public.seo_opportunities (business_id, status);

-- ---------- seo_pages ----------
ALTER TABLE public.seo_pages
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS originality_score numeric,
  ADD COLUMN IF NOT EXISTS business_relevance_score numeric,
  ADD COLUMN IF NOT EXISTS factual_confidence numeric,
  ADD COLUMN IF NOT EXISTS word_count integer,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS quality_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_fact_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS content_fingerprint text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.seo_pages p
SET business_id = s.business_id, organization_id = s.organization_id
FROM public.seo_sites s
WHERE p.seo_site_id = s.id AND p.business_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS seo_pages_site_slug_unique
  ON public.seo_pages (seo_site_id, lower(slug));
CREATE INDEX IF NOT EXISTS seo_pages_business_idx ON public.seo_pages (business_id, status);
CREATE INDEX IF NOT EXISTS seo_pages_published_idx ON public.seo_pages (status, published_at DESC);

-- ---------- seo_page_versions ----------
CREATE TABLE IF NOT EXISTS public.seo_page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text,
  meta_title text,
  meta_description text,
  h1 text,
  slug text,
  canonical_url text,
  content jsonb,
  schema_json jsonb,
  quality_score numeric,
  originality_score numeric,
  business_relevance_score numeric,
  factual_confidence numeric,
  quality_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, version)
);

GRANT SELECT ON public.seo_page_versions TO authenticated;
GRANT ALL ON public.seo_page_versions TO service_role;
ALTER TABLE public.seo_page_versions ENABLE ROW LEVEL SECURITY;

-- ---------- seo_page_measurements ----------
CREATE TABLE IF NOT EXISTS public.seo_page_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  value numeric NOT NULL,
  period_start date,
  period_end date,
  source text NOT NULL DEFAULT 'manual',
  note text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_page_measurements_page_idx
  ON public.seo_page_measurements (page_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_page_measurements TO authenticated;
GRANT ALL ON public.seo_page_measurements TO service_role;
ALTER TABLE public.seo_page_measurements ENABLE ROW LEVEL SECURITY;

-- ---------- policies: sites ----------
DROP POLICY IF EXISTS "members can view seo sites" ON public.seo_sites;
CREATE POLICY "members can view seo sites"
ON public.seo_sites FOR SELECT TO authenticated
USING (
  (business_id IS NOT NULL AND public.is_business_member(business_id))
  OR (site_type = 'platform' AND business_id IS NULL)
);

DROP POLICY IF EXISTS "managers can manage customer seo sites" ON public.seo_sites;
CREATE POLICY "managers can manage customer seo sites"
ON public.seo_sites FOR ALL TO authenticated
USING (business_id IS NOT NULL AND public.is_business_manager(business_id))
WITH CHECK (business_id IS NOT NULL AND public.is_business_manager(business_id));

DROP POLICY IF EXISTS "public can view active seo sites" ON public.seo_sites;
CREATE POLICY "public can view active seo sites"
ON public.seo_sites FOR SELECT TO anon
USING (status = 'active');

GRANT SELECT ON public.seo_sites TO anon;

-- ---------- policies: opportunities ----------
DROP POLICY IF EXISTS "members can view seo opportunities" ON public.seo_opportunities;
CREATE POLICY "members can view seo opportunities"
ON public.seo_opportunities FOR SELECT TO authenticated
USING (
  (business_id IS NOT NULL AND public.is_business_member(business_id))
  OR (business_id IS NULL AND EXISTS (
    SELECT 1 FROM public.seo_sites s
    WHERE s.id = seo_opportunities.seo_site_id AND s.site_type = 'platform'
  ))
);

DROP POLICY IF EXISTS "managers can manage seo opportunities" ON public.seo_opportunities;
CREATE POLICY "managers can manage seo opportunities"
ON public.seo_opportunities FOR ALL TO authenticated
USING (business_id IS NOT NULL AND public.is_business_manager(business_id))
WITH CHECK (business_id IS NOT NULL AND public.is_business_manager(business_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_opportunities TO authenticated;
GRANT ALL ON public.seo_opportunities TO service_role;

-- ---------- policies: pages ----------
DROP POLICY IF EXISTS "members can view seo pages" ON public.seo_pages;
CREATE POLICY "members can view seo pages"
ON public.seo_pages FOR SELECT TO authenticated
USING (
  (business_id IS NOT NULL AND public.is_business_member(business_id))
  OR (business_id IS NULL AND EXISTS (
    SELECT 1 FROM public.seo_sites s
    WHERE s.id = seo_pages.seo_site_id AND s.site_type = 'platform'
  ))
);

DROP POLICY IF EXISTS "managers can manage seo pages" ON public.seo_pages;
CREATE POLICY "managers can manage seo pages"
ON public.seo_pages FOR ALL TO authenticated
USING (business_id IS NOT NULL AND public.is_business_manager(business_id))
WITH CHECK (business_id IS NOT NULL AND public.is_business_manager(business_id));

DROP POLICY IF EXISTS "public can view published seo pages" ON public.seo_pages;
CREATE POLICY "public can view published seo pages"
ON public.seo_pages FOR SELECT TO anon
USING (status = 'published');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_pages TO authenticated;
GRANT SELECT ON public.seo_pages TO anon;
GRANT ALL ON public.seo_pages TO service_role;

-- ---------- policies: versions ----------
DROP POLICY IF EXISTS "members can view seo page versions" ON public.seo_page_versions;
CREATE POLICY "members can view seo page versions"
ON public.seo_page_versions FOR SELECT TO authenticated
USING (
  (business_id IS NOT NULL AND public.is_business_member(business_id))
  OR (business_id IS NULL AND EXISTS (
    SELECT 1 FROM public.seo_pages p JOIN public.seo_sites s ON s.id = p.seo_site_id
    WHERE p.id = seo_page_versions.page_id AND s.site_type = 'platform'
  ))
);

-- ---------- policies: measurements ----------
DROP POLICY IF EXISTS "members can view seo page measurements" ON public.seo_page_measurements;
CREATE POLICY "members can view seo page measurements"
ON public.seo_page_measurements FOR SELECT TO authenticated
USING (business_id IS NOT NULL AND public.is_business_member(business_id));

DROP POLICY IF EXISTS "managers can manage seo page measurements" ON public.seo_page_measurements;
CREATE POLICY "managers can manage seo page measurements"
ON public.seo_page_measurements FOR ALL TO authenticated
USING (business_id IS NOT NULL AND public.is_business_manager(business_id))
WITH CHECK (business_id IS NOT NULL AND public.is_business_manager(business_id));

-- ---------- templates ----------
ALTER TABLE public.seo_page_templates
  ADD COLUMN IF NOT EXISTS site_type text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS eligibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS description text;

CREATE UNIQUE INDEX IF NOT EXISTS seo_page_templates_name_unique
  ON public.seo_page_templates (lower(name));

INSERT INTO public.seo_page_templates (name, page_type, site_type, active, description, eligibility, template_config)
VALUES
  ('platform_industry_problem', 'industry_problem', 'platform', true,
   'Business OS acquisition page: one industry paired with one owner problem.',
   '{"requires":["industry","problem"]}'::jsonb,
   '{"sections":["intro","symptoms","how_business_os_helps","loop","what_you_get","faq","cta"]}'::jsonb),
  ('platform_industry_need', 'industry_need', 'platform', true,
   'Business OS acquisition page: one industry paired with one business need.',
   '{"requires":["industry","topic"]}'::jsonb,
   '{"sections":["intro","need","how_business_os_helps","what_you_get","faq","cta"]}'::jsonb),
  ('platform_industry_stage', 'industry_stage', 'platform', false,
   'Business OS acquisition page: one industry at a specific business stage.',
   '{"requires":["industry","business_stage"]}'::jsonb,
   '{"sections":["intro","stage","how_business_os_helps","what_you_get","faq","cta"]}'::jsonb),
  ('customer_service_location', 'service_location', 'customer', true,
   'Customer page: one verified service in one verified location.',
   '{"requires":["service","location"],"verified":["service","location"]}'::jsonb,
   '{"sections":["intro","services","why_choose","location","booking","faq","cta"]}'::jsonb),
  ('customer_business_service', 'business_service', 'customer', true,
   'Customer page: the business and one verified service.',
   '{"requires":["service"],"verified":["service"]}'::jsonb,
   '{"sections":["intro","services","why_choose","booking","faq","cta"]}'::jsonb),
  ('customer_business_location', 'business_location', 'customer', true,
   'Customer page: the business in one verified location.',
   '{"requires":["location"],"verified":["location"]}'::jsonb,
   '{"sections":["intro","services","why_choose","location","booking","faq","cta"]}'::jsonb),
  ('customer_service_location_need', 'service_location_need', 'customer', false,
   'Customer page: verified service and location plus a specific customer need.',
   '{"requires":["service","location","topic"],"verified":["service","location"]}'::jsonb,
   '{"sections":["intro","need","services","why_choose","location","booking","faq","cta"]}'::jsonb)
ON CONFLICT DO NOTHING;

-- ---------- platform site ----------
INSERT INTO public.seo_sites (site_type, business_id, name, domain, status, url_pattern, active, configuration)
SELECT 'platform', NULL, 'Business OS', 'ops-intellipro.lovable.app', 'active', '/{slug}', true, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.seo_sites WHERE site_type = 'platform');