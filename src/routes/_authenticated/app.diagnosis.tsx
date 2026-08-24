import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, CheckCircle2, HelpCircle, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, MeterRow, PageHeader, SectionLabel, StatBlock } from "@/components/business-os/primitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWorkspace } from "@/hooks/use-workspace";
import { enqueueEngineRun } from "@/lib/jobs.functions";
import { getLatestDiagnosis, runDiagnosis } from "@/lib/diagnosis.functions";

export const Route = createFileRoute("/_authenticated/app/diagnosis")({
  head: () => ({
    meta: [
      { title: "Business Diagnosis — Business OS" },
      {
        name: "description",
        content:
          "Your highest-impact constraints and opportunities, derived from the Business Brain with the evidence behind every score.",
      },
      { property: "og:title", content: "Business Diagnosis — Business OS" },
      {
        property: "og:description",
        content: "Scored constraints and ranked opportunities, with the Brain facts behind each score.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiagnosisPage,
});

type ItemView = Awaited<ReturnType<typeof getLatestDiagnosis>>["items"][number];

const QUALITY_LABEL: Record<string, string> = {
  verified: "Verified",
  stated: "Known",
  claimed: "Claimed",
  inferred: "Inferred",
  assumed: "Assumption",
};

function DiagnosisPage() {
  const { activeBusiness } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const fetchDiagnosis = useServerFn(getLatestDiagnosis);
  const run = useServerFn(runDiagnosis);
  const queryClient = useQueryClient();
  const enqueue = useServerFn(enqueueEngineRun);
  const [evidenceItem, setEvidenceItem] = useState<ItemView | null>(null);

  const query = useQuery({
    queryKey: ["diagnosis", businessId],
    queryFn: () => fetchDiagnosis({ data: { businessId: businessId! } }),
    enabled: businessId !== null,
  });

  const mutation = useMutation({
    mutationFn: () => enqueue({ data: { businessId: businessId!, jobType: "diagnosis_run" } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["ai-jobs", businessId] });
      if (result.blocked) toast.error(result.reason ?? "AI work is paused for this organization.");
      else toast.success("Diagnosis queued — this runs in the background");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "The diagnosis could not be queued"),
  });

  const data = query.data;
  const readiness = data?.readiness ?? null;
  const items = data?.items ?? [];
  const constraints = items.filter((i) => i.kind === "constraint");
  const opportunities = items.filter((i) => i.kind === "opportunity");
  const strengths = items.filter((i) => i.kind === "strength");
  const gaps = items.filter((i) => i.kind === "information_gap");
  const contradictions = items.filter((i) => i.kind === "contradiction");

  const runButton = (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={businessId === null || mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Diagnosing…
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> {data?.status === "ready" ? "Run new diagnosis" : "Run diagnosis"}
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Run a new diagnosis?</AlertDialogTitle>
          <AlertDialogDescription>
            This will create a new diagnosis using the latest Business Brain. Your previous diagnosis will
            remain available for comparison — nothing is deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => mutation.mutate()}>Run diagnosis</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Diagnosis"
        title="Your Business Diagnosis"
        subtitle="Derived only from your Business Brain. Every constraint carries its evidence, its confidence and the reasoning behind it — nothing is scored without facts."
        actions={runButton}
      />

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your latest diagnosis…</p>
      ) : null}

      {data?.status === "insufficient" || data?.status === "empty" ? (
        <div className="space-y-6">
          <section className="grid gap-5 rounded-xl border border-border bg-card p-6 shadow-quiet sm:grid-cols-2">
            <MeterRow label="Brain coverage" value={readiness?.coverage ?? null} hint="Needed before a reliable diagnosis." />
            <MeterRow
              label="Verified facts"
              value={
                readiness && readiness.factCount > 0
                  ? Math.round((readiness.verifiedCount / readiness.factCount) * 100)
                  : null
              }
            />
          </section>

          {readiness && readiness.missingCategories.length > 0 ? (
            <section>
              <SectionLabel aside="Recommended interview sections">Brain areas with no facts</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {readiness.missingCategories.map((c) => (
                  <Badge key={c} variant="outline" className="rounded-full capitalize">
                    {c.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          {readiness && readiness.missingMetrics.length > 0 ? (
            <section>
              <SectionLabel>Numbers the Brain still needs</SectionLabel>
              <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
                {readiness.missingMetrics.map((m) => (
                  <li key={m} className="flex items-baseline justify-between gap-4 bg-card p-4 text-sm">
                    <span className="text-foreground">{m}</span>
                    <span className="text-xs text-muted-foreground">Unknown</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <EmptyState
            icon={Activity}
            title={
              data.status === "insufficient"
                ? "Your Business Brain isn't complete enough yet"
                : "No diagnosis has been run yet"
            }
            body={
              data.status === "insufficient"
                ? "A diagnosis is only as honest as the information behind it. Continue the interview so the Brain holds facts across identity, offers, customers, marketing, sales, operations and economics — then Business OS can score your constraints with real evidence."
                : "Your Brain has enough coverage. Run a diagnosis to score each area and rank your constraints by impact, urgency and confidence."
            }
            primary={{ label: "Continue interview", to: "/app/interview" }}
            secondary={{ label: "Review the Brain", to: "/app/brain" }}
            note="Business OS never fabricates numbers. Unknowns stay unknown until you confirm them."
          />
        </div>
      ) : null}

      {data?.status === "ready" && data.run ? (
        <>
          <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="rounded-xl border border-border bg-card p-6 shadow-quiet">
              <p className="eyebrow">Business health</p>
              <p className="numeric mt-4 text-5xl text-foreground">
                {data.run.overallScore ?? "—"}
                <span className="text-xl text-muted-foreground"> / 100</span>
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Composite of the constraints found in your Brain. Diagnosis confidence{" "}
                <span className="numeric">{data.run.confidenceScore ?? "—"}%</span>, based on{" "}
                {readiness?.factCount ?? 0} active facts ({readiness?.verifiedCount ?? 0} verified).
              </p>
              <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
                Run {new Date(data.run.createdAt).toLocaleString()} · {data.history.length} run
                {data.history.length === 1 ? "" : "s"} kept for comparison
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 shadow-quiet">
              <p className="eyebrow">Executive diagnosis</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
                {data.run.summary ?? "—"}
              </p>
            </div>
          </section>

          <section>
            <SectionLabel aside="Higher is healthier; blank means no evidence yet">Category health</SectionLabel>
            <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {data.run.categoryScores.map((c) => (
                <div key={c.category} className="bg-card p-5">
                  <p className="text-sm text-foreground">{c.label}</p>
                  <p className="numeric mt-2 text-2xl text-foreground">{c.score ?? "—"}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionLabel aside={`${constraints.length} found`}>Top constraints</SectionLabel>
            <div className="space-y-4">
              {constraints.slice(0, 3).map((item) => (
                <ItemCard key={item.id} item={item} onEvidence={setEvidenceItem} />
              ))}
              {constraints.slice(3).map((item) => (
                <ItemCard key={item.id} item={item} onEvidence={setEvidenceItem} compact />
              ))}
            </div>
          </section>

          {opportunities.length > 0 ? (
            <section>
              <SectionLabel aside="Ranked by server-calculated priority">Opportunities</SectionLabel>
              <div className="space-y-4">
                {opportunities.map((item) => (
                  <ItemCard key={item.id} item={item} onEvidence={setEvidenceItem} compact />
                ))}
              </div>
            </section>
          ) : null}

          {contradictions.length > 0 ? (
            <section>
              <SectionLabel aside="Needs verification">Conflicts detected</SectionLabel>
              <div className="space-y-3">
                {contradictions.map((item) => (
                  <div key={item.id} className="rounded-xl border border-destructive/30 bg-card p-5 shadow-quiet">
                    <p className="flex items-center gap-2 text-sm text-foreground">
                      <AlertTriangle className="size-4 text-destructive" aria-hidden />
                      {item.description}
                    </p>
                    {item.resolutionQuestion ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        To resolve: {item.resolutionQuestion}
                      </p>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 px-0 text-xs"
                      onClick={() => setEvidenceItem(item)}
                    >
                      See the conflicting facts
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {strengths.length > 0 ? (
            <section>
              <SectionLabel>Strengths</SectionLabel>
              <div className="grid gap-4 md:grid-cols-2">
                {strengths.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-card p-5 shadow-quiet">
                    <p className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="size-4 text-positive" aria-hidden />
                      {item.title}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 px-0 text-xs"
                      onClick={() => setEvidenceItem(item)}
                    >
                      Why did Business OS say this?
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {gaps.length > 0 ? (
            <section>
              <SectionLabel aside="Unknown — never estimated">Information gaps</SectionLabel>
              <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
                {gaps.map((gap) => (
                  <li key={gap.id} className="bg-card p-5">
                    <p className="flex items-start gap-2 text-sm text-foreground">
                      <HelpCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {gap.title}
                    </p>
                    {gap.description ? (
                      <p className="mt-1.5 pl-6 text-xs leading-relaxed text-muted-foreground">
                        {gap.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.history.length > 1 ? (
            <section>
              <SectionLabel>Diagnosis history</SectionLabel>
              <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
                {data.history.map((h) => (
                  <li key={h.id} className="flex items-baseline justify-between gap-4 bg-card p-4 text-sm">
                    <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</span>
                    <span className="numeric text-foreground">{h.overallScore ?? "—"} / 100</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      <EvidenceDrawer item={evidenceItem} onClose={() => setEvidenceItem(null)} />
    </div>
  );
}

function ItemCard({
  item,
  onEvidence,
  compact = false,
}: {
  item: ItemView;
  onEvidence: (item: ItemView) => void;
  compact?: boolean;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-6 shadow-quiet">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="rounded-full">
          {item.categoryLabel}
        </Badge>
        {item.priorityLevel ? (
          <Badge variant="outline" className="rounded-full capitalize text-muted-foreground">
            {item.priorityLevel} priority
          </Badge>
        ) : null}
        <span className="numeric ml-auto text-sm text-muted-foreground">Priority {item.priority ?? "—"}</span>
      </div>

      <h3 className="mt-4 text-xl text-foreground">{item.title}</h3>
      {item.description ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
      ) : null}

      {!compact && item.rootCause ? (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <p className="eyebrow">Root cause</p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">{item.rootCause}</p>
        </div>
      ) : null}

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
        {(
          [
            ["Impact", item.impact],
            ["Urgency", item.urgency],
            ["Confidence", item.confidence],
            ["Effort", item.effort],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="eyebrow">{label}</dt>
            <dd className="numeric mt-1 text-lg text-foreground">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>

      {item.recommendation ? (
        <p className="mt-4 text-sm leading-relaxed text-foreground">
          <span className="eyebrow mr-2">Recommended direction</span>
          {item.recommendation}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">
          {item.evidence.length} supporting fact{item.evidence.length === 1 ? "" : "s"}
        </span>
        <Button variant="outline" size="sm" onClick={() => onEvidence(item)}>
          Why did Business OS say this?
        </Button>
      </div>
    </article>
  );
}

function EvidenceDrawer({ item, onClose }: { item: ItemView | null; onClose: () => void }) {
  return (
    <Sheet open={item !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{item?.title ?? "Evidence"}</SheetTitle>
          <SheetDescription>
            Business OS produced this from the Brain facts below. Nothing outside your Brain was used.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          {item?.rootCause ? (
            <div>
              <p className="eyebrow">Root cause</p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">{item.rootCause}</p>
            </div>
          ) : null}

          <div>
            <p className="eyebrow">Supporting facts</p>
            <ul className="mt-3 space-y-3">
              {(item?.evidence ?? []).map((fact) => (
                <li key={fact.factId} className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center gap-2">
                    {fact.verified ? (
                      <CheckCircle2 className="size-4 text-positive" aria-hidden />
                    ) : (
                      <HelpCircle className="size-4 text-muted-foreground" aria-hidden />
                    )}
                    <span className="text-sm text-foreground">{fact.factKey.replace(/_/g, " ")}</span>
                    <Badge variant="outline" className="ml-auto rounded-full text-[0.7rem]">
                      {QUALITY_LABEL[fact.quality] ?? fact.quality}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{fact.value}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {fact.category} · {fact.factType} · fact confidence{" "}
                    <span className="numeric">{Math.round(fact.confidence * 100)}%</span>
                  </p>
                </li>
              ))}
              {(item?.evidence ?? []).length === 0 ? (
                <li className="text-sm text-muted-foreground">No Brain facts are attached to this item.</li>
              ) : null}
            </ul>
          </div>

          {item?.evidenceNote ? <p className="text-xs text-muted-foreground">{item.evidenceNote}</p> : null}
          {item?.resolutionQuestion ? (
            <div>
              <p className="eyebrow">Resolution question</p>
              <p className="mt-1.5 text-sm text-foreground">{item.resolutionQuestion}</p>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
