ALTER TYPE public.seo_page_status ADD VALUE IF NOT EXISTS 'review' BEFORE 'published';
ALTER TYPE public.seo_page_status ADD VALUE IF NOT EXISTS 'approved' BEFORE 'published';