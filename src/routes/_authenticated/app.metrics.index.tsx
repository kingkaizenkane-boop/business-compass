import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowRight, Gauge, Plus, Target, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, SectionLabel, StatBlock } from "@/components/business-os/primitives";
import { MetricForm, type MetricFormValues } from "@/components/business-os/metric-form";
import { formatMetricValue, trendTone } from "@/components/business-os/metric-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useWorkspace } from "@/hooks/use-workspace";
import { getMetricLinkOptions, getMetrics, saveMetric } from "@/lib/metrics.functions";

export const Route = createFileRoute("/_authenticated/app/metrics/")({
  head: () => ({
    meta: [
      { title: "Metrics & Outcomes — Business OS" },
      {
        name: "description",
        content:
          "Every metric tied to a goal, diagnosis, action or process — tracked against a baseline so Business OS can tell you what actually moved.",
      },
      { property: "og:title", content: "Metrics & Outcomes — Business OS" },
      {
        property: "og:description",
        content: "Baselines, targets and outcomes for the numbers that matter to your business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MetricsPage,
});

function MetricsPage() {
  const { activeBusiness, loading } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const queryClient = useQueryClient();

  const fetchMetrics = useServerFn(getMetrics);
  const fetchOptions = useServerFn(getMetricLinkOptions);
  const persist = useServerFn(saveMetric);

  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const queryKey = ["metrics", businessId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchMetrics({ data: { businessId: businessId! } }),
    enabled: businessId !== null,
  });

  const { data: options } = useQuery({
    queryKey: ["metric-links", businessId],
    queryFn: () => fetchOptions({ data: { businessId: businessId! } }),
    enabled: businessId !== null && creating,
  });

  const create = useMutation({
    mutationFn: (input: MetricFormValues & { businessId: string }) => persist({ data: input }),
    onSuccess: () => {
      toast.success("Metric created.");
      setCreating(false);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading || (isLoading && businessId)) {
    return <div className="p-2 text-sm text-muted-foreground">Loading metrics…</div>;
  }

  const metrics = data?.metrics ?? [];
  const alerts = data?.alerts ?? [];
  const summary = data?.summary;
  const term = search.trim().toLowerCase();
  const visible = term
    ? metrics.filter((m) =>
        [m.name, m.category ?? "", m.description ?? ""].join(" ").toLowerCase().includes(term),
      )
    : metrics;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Measure"
        title="Metrics & outcomes"
        subtitle="Only metrics that answer a question about the business. Each one carries a baseline, a target and the goal, finding, action or process it exists to measure."
        actions={
          businessId ? (
            <Button onClick={() => setCreating((open) => !open)}>
              <Plus className="mr-1.5 size-4" aria-hidden />
              {creating ? "Cancel" : "New metric"}
            </Button>
          ) : null
        }
      />

      {creating && businessId ? (
        <MetricForm
          options={options ?? { goals: [], tasks: [], processes: [], diagnosisItems: [] }}
          pending={create.isPending}
          onSubmit={(values) => create.mutate({ businessId, ...values })}
        />
      ) : null}

      {metrics.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Nothing measured yet"
          body="Define the first metric that matters — revenue, response time, conversion rate — set its baseline, and Business OS will track outcomes against it from there."
          primary={{ label: "See the Action Plan", to: "/app/action-plan" }}
          secondary={{ label: "See the Business Brain", to: "/app/brain" }}
          note="Nothing here is simulated. Every number on this page is one you or a process recorded."
        />
      ) : (
        <>
          {summary ? (
            <section>
              <SectionLabel aside={`${summary.withBaseline} of ${summary.total} have a baseline`}>
                Performance summary
              </SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatBlock label="Improving" value={String(summary.improving)} caption="Moving in the intended direction versus the last reading." />
                <StatBlock label="Declining" value={String(summary.declining)} caption="Moving against the intended direction." />
                <StatBlock label="On target" value={String(summary.onTarget)} caption="Target value reached at the latest reading." />
                <StatBlock label="Needs attention" value={String(summary.needsAttention)} caption="Declining, or the data is too thin or stale to trust." />
              </div>
            </section>
          ) : null}

          {alerts.length > 0 ? (
            <section>
              <SectionLabel>Signals</SectionLabel>
              <ul className="space-y-2">
                {alerts.slice(0, 8).map((alert, index) => (
                  <li
                    key={`${alert.metricId}-${alert.kind}-${index}`}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-quiet"
                  >
                    <span className="mt-0.5 text-muted-foreground">
                      {alert.kind === "target_achieved" ? (
                        <Target className="size-4 text-positive" aria-hidden />
                      ) : alert.severity === "critical" ? (
                        <TrendingDown className="size-4 text-destructive" aria-hidden />
                      ) : (
                        <AlertTriangle className="size-4 text-caution-foreground" aria-hidden />
                      )}
                    </span>
                    <p className="text-sm leading-relaxed text-foreground">{alert.message}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <SectionLabel aside={`${visible.length} shown`}>Metrics</SectionLabel>
            <div className="mb-4 max-w-sm">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search metrics…"
                aria-label="Search metrics"
              />
            </div>
            <ul className="grid gap-4 lg:grid-cols-2">
              {visible.map((metric) => (
                <li key={metric.id}>
                  <Link
                    to="/app/metrics/$metricId"
                    params={{ metricId: metric.id }}
                    className="block rounded-xl border border-border bg-card p-5 shadow-quiet transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base text-foreground">{metric.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {metric.category ?? "Uncategorised"} · {metric.frequency} ·{" "}
                          {metric.source}
                        </p>
                      </div>
                      <Badge variant="outline" className={`rounded-full ${trendTone(metric.trend)}`}>
                        {metric.trend === "improving" ? (
                          <TrendingUp className="mr-1 size-3" aria-hidden />
                        ) : metric.trend === "declining" || metric.trend === "target_missed" ? (
                          <TrendingDown className="mr-1 size-3" aria-hidden />
                        ) : null}
                        {metric.trendLabel}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="eyebrow">Baseline</p>
                        <p className="numeric mt-1 text-sm text-foreground">
                          {formatMetricValue(metric.baselineValue, metric.unit)}
                        </p>
                      </div>
                      <div>
                        <p className="eyebrow">Current</p>
                        <p className="numeric mt-1 text-sm text-foreground">
                          {formatMetricValue(metric.currentValue, metric.unit)}
                        </p>
                      </div>
                      <div>
                        <p className="eyebrow">Target</p>
                        <p className="numeric mt-1 text-sm text-foreground">
                          {formatMetricValue(metric.targetValue, metric.unit)}
                        </p>
                      </div>
                    </div>

                    {metric.targetProgressPercent != null ? (
                      <Progress value={metric.targetProgressPercent} className="mt-4 h-1.5" />
                    ) : null}

                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                      {metric.outcomeSummary}
                    </p>

                    <p className="mt-4 flex items-center gap-1.5 text-xs text-primary">
                      Open metric <ArrowRight className="size-3" aria-hidden />
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
