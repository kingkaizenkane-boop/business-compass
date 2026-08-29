import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public read of a published page. Unauthenticated by design — published only. */
export const getPublishedSeoPage = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        siteType: z.enum(["platform", "customer"]),
        slug: z.string().min(1).max(200),
        siteId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { loadPublishedPage } = await import("./seo.server");
    const page = await loadPublishedPage({
      siteType: data.siteType,
      slug: data.slug,
      ...(data.siteId ? { siteId: data.siteId } : {}),
    });
    if (!page) return null;
    // Serialised so the JSON-LD travels as a plain string to the route head.
    return { ...page, schema: page.schema ? JSON.stringify(page.schema) : null };
  });
