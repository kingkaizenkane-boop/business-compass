import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileText, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, MeterRow, PageHeader, SectionLabel } from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWorkspace } from "@/hooks/use-workspace";
import { getBlueprint, runBlueprint } from "@/lib/blueprint.functions";

export const Route = createFileRoute("/_authenticated/app/blueprint")({
  head: () => ({
    meta: [
      { title: "Business Blueprint — Business OS" },
      {
        name: "description",
        content:
          "Your positioning, ideal customer, offer, pricing, acquisition, retention and operating model as one strategic document.",
      },
      { property: "og:title", content: "Business Blueprint — Business OS" },
      {
        property: "og:description",
        content: "Positioning, offer, acquisition, retention and operating model in one document.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlueprintPage,
});

type SectionView = NonNullable<
  Awaited<ReturnType<typeof getBlueprint>> extends { blueprint: infer B }
    ? B extends { sections: (infer S)[] }
      ? S
      : never
    : never
>;

function BlueprintPage() {
  const { activeBusiness, loading } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;

  const fetchBlueprint = useServerFn(getBlueprint);
  const generate = useServerFn(runBlueprint);
  const queryClient = useQueryClient();
  const [openSection, setOpenSection] = useState<SectionView | null>(null);

  const query = useQuery({
    queryKey: ["blueprint", businessId],
    queryFn: () => fetchBlueprint({ data: { businessId: businessId! } }),
    enabled: businessId !== null,
  });

  const mutation = useMutation({
    mutationFn: () => generate({ data: { businessId: businessId! } }),
    onSuccess: (result) => {
      queryClient.setQueryData(["blueprint", businessId], result);
      if (result.status === "ready") {
        toast.success(`Blueprint v${result.blueprint.version} generated from your Brain`);
      } else {
        toast.message("Your Brain needs more coverage before a blueprint can be written.");
      }
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "The blueprint could not be generated."),
  });

  if (loading || (businessId && query.isLoading)) {
    return <p className="text-sm text-muted-foreground">Loading your blueprint…</p>;
  }

  if (!activeBusiness) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader
          eyebrow="Strategy"
          title="Create a business first."
          subtitle="The blueprint is written for a specific business."
        />
        <Button asChild>
          <a href="/business/new">Create a business</a>
        </Button>
      </div>
    );
  }

  if (query.error) {
    return (
      <p className="text-sm text-destructive">
        {query.error instanceof Error ? query.error.message : "Could not load the blueprint."}
      </p>
    );
  }

  const data = query.data;
  const readiness = data?.readiness;

  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Strategy"
        title="Your Business Blueprint"
        subtitle="A working strategic document, not a business plan template. It is generated from your Business Brain and your latest diagnosis, and versioned every time it changes."
      />

      {data?.status !== "ready" ? (
        <>
          {readiness ? (
            <section className="rounded-xl border border-border bg-card p-6 shadow-quiet">
              <SectionLabel aside={`${readiness.coverage}% coverage`}>Brain readiness</SectionLabel>
              <div className="space-y-3">
                <MeterRow label="Facts in your Brain" value={readiness.factCount} max={45} />
                <MeterRow label="Verified facts" value={readiness.verifiedCount} max={Math.max(1, readiness.factCount)} />
              </div>
              {readiness.missingCategories.length > 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  No facts yet in: {readiness.missingCategories.join(", ")}
                </p>
              ) : null}
            </section>
          ) : null}

          {data?.status === "insufficient" ? (
            <EmptyState
              icon={FileText}
              title="Not enough of your business is mapped yet"
              body="Business OS writes the blueprint from what it actually knows about your customers, your offer and your operating constraints. Add more Brain coverage through the interview first."
              primary={{ label: "Continue the interview", to: "/app/interview" }}
              secondary={{ label: "Review your Brain", to: "/app/brain" }}
            />
          ) : (
            <section className="rounded-xl border border-border bg-card p-8 text-center shadow-quiet">
              <h2 className="text-xl text-foreground">Your blueprint hasn't been written yet</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Your Brain has enough coverage. Business OS will draft each section from your facts
                {data?.hasDiagnosis ? " and your latest diagnosis" : ""}, and show the evidence behind every
                strategic call.
              </p>
              <Button
                className="mt-6"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                <Sparkles className="size-4" aria-hidden />
                {mutation.isPending ? "Writing your blueprint…" : "Generate blueprint"}
              </Button>
              {!data?.hasDiagnosis ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Tip: run a diagnosis first so the blueprint answers your real constraints.
                </p>
              ) : null}
            </section>
          )}
        </>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-6 shadow-quiet md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <SectionLabel>Executive summary</SectionLabel>
                <p className="max-w-3xl text-base leading-relaxed text-foreground">
                  {data.blueprint.executiveSummary}
                </p>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="rounded-full">
                  Version {data.blueprint.version} · {data.blueprint.status}
                </Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  {data.blueprint.confidence != null
                    ? `${data.blueprint.confidence}% evidence confidence`
                    : "Confidence unavailable"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                >
                  <RefreshCw className="size-4" aria-hidden />
                  {mutation.isPending ? "Regenerating…" : "Regenerate"}
                </Button>
              </div>
            </div>
          </section>

          <section>
            <SectionLabel aside="Tap a section to see the evidence behind it">Sections</SectionLabel>
            <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              {data.blueprint.sections.map((section, i) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setOpenSection(section as SectionView)}
                  className="bg-card p-5 text-left transition-colors hover:bg-surface"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-3">
                      <span className="numeric text-xs text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-medium text-foreground">{section.label}</span>
                    </div>
                    <span className="numeric text-xs text-muted-foreground">
                      {section.confidence != null ? `${section.confidence}%` : "—"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {section.content ?? "Not written yet"}
                  </p>
                  {section.confidence != null ? (
                    <Progress value={section.confidence} className="mt-3 h-1" />
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          {data.blueprint.priorities.length > 0 ? (
            <section>
              <SectionLabel>Strategic priorities</SectionLabel>
              <ol className="space-y-3">
                {data.blueprint.priorities.map((priority, i) => (
                  <li key={`${priority.title}-${i}`} className="rounded-xl border border-border bg-card p-5">
                    <p className="text-sm font-medium text-foreground">{priority.title}</p>
                    {priority.whyNow ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{priority.whyNow}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {data.blueprint.openQuestions.length > 0 ? (
            <section className="rounded-xl border border-dashed border-border bg-surface p-6">
              <SectionLabel aside={`${data.blueprint.openQuestions.length} items`}>
                Still unknown
              </SectionLabel>
              <ul className="space-y-2 text-sm text-foreground">
                {data.blueprint.openQuestions.map((question) => (
                  <li key={question} className="flex items-start gap-2">
                    <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.history.length > 1 ? (
            <section>
              <SectionLabel>Version history</SectionLabel>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {data.history.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between p-4 text-sm">
                    <span className="text-foreground">Version {entry.version}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString()} · {entry.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <Sheet open={openSection !== null} onOpenChange={(open) => !open && setOpenSection(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {openSection ? (
            <>
              <SheetHeader>
                <SheetTitle>{openSection.label}</SheetTitle>
                <SheetDescription>Why did Business OS say this?</SheetDescription>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-8">
                <p className="text-sm leading-relaxed text-foreground">{openSection.content}</p>
                {openSection.rationale ? (
                  <div>
                    <SectionLabel>Reasoning</SectionLabel>
                    <p className="text-sm leading-relaxed text-muted-foreground">{openSection.rationale}</p>
                  </div>
                ) : null}
                <div>
                  <SectionLabel aside={`${openSection.facts.length} facts`}>Brain evidence</SectionLabel>
                  {openSection.facts.length > 0 ? (
                    <ul className="space-y-2">
                      {openSection.facts.map((fact) => (
                        <li key={fact.factId} className="rounded-lg border border-border p-3 text-sm">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-foreground">{fact.factKey.replace(/_/g, " ")}</span>
                            <Badge variant="outline" className="rounded-full text-xs">
                              {fact.verified ? "Verified" : fact.factType}
                            </Badge>
                          </div>
                          <p className="mt-1 text-muted-foreground">{fact.value}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No Brain fact supports this section directly — it rests on the assumptions below.
                    </p>
                  )}
                </div>
                {openSection.assumptions.length > 0 ? (
                  <div>
                    <SectionLabel>Assumptions</SectionLabel>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {openSection.assumptions.map((assumption) => (
                        <li key={assumption}>{assumption}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
