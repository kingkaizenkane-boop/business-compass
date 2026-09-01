import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Compass, Lock, Plus, Unlock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, SectionLabel } from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  discoverSeoOpportunities,
  generateSeoPages,
  getSeoOverview,
  proposeSeoOpportunity,
} from "@/lib/seo.functions";
import { OPPORTUNITY_STATUS_LABELS, scoreTone } from "@/lib/seo-types";

export const Route = createFileRoute("/_authenticated/app/seo/opportunities")({
  head: () => ({
    meta: [
      { title: "SEO Opportunities — Business OS" },
      {
        name: "description",
        content:
          "Scored keyword opportunities derived only from verified Business Brain facts, with the reason each one qualified or was rejected.",
      },
      { property: "og:title", content: "SEO Opportunities — Business OS" },
      {
        property: "og:description",
        content: "Deterministically scored keyword opportunities you approve before any page is written.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OpportunitiesPage,
});

const TONE = {
  good: "border-positive/40 text-positive",
  warn: "border-caution/50 text-caution-foreground",
  bad: "border-destructive/40 text-destructive",
} as const;

function OpportunitiesPage() {
  const { activeBusiness, loading } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const queryClient = useQueryClient();

  const fetchOverview = useServerFn(getSeoOverview);
  const discover = useServerFn(discoverSeoOpportunities);
  const propose = useServerFn(proposeSeoOpportunity);
  const generate = useServerFn(generateSeoPages);

  const [selected, setSelected] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<"qualified" | "all" | "rejected">("qualified");

  const queryKey = ["seo-overview", businessId, "customer"];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchOverview({ data: { businessId: businessId!, scope: "customer" } }),
    enabled: businessId !== null,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey });

  const runDiscovery = useMutation({
    mutationFn: () => discover({ data: { businessId: businessId! } }),
    onSuccess: (result) => {
      toast.success(
        result.created.length > 0
          ? `${result.created.length} new opportunit${result.created.length === 1 ? "y" : "ies"} qualified.`
          : "No new opportunities — the Brain does not yet support more than you already have.",
      );
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addKeyword = useMutation({
    mutationFn: () => propose({ data: { businessId: businessId!, keyword: keyword.trim() } }),
    onSuccess: (result) => {
      if (result.rejected) toast.error(result.reason || "The Business Brain cannot support that keyword.");
      else toast.success("Opportunity added.");
      setKeyword("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const queueGeneration = useMutation({
    mutationFn: () => generate({ data: { businessId: businessId!, opportunityIds: selected } }),
    onSuccess: () => {
      toast.success("Generation queued. Pages arrive as drafts for your review.");
      setSelected([]);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading || (isLoading && businessId)) {
    return <div className="p-2 text-sm text-muted-foreground">Loading opportunities…</div>;
  }

  const all = data?.opportunities ?? [];
  const visible =
    filter === "all" ? all : all.filter((o) => (filter === "qualified" ? o.status === "qualified" : o.status === "rejected"));

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(0, 10)));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Grow"
        title="Opportunity queue"
        subtitle="Each opportunity is scored on business fit, search intent, content value and competition. Nothing here was invented — a keyword only qualifies when your Brain can support a real page about it."
        actions={
          businessId ? (
            <Button onClick={() => runDiscovery.mutate()} disabled={runDiscovery.isPending}>
              <Compass className="mr-1.5 size-4" aria-hidden />
              {runDiscovery.isPending ? "Discovering…" : "Run discovery"}
            </Button>
          ) : null
        }
      />

      {businessId ? (
        <section className="rounded-xl border border-border bg-card p-5 shadow-quiet">
          <SectionLabel>Propose a keyword</SectionLabel>
          <div className="flex flex-wrap gap-2">
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="e.g. emergency plumber in Leeds"
              aria-label="Keyword"
              className="max-w-sm"
            />
            <Button
              variant="outline"
              onClick={() => addKeyword.mutate()}
              disabled={keyword.trim().length < 3 || addKeyword.isPending}
            >
              <Plus className="mr-1.5 size-4" aria-hidden />
              Add
            </Button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Keywords your Business Brain cannot substantiate are rejected with a reason rather than written badly.
          </p>
        </section>
      ) : null}

      {data?.blockers?.length ? (
        <section>
          <SectionLabel aside={`${data.blockers.filter((b) => b.state === "ready").length}/${data.blockers.length} unlocked`}>
            What is unlocked, and what is not
          </SectionLabel>
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.blockers.map((blocker) => (
              <li
                key={blocker.key}
                className={`rounded-xl border p-4 shadow-quiet ${
                  blocker.state === "ready" ? "border-border bg-card" : "border-caution/40 bg-caution/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  {blocker.state === "ready" ? (
                    <Unlock className="size-4 text-positive" aria-hidden />
                  ) : (
                    <Lock className="size-4 text-caution-foreground" aria-hidden />
                  )}
                  <p className="text-sm text-foreground">{blocker.label}</p>
                  <Badge variant="outline" className="ml-auto rounded-full font-normal text-muted-foreground">
                    {blocker.state === "ready" ? "Available" : "Locked"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{blocker.detail}</p>
                {blocker.state === "blocked" ? (
                  <>
                    <p className="mt-2 text-xs leading-relaxed text-foreground">
                      <span className="text-muted-foreground">To unlock: </span>
                      {blocker.unlock}
                    </p>
                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <Link to={blocker.to}>Go there</Link>
                    </Button>
                  </>
                ) : blocker.examples.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Example searches: {blocker.examples.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {all.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="No opportunities yet"
          body="Run discovery once your services and service areas are verified. Business OS derives keywords from what you actually sell and where you sell it."
          primary={{ label: "Continue Business Discovery", to: "/app/interview" }}
          secondary={{ label: "See the Business Brain", to: "/app/brain" }}
          note="Nothing on this page is estimated search data — scores are computed from your own business context."
        />
      ) : (
        <section>
          <SectionLabel aside={`${visible.length} shown`}>Opportunities</SectionLabel>
          <div className="mb-4 flex flex-wrap gap-2">
            {(["qualified", "rejected", "all"] as const).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={filter === option ? "default" : "outline"}
                onClick={() => setFilter(option)}
              >
                {option === "all" ? "All" : OPPORTUNITY_STATUS_LABELS[option]}
              </Button>
            ))}
            {selected.length > 0 ? (
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => queueGeneration.mutate()}
                disabled={queueGeneration.isPending}
              >
                {queueGeneration.isPending ? "Queueing…" : `Generate ${selected.length} page${selected.length === 1 ? "" : "s"}`}
              </Button>
            ) : null}
          </div>

          <ul className="space-y-3">
            {visible.map((opportunity) => (
              <li key={opportunity.id} className="rounded-xl border border-border bg-card p-5 shadow-quiet">
                <div className="flex items-start gap-4">
                  {opportunity.status === "qualified" && !opportunity.pageId ? (
                    <Checkbox
                      checked={selected.includes(opportunity.id)}
                      onCheckedChange={() => toggle(opportunity.id)}
                      aria-label={`Select ${opportunity.keyword}`}
                      className="mt-1"
                    />
                  ) : (
                    <span className="mt-1 size-4" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base text-foreground">{opportunity.keyword}</p>
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
                      {[opportunity.intent, opportunity.service, opportunity.location, opportunity.recommendedPageType]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {opportunity.reason ? (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{opportunity.reason}</p>
                    ) : null}
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                      <Score label="Business fit" value={opportunity.businessFitScore} />
                      <Score label="Relevance" value={opportunity.relevanceScore} />
                      <Score label="Content value" value={opportunity.contentValueScore} />
                      <Score label="Competition" value={opportunity.competitionScore} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="numeric mt-1 text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}
