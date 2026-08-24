import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ClipboardList, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AutonomyBadge,
  EmptyState,
  MeterRow,
  PageHeader,
  SectionLabel,
} from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useWorkspace } from "@/hooks/use-workspace";
import { getActionPlan, runActionPlan, updateActionState } from "@/lib/action-plan.functions";

export const Route = createFileRoute("/_authenticated/app/action-plan")({
  head: () => ({
    meta: [
      { title: "90-Day Action Plan — Business OS" },
      {
        name: "description",
        content:
          "Your diagnosis and blueprint converted into sequenced actions across the next 90 days, each with impact, effort, owner and evidence.",
      },
      { property: "og:title", content: "90-Day Action Plan — Business OS" },
      {
        property: "og:description",
        content: "Sequenced actions for the next 90 days with impact, effort, owner and evidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActionPlanPage,
});

const HORIZONS = [
  { id: "now", label: "Now", range: "Days 1–30", note: "Constraint removal and quick structural wins." },
  { id: "next", label: "Next", range: "Days 31–60", note: "Systems, automation and offer changes." },
  { id: "later", label: "Later", range: "Days 61–90", note: "Growth moves that depend on earlier work." },
] as const;

type ActionRow = {
  id: string;
  title: string;
  horizon: string;
  status: string;
  priority: string;
  approved: boolean;
  outcome: string;
  why: string;
  firstSteps: string[];
  impact: number | null;
  effort: number | null;
  score: number | null;
  owner: string;
  successMetric: string;
  dueAt: string | null;
  diagnosisTitles: string[];
  facts: {
    factId: string;
    factKey: string;
    category: string;
    value: string;
    factType: string;
    verified: boolean;
  }[];
};

const STATUS_LABEL: Record<string, string> = {
  todo: "Ready",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Done",
  cancelled: "Retired",
};

function ActionPlanPage() {
  const { activeBusiness, loading } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;

  const fetchPlan = useServerFn(getActionPlan);
  const generate = useServerFn(runActionPlan);
  const setState = useServerFn(updateActionState);
  const queryClient = useQueryClient();
  const [openAction, setOpenAction] = useState<ActionRow | null>(null);

  const query = useQuery({
    queryKey: ["action-plan", businessId],
    queryFn: () => fetchPlan({ data: { businessId: businessId! } }),
    enabled: businessId !== null,
  });

  const mutation = useMutation({
    mutationFn: () => generate({ data: { businessId: businessId! } }),
    onSuccess: (result) => {
      queryClient.setQueryData(["action-plan", businessId], result);
      if (result.status === "ready") {
        toast.success(`Action plan v${result.planVersion} generated from your diagnosis`);
      } else {
        toast.message("Your Brain needs more coverage before a plan can be sequenced.");
      }
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "The action plan could not be generated."),
  });

  const stateMutation = useMutation({
    mutationFn: (input: { taskId: string; status?: string; approved?: boolean }) =>
      setState({
        data: {
          businessId: businessId!,
          taskId: input.taskId,
          ...(input.status ? { status: input.status as "todo" } : {}),
          ...(input.approved !== undefined ? { approved: input.approved } : {}),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["action-plan", businessId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "That action could not be updated."),
  });

  if (loading || (businessId && query.isLoading)) {
    return <p className="text-sm text-muted-foreground">Loading your action plan…</p>;
  }

  if (!activeBusiness) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader
          eyebrow="Execution"
          title="Create a business first."
          subtitle="The action plan is sequenced for a specific business."
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
        {query.error instanceof Error ? query.error.message : "Could not load the action plan."}
      </p>
    );
  }

  const data = query.data;
  const readiness = data?.readiness;
  const actions = (data?.actions ?? []) as ActionRow[];
  const done = actions.filter((a) => a.status === "completed").length;

  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Execution"
        title="Your 90-day action plan"
        subtitle="Every action traces back to a diagnosed constraint and carries an expected impact, an effort estimate, an owner and a due date. Nothing changes in your business without your approval."
        actions={
          data?.status === "ready" ? (
            <Button variant="outline" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              <RefreshCw className="size-4" aria-hidden />
              {mutation.isPending ? "Regenerating…" : "Regenerate plan"}
            </Button>
          ) : null
        }
      />

      {data?.status !== "ready" ? (
        <>
          {readiness ? (
            <section className="rounded-xl border border-border bg-card p-6 shadow-quiet">
              <SectionLabel aside={`${readiness.coverage}% coverage`}>Brain readiness</SectionLabel>
              <div className="space-y-3">
                <MeterRow
                  label="Brain coverage"
                  value={readiness.coverage}
                  hint={`${readiness.factCount} active facts`}
                />
                <MeterRow
                  label="Verified facts"
                  value={Math.round(
                    (readiness.verifiedCount / Math.max(1, readiness.factCount)) * 100,
                  )}
                  hint={`${readiness.verifiedCount} of ${readiness.factCount} verified`}
                />
              </div>
            </section>
          ) : null}

          {data?.status === "insufficient" ? (
            <EmptyState
              icon={ClipboardList}
              title="Not enough of your business is mapped yet"
              body="The action plan is generated from your Business Brain, your diagnosis and your blueprint. Add more coverage through the interview first."
              primary={{ label: "Continue the interview", to: "/app/interview" }}
              secondary={{ label: "See the diagnosis", to: "/app/diagnosis" }}
            />
          ) : (
            <section className="rounded-xl border border-border bg-card p-8 text-center shadow-quiet">
              <h2 className="text-xl text-foreground">No plan sequenced yet</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Business OS will convert your diagnosis
                {data?.hasBlueprint ? " and blueprint" : ""} into sequenced work across Now, Next and
                Later — each action with its impact, effort, owner, success metric and the Brain facts
                behind it.
              </p>
              <Button className="mt-6" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                <Sparkles className="size-4" aria-hidden />
                {mutation.isPending ? "Sequencing your plan…" : "Generate action plan"}
              </Button>
              {!data?.hasDiagnosis ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Tip: run a diagnosis first so the plan attacks your real constraints.
                </p>
              ) : null}
            </section>
          )}
        </>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-6 shadow-quiet md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <SectionLabel>Plan summary</SectionLabel>
                <p className="text-base leading-relaxed text-foreground">{data.summary}</p>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="rounded-full">
                  Version {data.planVersion}
                </Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  {done} of {actions.length} actions done
                </p>
                <Progress
                  value={Math.round((done / Math.max(1, actions.length)) * 100)}
                  className="mt-3 h-1 w-40"
                />
              </div>
            </div>
          </section>

          <section>
            <SectionLabel aside="Tap an action to see the evidence behind it">Horizons</SectionLabel>
            <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-3">
              {HORIZONS.map((horizon) => {
                const items = actions.filter((a) => a.horizon === horizon.id);
                return (
                  <div key={horizon.id} className="bg-card p-6">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-lg text-foreground">{horizon.label}</h2>
                      <span className="numeric text-xs text-muted-foreground">{horizon.range}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {horizon.note}
                    </p>
                    <ul className="mt-5 space-y-3">
                      {items.length === 0 ? (
                        <li className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                          Nothing sequenced here
                        </li>
                      ) : (
                        items.map((action) => (
                          <li key={action.id} className="rounded-lg border border-border p-4">
                            <button
                              type="button"
                              onClick={() => setOpenAction(action)}
                              className="w-full text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-sm font-medium text-foreground">
                                  {action.title}
                                </span>
                                <span className="numeric text-xs text-muted-foreground">
                                  {action.score != null ? action.score : "—"}
                                </span>
                              </div>
                              {action.outcome ? (
                                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                  {action.outcome}
                                </p>
                              ) : null}
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="rounded-full text-xs">
                                  {STATUS_LABEL[action.status] ?? action.status}
                                </Badge>
                                <Badge variant="outline" className="rounded-full text-xs">
                                  Impact {action.impact ?? "—"} · Effort {action.effort ?? "—"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{action.owner}</span>
                              </div>
                            </button>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {!action.approved ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={stateMutation.isPending}
                                  onClick={() =>
                                    stateMutation.mutate({ taskId: action.id, approved: true })
                                  }
                                >
                                  Approve
                                </Button>
                              ) : action.status === "todo" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={stateMutation.isPending}
                                  onClick={() =>
                                    stateMutation.mutate({
                                      taskId: action.id,
                                      status: "in_progress",
                                    })
                                  }
                                >
                                  Start
                                </Button>
                              ) : null}
                              {action.status !== "completed" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={stateMutation.isPending}
                                  onClick={() =>
                                    stateMutation.mutate({ taskId: action.id, status: "completed" })
                                  }
                                >
                                  <CheckCircle2 className="size-4" aria-hidden />
                                  Done
                                </Button>
                              ) : (
                                <span className="text-xs text-positive">Completed</span>
                              )}
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section className="rounded-xl border border-dashed border-border bg-surface p-6">
        <SectionLabel>Autonomy</SectionLabel>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Every automated action states how much freedom it has. You can raise or lower these where
          policy allows.
        </p>
        <ul className="mt-4 flex flex-wrap gap-4">
          <li className="flex items-center gap-2 text-xs text-muted-foreground">
            Customer reminders <AutonomyBadge level={4} />
          </li>
          <li className="flex items-center gap-2 text-xs text-muted-foreground">
            Pricing changes <AutonomyBadge level={3} />
          </li>
          <li className="flex items-center gap-2 text-xs text-muted-foreground">
            Action planning <AutonomyBadge level={1} />
          </li>
        </ul>
      </section>

      <Sheet open={openAction !== null} onOpenChange={(open) => !open && setOpenAction(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {openAction ? (
            <>
              <SheetHeader>
                <SheetTitle>{openAction.title}</SheetTitle>
                <SheetDescription>Why did Business OS plan this?</SheetDescription>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-8">
                {openAction.outcome ? (
                  <p className="text-sm leading-relaxed text-foreground">{openAction.outcome}</p>
                ) : null}
                {openAction.why ? (
                  <div>
                    <SectionLabel>Why now</SectionLabel>
                    <p className="text-sm leading-relaxed text-muted-foreground">{openAction.why}</p>
                  </div>
                ) : null}
                {openAction.firstSteps.length > 0 ? (
                  <div>
                    <SectionLabel>First steps</SectionLabel>
                    <ol className="space-y-2 text-sm text-foreground">
                      {openAction.firstSteps.map((step, i) => (
                        <li key={step} className="flex gap-3">
                          <span className="numeric text-xs text-muted-foreground">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="eyebrow">Owner</p>
                    <p className="mt-1 text-foreground">{openAction.owner}</p>
                  </div>
                  <div>
                    <p className="eyebrow">Due</p>
                    <p className="mt-1 text-foreground">
                      {openAction.dueAt ? new Date(openAction.dueAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="eyebrow">Priority score</p>
                    <p className="numeric mt-1 text-foreground">{openAction.score ?? "—"}</p>
                  </div>
                  <div>
                    <p className="eyebrow">Impact / effort</p>
                    <p className="numeric mt-1 text-foreground">
                      {openAction.impact ?? "—"} / {openAction.effort ?? "—"}
                    </p>
                  </div>
                </div>
                {openAction.successMetric ? (
                  <div>
                    <SectionLabel>Success metric</SectionLabel>
                    <p className="text-sm text-muted-foreground">{openAction.successMetric}</p>
                  </div>
                ) : null}
                {openAction.diagnosisTitles.length > 0 ? (
                  <div>
                    <SectionLabel>Answers these findings</SectionLabel>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {openAction.diagnosisTitles.map((title) => (
                        <li key={title}>{title}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <SectionLabel aside={`${openAction.facts.length} facts`}>
                    Brain evidence
                  </SectionLabel>
                  {openAction.facts.length > 0 ? (
                    <ul className="space-y-2">
                      {openAction.facts.map((fact) => (
                        <li key={fact.factId} className="rounded-lg border border-border p-3 text-sm">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-foreground">
                              {fact.factKey.replace(/_/g, " ")}
                            </span>
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
                      No Brain fact supports this action directly — treat it as a judgement call.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
