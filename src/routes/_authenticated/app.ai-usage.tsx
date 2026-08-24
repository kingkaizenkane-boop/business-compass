import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Gauge, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, SectionLabel, StatBlock } from "@/components/business-os/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/hooks/use-workspace";
import { getAiUsageOverview, resumeAiWork, updateAiLimits } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/app/ai-usage")({
  head: () => ({
    meta: [
      { title: "AI usage & cost — Business OS" },
      {
        name: "description",
        content:
          "Month-to-date AI spend, tokens by model and operation, failed jobs and the monthly ceiling that protects your workspace.",
      },
      { property: "og:title", content: "AI usage & cost — Business OS" },
      {
        property: "og:description",
        content: "Track AI spend, tokens and failures against your monthly ceiling.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiUsagePage,
});

const money = (value: number) => `$${value.toFixed(value < 1 ? 4 : 2)}`;
const compact = (value: number) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(value);

function AiUsagePage() {
  const { activeOrganization } = useWorkspace();
  const organizationId = activeOrganization?.id ?? null;
  const fetchOverview = useServerFn(getAiUsageOverview);
  const saveLimits = useServerFn(updateAiLimits);
  const resume = useServerFn(resumeAiWork);
  const queryClient = useQueryClient();

  const [tokenLimit, setTokenLimit] = useState("");
  const [costLimit, setCostLimit] = useState("");

  const overviewQuery = useQuery({
    queryKey: ["ai-usage", organizationId],
    queryFn: () => fetchOverview({ data: { organizationId: organizationId! } }),
    enabled: organizationId !== null,
    refetchInterval: 60_000,
  });

  const overview = overviewQuery.data ?? null;

  useEffect(() => {
    if (!overview) return;
    setTokenLimit(String(overview.budget.limits.monthlyTokenLimit));
    setCostLimit(String(overview.budget.limits.monthlyCostLimitUsd));
  }, [overview]);

  const limitsMutation = useMutation({
    mutationFn: () =>
      saveLimits({
        data: {
          organizationId: organizationId!,
          monthlyTokenLimit: Number(tokenLimit),
          monthlyCostLimitUsd: Number(costLimit),
        },
      }),
    onSuccess: () => {
      toast.success("AI ceiling updated");
      void queryClient.invalidateQueries({ queryKey: ["ai-usage", organizationId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save limits"),
  });

  const resumeMutation = useMutation({
    mutationFn: () => resume({ data: { organizationId: organizationId! } }),
    onSuccess: () => {
      toast.success("AI work resumed");
      void queryClient.invalidateQueries({ queryKey: ["ai-usage", organizationId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not resume AI work"),
  });

  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Operations"
        title="AI usage & cost"
        subtitle="Every AI call in Business OS is metered against your organization. This is the month-to-date picture, the ceiling that protects you, and anything that failed."
      />

      {organizationId === null ? (
        <EmptyState
          icon={Gauge}
          title="No workspace yet"
          body="Create a business to start metering AI usage."
        />
      ) : overviewQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading usage…</p>
      ) : overviewQuery.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm font-medium text-foreground">Usage could not be loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {overviewQuery.error instanceof Error ? overviewQuery.error.message : "Unknown error."}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void overviewQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : overview ? (
        <div className="space-y-9">
          {overview.alerts.length > 0 ? (
            <div className="space-y-2">
              {overview.alerts.map((alert, index) => (
                <div
                  key={index}
                  className={
                    alert.level === "critical"
                      ? "flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
                      : "flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4"
                  }
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{alert.message}</p>
                  </div>
                  {alert.level === "critical" && overview.isAdmin && overview.budget.limits.paused ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resumeMutation.isPending}
                      onClick={() => resumeMutation.mutate()}
                    >
                      <PlayCircle className="mr-1.5 size-3.5" />
                      Resume
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBlock label="Spend this month" value={money(overview.totals.costUsd)} caption={`${overview.costPct}% of ceiling`} />
            <StatBlock label="Tokens this month" value={compact(overview.totals.tokens)} caption={`${overview.tokenPct}% of ceiling`} />
            <StatBlock label="AI calls" value={String(overview.totals.calls)} caption="Chat, reasoning and embeddings" />
            <StatBlock label="Failed calls" value={String(overview.totals.failures)} caption="Counted against reliability" />
          </div>

          <section className="grid gap-6 lg:grid-cols-2">
            <div>
              <SectionLabel>By model</SectionLabel>
              <div className="mt-3 divide-y divide-border rounded-lg border border-border">
                {overview.byModel.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No AI calls yet this month.</p>
                ) : (
                  overview.byModel.map((row) => (
                    <div key={row.key} className="flex items-center justify-between gap-4 p-3.5">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-foreground">{row.key}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.calls} calls · {compact(row.tokens)} tokens
                          {row.failures > 0 ? ` · ${row.failures} failed` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm text-foreground">{money(row.costUsd)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <SectionLabel>By operation</SectionLabel>
              <div className="mt-3 divide-y divide-border rounded-lg border border-border">
                {overview.byOperation.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Nothing recorded yet.</p>
                ) : (
                  overview.byOperation.map((row) => (
                    <div key={row.key} className="flex items-center justify-between gap-4 p-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">{row.key}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.calls} calls · {compact(row.tokens)} tokens
                        </p>
                      </div>
                      <p className="shrink-0 text-sm text-foreground">{money(row.costUsd)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {overview.failedJobs.length > 0 ? (
            <section>
              <SectionLabel>Recent job failures</SectionLabel>
              <div className="mt-3 divide-y divide-border rounded-lg border border-border">
                {overview.failedJobs.map((job) => (
                  <div key={job.id} className="p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-foreground">{job.job_type}</p>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{job.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {job.attempts}/{job.max_attempts} attempts · {job.error_message ?? "No error message recorded"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <SectionLabel>Monthly ceiling</SectionLabel>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              When either ceiling is reached, Business OS stops all AI work for this workspace — including
              scheduled background jobs — instead of continuing to spend.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="token-limit">Tokens per month</Label>
                <Input
                  id="token-limit"
                  className="w-44"
                  inputMode="numeric"
                  value={tokenLimit}
                  disabled={!overview.isAdmin}
                  onChange={(e) => setTokenLimit(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost-limit">Spend per month (USD)</Label>
                <Input
                  id="cost-limit"
                  className="w-44"
                  inputMode="decimal"
                  value={costLimit}
                  disabled={!overview.isAdmin}
                  onChange={(e) => setCostLimit(e.target.value.replace(/[^0-9.]/g, ""))}
                />
              </div>
              <Button
                disabled={!overview.isAdmin || limitsMutation.isPending}
                onClick={() => limitsMutation.mutate()}
              >
                Save ceiling
              </Button>
            </div>
            {!overview.isAdmin ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Only workspace owners and admins can change these limits.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
