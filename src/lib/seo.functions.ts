import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const businessInput = z.object({ businessId: z.string().uuid() });
const scopeInput = businessInput.extend({ scope: z.enum(["platform", "customer"]).default("customer") });

/** Overview, opportunity queue, page library and live generation jobs. */
export const getSeoOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => scopeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { loadSeoOverview } = await import("./seo.server");
    return loadSeoOverview({ supabase: context.supabase, businessId: data.businessId, scope: data.scope });
  });

/** One page with content, evidence, quality report, versions and measurements. */
export const getSeoPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { loadPage } = await import("./seo.server");
    return loadPage(context.supabase, data.pageId);
  });

/** Customer discovery: derives opportunities from verified Brain facts only. */
export const discoverSeoOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { discoverCustomerOpportunities } = await import("./seo.server");
    return discoverCustomerOpportunities({
      supabase: context.supabase,
      businessId: data.businessId,
      userId: context.userId,
    });
  });

/** Manual keyword proposal — rejected outright when the Brain cannot support it. */
export const proposeSeoOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput.extend({ keyword: z.string().min(3).max(160) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { proposeCustomerOpportunity } = await import("./seo.server");
    return proposeCustomerOpportunity({
      supabase: context.supabase,
      businessId: data.businessId,
      keyword: data.keyword,
      userId: context.userId,
    });
  });

/** Queues generation for explicitly selected opportunities (max 10 per call). */
export const generateSeoPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput.extend({ opportunityIds: z.array(z.string().uuid()).min(1).max(10) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { enqueueSeoGeneration } = await import("./seo.server");
    return enqueueSeoGeneration({
      supabase: context.supabase,
      opportunityIds: data.opportunityIds,
      userId: context.userId,
    });
  });

/** Owner edits to title, metadata and body before approval. */
export const saveSeoPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pageId: z.string().uuid(),
        title: z.string().min(5).max(160).optional(),
        metaTitle: z.string().min(10).max(70).optional(),
        metaDescription: z.string().min(30).max(180).optional(),
        h1: z.string().min(5).max(160).optional(),
        intro: z.string().max(4000).optional(),
        sections: z
          .array(
            z.object({
              key: z.string().max(40),
              heading: z.string().min(2).max(160),
              body: z.string().min(20).max(8000),
            }),
          )
          .max(12)
          .optional(),
        reviewNotes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { updatePage } = await import("./seo.server");
    const { pageId, ...patch } = data;
    return updatePage({ supabase: context.supabase, pageId, userId: context.userId, patch });
  });

/** Draft -> Review -> Approve -> Publish, plus pause and archive. */
export const setSeoPageStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pageId: z.string().uuid(),
        status: z.enum(["draft", "review", "approved", "published", "paused", "archived"]),
        note: z.string().max(2000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { setPageStatus } = await import("./seo.server");
    return setPageStatus({
      supabase: context.supabase,
      pageId: data.pageId,
      status: data.status,
      userId: context.userId,
      note: data.note ?? null,
    });
  });

/** Manual or system measurement for a published page. Source is always labelled. */
export const recordSeoMeasurement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pageId: z.string().uuid(),
        metricKey: z.enum(["page_views", "organic_visits", "leads", "enquiries", "bookings", "conversions"]),
        value: z.number().finite().min(0),
        periodStart: z.string().min(4).nullable().optional(),
        periodEnd: z.string().min(4).nullable().optional(),
        source: z.enum(["manual", "system"]).default("manual"),
        note: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { recordPageMeasurement } = await import("./seo.server");
    await recordPageMeasurement({
      supabase: context.supabase,
      pageId: data.pageId,
      metricKey: data.metricKey,
      value: data.value,
      periodStart: data.periodStart ?? null,
      periodEnd: data.periodEnd ?? null,
      source: data.source,
      note: data.note ?? null,
      userId: context.userId,
    });
    return { ok: true };
  });

/* ------------------------------------------------------------------ platform engine */

const platformInput = z.object({ organizationId: z.string().uuid() });

/** Platform (Business OS acquisition) discovery — organisation admins only. */
export const discoverPlatformSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => platformInput.parse(input))
  .handler(async ({ data, context }) => {
    const { runPlatformDiscovery } = await import("./seo.server");
    return runPlatformDiscovery({
      supabase: context.supabase,
      organizationId: data.organizationId,
      userId: context.userId,
    });
  });

/** Generates up to three platform pages per call — never "generate everything". */
export const generatePlatformSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    platformInput.extend({ opportunityIds: z.array(z.string().uuid()).min(1).max(3) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { runPlatformGeneration } = await import("./seo.server");
    return runPlatformGeneration({
      supabase: context.supabase,
      organizationId: data.organizationId,
      userId: context.userId,
      opportunityIds: data.opportunityIds,
    });
  });

export const setPlatformSeoPageStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    platformInput
      .extend({
        pageId: z.string().uuid(),
        status: z.enum(["draft", "review", "approved", "published", "paused", "archived"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { setPlatformPageStatus } = await import("./seo.server");
    return setPlatformPageStatus({
      supabase: context.supabase,
      organizationId: data.organizationId,
      userId: context.userId,
      pageId: data.pageId,
      status: data.status,
    });
  });
