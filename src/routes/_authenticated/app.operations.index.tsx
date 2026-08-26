import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { toast } from "sonner";

import { JobStatusStrip } from "@/components/business-os/job-status";
import { AutonomyBadge, EmptyState, PageHeader, SectionLabel, StatBlock } from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { enqueueEngineRun } from "@/lib/jobs.functions";
import { decideProcessApproval, getOperations } from "@/lib/process.functions";
import type { AutonomyLevel } from "@/lib/business-os";

export const Route = createFileRoute("/_authenticated/app/operations/")({
  head: () => ({
    meta: [
      { title: "Operations — Business OS" },
      {
        name: "description",
        content:
          "The repeatable processes that run this business: trigger, steps, owner, autonomy, runs and the diagnosis each one came from.",
      },
      { property: "og:title", content: "Operations — Business OS" },
      {
        property: "og:description",
        content: "Repeatable processes with owners, autonomy levels, runs and evidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OperationsPage,
});

const STATUS_TONE: Record<string, string> = {
  active: "border-positive/40 text-positive",
  draft: "border-signal/40 text-signal",
  archived: "border-border text-muted-foreground",
};

function statusLabel(status: string, paused: boolean) {
  if (paused && status === "draft") return "Paused";
  if (status === "draft") return "Draft";
  if (status === "active") return "Active";
  return "Archived";
}

function timeAgo(iso: string | null) {
  if (!iso) return "Never run";
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diff / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function OperationsPage() {
  const { activeBusiness, loading } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const queryClient = useQueryClient();

  const fetchOperations = useServerFn(getOperations);
  const enqueue = useServerFn(enqueueEngineRun);
  const decide = useServerFn(decideProcessApproval);

  const queryKey = ["operations", businessId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchOperations({ data: { businessId: businessId! } }),
    enabled: businessId !== null,
  });

  const generate = useMutation({
    mutationFn: () => enqueue({ data: { businessId: businessId!, jobType: "process_generation" } }),
    onSuccess: (result) => {
      if (result.blocked) {
        toast.error(result.reason ?? "AI is paused for this workspace.");
        return;
      }
      toast.success("Business OS is designing your processes. This runs in the background.");
      void queryClient.invalidateQueries({ queryKey: ["ai-jobs", businessId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const approve = useMutation({
    mutationFn: (input: { approvalId: string; decision: "approve" | "reject" | "pause" }) =>
      decide({ data: { businessId: businessId!, ...input } }),
    onSuccess: () => {
      toast.success("Decision recorded.");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading || (isLoading && businessId)) {
    return <div className="p-2 text-sm text-muted-foreground">Loading operations…</div>;
  }

  const processes = data?.processes ?? [];
  const counts = data?.counts ?? { active: 0, draft: 0, paused: 0, approvals: 0 };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Operate"
        title="Operations"
        subtitle="A process is a system that repeatedly produces a business outcome. Business OS designs them from your diagnosis, blueprint and action plan — then runs the internal steps and stops for your approval before anything leaves the business."
        actions={
          <Button onClick={() => generate.mutate()} disabled={generate.isPending || !businessId}>
            <Sparkles className="mr-2 h-4 w-4" />
            {processes.length > 0 ? "Find new processes" : "Design my processes"}
          </Button>
        }
      />

      <JobStatusStrip
        businessId={businessId}
        jobTypes={["process_generation"]}
        invalidateKeys={[queryKey]}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock label="Active processes" value={String(counts.active)} caption="Runnable today" />
        <StatBlock label="Drafts" value={String(counts.draft)} caption="Awaiting your review" />
        <StatBlock label="Paused" value={String(counts.paused)} caption="Held or archived" />
        <StatBlock label="Awaiting approval" value={String(counts.approvals)} caption="Runs stopped for a decision" />
      </section>

      {(data?.approvals ?? []).length > 0 ? (
        <section>
          <SectionLabel aside="Nothing leaves your business without this">
            Needs your approval
          </SectionLabel>
          <div className="space-y-3">
            {(data?.approvals ?? []).map((approval) => (
              <div key={approval.id} className="rounded-xl border border-caution/40 bg-caution/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {approval.processName}
                    </p>
                    <h3 className="mt-1 text-base font-medium text-foreground">{approval.title}</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approve.mutate({ approvalId: approval.id, decision: "approve" })}
                      disabled={approve.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => approve.mutate({ approvalId: approval.id, decision: "pause" })}
                      disabled={approve.isPending}
                    >
                      Pause
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => approve.mutate({ approvalId: approval.id, decision: "reject" })}
                      disabled={approve.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="eyebrow">What will happen</dt>
                    <dd className="mt-1 text-muted-foreground">{approval.whatWillHappen ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Why it is recommended</dt>
                    <dd className="mt-1 text-muted-foreground">{approval.whyRecommended ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Data used</dt>
                    <dd className="mt-1 text-muted-foreground">
                      {String((approval.dataUsed["inputs"] as string) ?? "The run's own record")}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">External effect</dt>
                    <dd className="mt-1 text-muted-foreground">{approval.externalEffect ?? "None"}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionLabel aside={`${processes.length} process${processes.length === 1 ? "" : "es"}`}>
          Process library
        </SectionLabel>

        {processes.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title="No processes designed yet"
            body={
              data?.hasActionPlan
                ? "Business OS reads your diagnosis, blueprint and action plan and identifies the work that should become a repeatable system rather than a one-off task."
                : "Processes are derived from your action plan. Generate the action plan first, then come back and design the processes that carry it out."
            }
            {...(data?.hasActionPlan
              ? {}
              : { primary: { label: "Open the action plan", to: "/app/action-plan" } })}
            note="Generated processes always start in draft at a conservative autonomy level."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {processes.map((process) => (
              <Link
                key={process.id}
                to="/app/operations/$processId"
                params={{ processId: process.id }}
                className="group rounded-xl border border-border bg-card p-5 transition hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-medium text-foreground">{process.name}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {process.purpose ?? process.description ?? "—"}
                    </p>
                  </div>
                  <Badge variant="outline" className={STATUS_TONE[process.status] ?? ""}>
                    {statusLabel(process.status, false)}
                  </Badge>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <AutonomyBadge level={Math.min(process.autonomyLevel, 4) as AutonomyLevel} />
                  <Badge variant="outline" className="text-muted-foreground">
                    Owner: {process.ownerType}
                  </Badge>
                  <Badge variant="outline" className="text-muted-foreground">
                    v{process.version}
                  </Badge>
                  <Badge variant="outline" className="text-muted-foreground">
                    {process.steps.length} steps
                  </Badge>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
                  <div>
                    <dt className="eyebrow">Last run</dt>
                    <dd className="mt-1 numeric text-foreground">{timeAgo(process.stats.lastRunAt)}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Success</dt>
                    <dd className="mt-1 numeric text-foreground">
                      {process.stats.successRate === null ? "—" : `${process.stats.successRate}%`}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Runs</dt>
                    <dd className="mt-1 numeric text-foreground">{process.stats.runs}</dd>
                  </div>
                </dl>

                {process.evidence.diagnosisTitles.length > 0 ? (
                  <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    From diagnosis: {process.evidence.diagnosisTitles.slice(0, 2).join("; ")}
                  </p>
                ) : null}

                <p className="mt-4 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                  Open process <ArrowRight className="h-3 w-3" />
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {(data?.executions ?? []).length > 0 ? (
        <section>
          <SectionLabel aside="Most recent first">Recent runs</SectionLabel>
          <div className="overflow-hidden rounded-xl border border-border">
            {(data?.executions ?? []).map((execution) => (
              <div
                key={execution.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
              >
                <div>
                  <p className="font-medium text-foreground">{execution.processName}</p>
                  <p className="text-xs text-muted-foreground">
                    v{execution.processVersion} · {execution.triggerSource} ·{" "}
                    {new Date(execution.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {execution.durationMs !== null ? (
                    <span className="numeric text-xs text-muted-foreground">
                      {Math.round(execution.durationMs / 100) / 10}s
                    </span>
                  ) : null}
                  <Badge variant="outline" className="text-muted-foreground">
                    {execution.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
