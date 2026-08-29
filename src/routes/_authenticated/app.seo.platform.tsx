import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Compass } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, SectionLabel, StatBlock } from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  discoverPlatformSeo,
  generatePlatformSeo,
  getSeoOverview,
  setPlatformSeoPageStatus,
} from "@/lib/seo.functions";
import { OPPORTUNITY_STATUS_LABELS, PAGE_STATUS_LABELS, scoreTone } from "@/lib/seo-types";

export const Route = createFileRoute("/_authenticated/app/seo/platform")({
  head: () => ({
    meta: [
      { title: "Platform SEO — Business OS" },
      {
        name: "description",
        content:
          "Acquisition pages that market Business OS itself — a separate dataset from your customer pages, with the same quality gate and human review.",
      },
      { property: "og:title", content: "Platform SEO — Business OS" },
      {
        property: "og:description",
        content: "Industry and problem pages for Business OS acquisition, reviewed before publishing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlatformSeoPage,
});

const TONE = {
  good: "border-positive/40 text-positive",
  warn: "border-caution/50 text-caution-foreground",
  bad: "border-destructive/40 text-destructive",
} as const;

function PlatformSeoPage() {
  const { activeBusiness, activeOrganization, loading } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const organizationId = activeOrganization?.id ?? null;
  const queryClient = useQueryClient();

  const fetchOverview = useServerFn(getSeoOverview);
  const discover = useServerFn(discoverPlatformSeo);
  const generate = useServerFn(generatePlatformSeo);
  const changeStatus = useServerFn(setPlatformSeoPageStatus);

  const [selected, setSelected] = useState<string[]>([]);

  const queryKey = ["seo-overview", businessId, "platform"];
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchOverview({ data: { businessId: businessId!, scope: "platform" } }),
    enabled: businessId !== null,
    retry: false,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey });

  const runDiscovery = useMutation({
    mutationFn: () => discover({ data: { organizationId: organizationId! } }),
    onSuccess: (result) => {
      toast.success(`${result.created.length} platform opportunit${result.created.length === 1 ? "y" : "ies"} added.`);
      invalidate();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const runGeneration = useMutation({
    mutationFn: () => generate({ data: { organizationId: organizationId!, opportunityIds: selected.slice(0, 3) } }),
    onSuccess: (result) => {
      toast.success(`${result.generated} page(s) generated, ${result.failed} blocked.`);
      if (result.reasons.length > 0) toast.error(result.reasons[0]!);
      setSelected([]);
      invalidate();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const publish = useMutation({
    mutationFn: (input: { pageId: string; status: "review" | "approved" | "published" | "paused" }) =>
      changeStatus({ data: { organizationId: organizationId!, pageId: input.pageId, status: input.status } }),
    onSuccess: (result) => {
      if (result.ok) toast.success("Platform page updated.");
      else toast.error(result.reason ?? "That change was blocked.");
      invalidate();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  if (loading || (isLoading && businessId)) {
    return <div className="p-2 text-sm text-muted-foreground">Loading platform SEO…</div>;
  }

  if (error) {
    return (
      <EmptyState
        icon={Building2}
        title="Platform SEO is not available for your account"
        body="Acquisition pages for Business OS itself are managed by the platform team. Your own customer pages live under the Overview and Page library tabs."
        primary={{ label: "Back to SEO overview", to: "/app/seo" }}
      />
    );
  }

  const opportunities = (data?.opportunities ?? []).filter((o) => o.status === "qualified");
  const pages = data?.pages ?? [];
  const counts = data?.counts;

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(0, 3)));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Acquisition"
        title="Platform SEO"
        subtitle="Pages that market Business OS to businesses like yours. Kept in a completely separate dataset from your own customer pages, and held to the same quality gate."
        actions={
          organizationId ? (
            <Button onClick={() => runDiscovery.mutate()} disabled={runDiscovery.isPending}>
              <Compass className="mr-1.5 size-4" aria-hidden />
              {runDiscovery.isPending ? "Discovering…" : "Run discovery"}
            </Button>
          ) : null
        }
      />

      {counts ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatBlock label="Qualified" value={String(counts.qualified)} caption="Industry, problem and stage pages worth writing." />
          <StatBlock label="Awaiting review" value={String(counts.draft + counts.review)} caption="Generated, not yet approved." />
          <StatBlock label="Published" value={String(counts.published)} caption="Live acquisition pages." />
          <StatBlock label="Below quality gate" value={String(counts.qualityFailures)} caption="Cannot publish until improved." />
        </div>
      ) : null}

      <section>
        <SectionLabel aside={selected.length > 0 ? `${selected.length} selected (max 3)` : "Max 3 per run"}>
          Opportunities
        </SectionLabel>
        {opportunities.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-quiet">
            No qualified platform opportunities yet — run discovery to build the queue.
          </div>
        ) : (
          <>
            {selected.length > 0 ? (
              <div className="mb-3">
                <Button size="sm" onClick={() => runGeneration.mutate()} disabled={runGeneration.isPending}>
                  {runGeneration.isPending ? "Generating…" : `Generate ${selected.length} page(s)`}
                </Button>
              </div>
            ) : null}
            <ul className="space-y-2">
              {opportunities.map((opportunity) => (
                <li
                  key={opportunity.id}
                  className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-quiet"
                >
                  {opportunity.pageId ? (
                    <span className="mt-1 size-4" aria-hidden />
                  ) : (
                    <Checkbox
                      checked={selected.includes(opportunity.id)}
                      onCheckedChange={() => toggle(opportunity.id)}
                      aria-label={`Select ${opportunity.keyword}`}
                      className="mt-1"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-foreground">{opportunity.keyword}</p>
                      <Badge variant="outline" className={`rounded-full ${TONE[scoreTone(opportunity.score)]}`}>
                        {opportunity.score ?? "—"}/100
                      </Badge>
                      <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">
                        {OPPORTUNITY_STATUS_LABELS[opportunity.status]}
                      </Badge>
                      {opportunity.pageId ? (
                        <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">
                          Page created
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[opportunity.industry, opportunity.problem, opportunity.businessStage, opportunity.intent]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <SectionLabel>Platform pages</SectionLabel>
        {pages.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-quiet">
            No platform pages generated yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {pages.map((page) => (
              <li
                key={page.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-quiet"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{page.title ?? page.slug}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {page.path} · {PAGE_STATUS_LABELS[page.status]} · v{page.version}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`rounded-full ${TONE[scoreTone(page.qualityScore)]}`}>
                    {page.qualityScore ?? "—"}/100
                  </Badge>
                  {page.status === "draft" ? (
                    <Button size="sm" variant="outline" onClick={() => publish.mutate({ pageId: page.id, status: "review" })}>
                      Review
                    </Button>
                  ) : null}
                  {page.status === "review" ? (
                    <Button size="sm" variant="outline" onClick={() => publish.mutate({ pageId: page.id, status: "approved" })}>
                      Approve
                    </Button>
                  ) : null}
                  {page.status === "approved" ? (
                    <Button size="sm" onClick={() => publish.mutate({ pageId: page.id, status: "published" })}>
                      Publish
                    </Button>
                  ) : null}
                  {page.status === "published" ? (
                    <Button size="sm" variant="outline" onClick={() => publish.mutate({ pageId: page.id, status: "paused" })}>
                      Pause
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
