import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, FileText } from "lucide-react";
import { useState } from "react";

import { EmptyState, PageHeader, SectionLabel } from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/use-workspace";
import { getSeoOverview } from "@/lib/seo.functions";
import { PAGE_STATUSES, PAGE_STATUS_LABELS, scoreTone, type SeoPageStatus } from "@/lib/seo-types";

export const Route = createFileRoute("/_authenticated/app/seo/library")({
  head: () => ({
    meta: [
      { title: "SEO Page Library — Business OS" },
      {
        name: "description",
        content:
          "Every generated page with its quality score, evidence and status — draft, in review, approved, published or paused.",
      },
      { property: "og:title", content: "SEO Page Library — Business OS" },
      {
        property: "og:description",
        content: "Review, approve and publish generated pages with full quality reporting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

const TONE = {
  good: "border-positive/40 text-positive",
  warn: "border-caution/50 text-caution-foreground",
  bad: "border-destructive/40 text-destructive",
} as const;

function LibraryPage() {
  const { activeBusiness, loading } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const fetchOverview = useServerFn(getSeoOverview);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SeoPageStatus | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["seo-overview", businessId, "customer"],
    queryFn: () => fetchOverview({ data: { businessId: businessId!, scope: "customer" } }),
    enabled: businessId !== null,
  });

  if (loading || (isLoading && businessId)) {
    return <div className="p-2 text-sm text-muted-foreground">Loading pages…</div>;
  }

  const pages = data?.pages ?? [];
  const term = search.trim().toLowerCase();
  const visible = pages.filter((page) => {
    if (status !== "all" && page.status !== status) return false;
    if (!term) return true;
    return [page.title ?? "", page.slug, page.keyword ?? ""].join(" ").toLowerCase().includes(term);
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Grow"
        title="Page library"
        subtitle="Nothing here is live until you approve it. Each page carries the quality report and the Business Brain facts it was written from."
      />

      {pages.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No pages generated yet"
          body="Approve an opportunity and Business OS will write a draft page from verified facts only, then hold it for your review."
          primary={{ label: "Open opportunity queue", to: "/app/seo/opportunities" }}
          secondary={{ label: "See the Business Brain", to: "/app/brain" }}
          note="Thin, duplicated or unsupported pages are blocked from publishing by the quality gate."
        />
      ) : (
        <section>
          <SectionLabel aside={`${visible.length} of ${pages.length} shown`}>Pages</SectionLabel>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search pages…"
              aria-label="Search pages"
              className="max-w-sm"
            />
            <Button size="sm" variant={status === "all" ? "default" : "outline"} onClick={() => setStatus("all")}>
              All
            </Button>
            {PAGE_STATUSES.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={status === option ? "default" : "outline"}
                onClick={() => setStatus(option)}
              >
                {PAGE_STATUS_LABELS[option]}
              </Button>
            ))}
          </div>

          <ul className="grid gap-4 lg:grid-cols-2">
            {visible.map((page) => (
              <li key={page.id}>
                <Link
                  to="/app/seo/pages/$pageId"
                  params={{ pageId: page.id }}
                  className="block rounded-xl border border-border bg-card p-5 shadow-quiet transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base text-foreground">{page.title ?? page.slug}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{page.path}</p>
                    </div>
                    <Badge variant="outline" className={`rounded-full ${TONE[scoreTone(page.qualityScore)]}`}>
                      {page.qualityScore ?? "—"}/100
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">
                      {PAGE_STATUS_LABELS[page.status]}
                    </Badge>
                    <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">
                      v{page.version}
                    </Badge>
                    <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">
                      {page.wordCount ?? 0} words
                    </Badge>
                    {page.indexable ? null : (
                      <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">
                        Not indexable
                      </Badge>
                    )}
                  </div>

                  <p className="mt-4 flex items-center gap-1.5 text-xs text-primary">
                    Review page <ArrowRight className="size-3" aria-hidden />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
