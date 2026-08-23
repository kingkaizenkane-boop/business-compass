import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: memberships, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(id, name, slug, plan_code, status)")
      .eq("user_id", userId);
    if (memberError) throw memberError;

    let orgs = (memberships ?? []).flatMap((m) => (m.organizations ? [m.organizations] : []));

    if (orgs.length === 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      const name = profile?.full_name ? `${profile.full_name}'s workspace` : "My workspace";
      const slug = `ws-${userId.slice(0, 8)}-${Date.now().toString(36)}`;
      const orgId = crypto.randomUUID();

      // Insert without returning: the SELECT policy requires membership,
      // which only exists after the organization_members row below.
      const { error: orgError } = await supabase
        .from("organizations")
        .insert({ id: orgId, name, slug, created_by: userId });
      if (orgError) throw orgError;

      const { error: linkError } = await supabase
        .from("organization_members")
        .insert({ organization_id: orgId, user_id: userId, role: "owner" });
      if (linkError) throw linkError;

      const { data: org, error: readError } = await supabase
        .from("organizations")
        .select("id, name, slug, plan_code, status")
        .eq("id", orgId)
        .single();
      if (readError) throw readError;

      orgs = [org];
    }


    const { data: businesses, error: bizError } = await supabase
      .from("businesses")
      .select("id, organization_id, name, slug, industry, business_model, status, created_at")
      .order("created_at", { ascending: true });
    if (bizError) throw bizError;

    return {
      userId,
      organizations: orgs,
      businesses: businesses ?? [],
    };
  });

export const createBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        name: z.string().min(2).max(120),
        industry: z.string().max(120).optional(),
        subIndustry: z.string().max(120).optional(),
        businessModel: z.string().max(120).optional(),
        customerModel: z.string().max(60).optional(),
        websiteUrl: z.string().max(200).optional(),
        locationLabel: z.string().max(200).optional(),
        description: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const slugBase = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

    const { data: business, error } = await supabase
      .from("businesses")
      .insert({
        organization_id: data.organizationId,
        name: data.name,
        slug: `${slugBase || "business"}-${Date.now().toString(36)}`,
        industry: data.industry ?? null,
        sub_industry: data.subIndustry ?? null,
        business_model: data.businessModel ?? null,
        customer_model: data.customerModel ?? null,
        website_url: data.websiteUrl ?? null,
        description: data.description ?? null,
        primary_location: data.locationLabel ? { label: data.locationLabel } : {},
      })
      .select("id, organization_id, name, slug, industry, business_model, status, created_at")
      .single();
    if (error) throw error;

    return business;
  });
