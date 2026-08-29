import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";

import { EmptyState, PageHeader, SectionLabel, StatBlock } from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { getSeoOverview } from "@/lib/seo.functions";
import { QUALITY_THRESHOLD } from "@/lib/seo-types";

export const Route = createFileRoute("/_authenticated/app/seo/")({
  head: () => ({
    meta: [
      { title: "SEO Engine — Business OS" },
      {
        name: "description",
        content:
          "Keyword opportunities, quality-gated page generation and published performance — grounded in verified Business Brain facts.",
      },
      { property: "og:title", content: "SEO Engine — Business OS" },
      {
        property: "og:description",
        content: "Opportunities, reviewed generation and real measured results for your SEO pages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SeoOverviewPage,
});

const CHECK_LABELS = [
  "Content depth",
  "Business relevance",
  "Search intent",
  "Originality",
  "Internal linking",
  "Metadata",
  "Schema",
  "Canonical URL",
  "Indexability",
];

function SeoOverviewPage() {
  const { activeBusiness, loading } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const fetchOverview = useServerFn(getSeoOverview);

  const { data, isLoading } = useQuery({
    queryKey: ["seo-overview", businessId, "customer"],
    queryFn: () => fetchOverview({ data: { businessId: businessId!, scope: "customer" } }),
    enabled: businessId !== null,
    refetchInterval: (query) =>
      (query.state.data?.jobs ?? []).some((job) => job.status === "queued" || job.status === "running")
        ? 4000
        : false,
  });

  if (loading || (isLoading && businessId)) {
    return <div className="p-2 text-sm text-muted-foreground">Loading the SEO engine…</div>;
  }

  const brain = data?.brain;
  const counts = data?.counts;
  const measured = data?.measured ?? [];
  const jobs = data?.jobs ?? [];
  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "running");

  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Grow"
        title="SEO engine"
        subtitle="Pages are only generated where your Business Brain holds enough verified information to support them — your services, your locations, your actual expertise. Nothing publishes without passing review."
        actions={
          <Button asChild>
            <Link to="/app/seo/opportunities">Open opportunity queue</Link>
          </Button>
        }
      />

      {brain ? (
        <section>
          <SectionLabel aside={brain.ready ? "Grounded" : "Not ready"}>Brain readiness</SectionLabel>
          <div className="rounded-xl border border-border bg-card p-6 shadow-quiet">
            <p className="text-sm leading-relaxed text-foreground">{brain.reason}</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="eyebrow">Verified services ({brain.verifiedServices})</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {brain.services.length === 0 ? (
                    <span className="text-xs text-muted-foreground">None established yet.</span>
                  ) : (
                    brain.services.map((service) => (
                      <Badge key={service} variant="outline" className="rounded-full font-normal">
                        {service}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="eyebrow">Verified service areas ({brain.verifiedLocations})</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {brain.locations.length === 0 ? (
                    <span className="text-xs text-muted-foreground">None established yet.</span>
                  ) : (
                    brain.locations.map((location) => (
                      <Badge key={location} variant="outline" className="rounded-full font-normal">
                        {location}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeJobs.length > 0 ? (
        <section>
          <SectionLabel>Working</SectionLabel>
          <ul className="space-y-2">
            {activeJobs.map((job) => (
              <li key={job.id} className="rounded-xl border border-border bg-card p-4 text-sm shadow-quiet">
                <span className="text-foreground">{job.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{job.progress ?? job.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {counts ? (
        <section>
          <SectionLabel aside={`Quality gate threshold ${QUALITY_THRESHOLD}/100`}>Pipeline</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBlock
              label="Qualified opportunities"
              value={String(counts.qualified)}
              caption={`${counts.opportunities} discovered, ${counts.rejected} rejected as unsupportable.`}
            />
            <StatBlock
              label="Awaiting review"
              value={String(counts.draft + counts.review)}
              caption="Generated pages you have not yet approved."
            />
            <StatBlock
              label="Published"
              value={String(counts.published)}
              caption={`${counts.paused} paused, ${counts.archived} archived.`}
            />
            <StatBlock
              label="Below quality gate"
              value={String(counts.qualityFailures)}
              caption="Pages that cannot publish until they improve."
            />
          </div>
        </section>
      ) : null}

      <section>
        <SectionLabel aside="Deterministic, server-side">Quality gate</SectionLabel>
        <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {CHECK_LABELS.map((check) => (
            <li key={check} className="flex items-center justify-between gap-3 bg-card p-4 text-sm">
              <span className="text-foreground">{check}</span>
              <span className="text-xs text-muted-foreground">Required</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionLabel aside="Recorded, never estimated">Measured results</SectionLabel>
        {measured.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm leading-relaxed text-muted-foreground shadow-quiet">
            No page performance has been recorded yet. Business OS never invents search data — numbers appear
            here once you or a connected source records them against a published page.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {measured.map((row) => (
              <StatBlock
                key={`${row.metricKey}-${row.source}`}
                label={row.metricKey.replace(/_/g, " ")}
                value={row.total.toLocaleString()}
                caption={`Source: ${row.source}`}
              />
            ))}
          </div>
        )}
      </section>

      {counts && counts.opportunities === 0 ? (
        <EmptyState
          icon={Search}
          title="No SEO opportunities discovered yet"
          body="Keyword discovery runs against what you actually sell and where you sell it. Once your services and locations are verified, opportunities are clustered, scored and turned into pages you approve before anything publishes."
          primary={{ label: "Run discovery", to: "/app/seo/opportunities" }}
          secondary={{ label: "Continue Business Discovery", to: "/app/interview" }}
          note="Pages for your business and pages that market Business OS itself are kept in separate datasets and never mixed."
        />
      ) : null}
    </div>
  );
}
