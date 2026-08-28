import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Gauge, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { MetricForm, type MetricFormValues } from "@/components/business-os/metric-form";
import {
  formatMetricValue,
  formatSignedPercent,
  trendTone,
} from "@/components/business-os/metric-format";
import { EmptyState, PageHeader, SectionLabel, StatBlock } from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  addMetricObservation,
  getMetric,
  getMetricLinkOptions,
  saveMetric,
} from "@/lib/metrics.functions";

export const Route = createFileRoute("/_authenticated/app/metrics/$metricId")({
  head: () => ({
    meta: [
      { title: "Metric detail — Business OS" },
      {
        name: "description",
        content:
          "Full history, baseline, target and outcome reading for one business metric, plus the goal, finding, action or process it measures.",
      },
      { property: "og:title", content: "Metric detail — Business OS" },
      {
        property: "og:description",
        content: "Baseline, target, history and outcome reading for one business metric.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MetricDetailPage,
});

function MetricDetailPage() {
  const { metricId } = Route.useParams();
  const { activeBusiness, loading } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const queryClient = useQueryClient();

  const fetchMetric = useServerFn(getMetric);
  const fetchOptions = useServerFn(getMetricLinkOptions);
  const persist = useServerFn(saveMetric);
  const record = useServerFn(addMetricObservation);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [recordedAt, setRecordedAt] = useState("");
  const [notes, setNotes] = useState("");

  const queryKey = ["metric", businessId, metricId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchMetric({ data: { businessId: businessId!, metricId } }),
    enabled: businessId !== null,
  });

  const { data: options } = useQuery({
    queryKey: ["metric-links", businessId],
    queryFn: () => fetchOptions({ data: { businessId: businessId! } }),
    enabled: businessId !== null && editing,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ["metrics", businessId] });
  };

  const addObservation = useMutation({
    mutationFn: (input: { value: number; recordedAt?: string | undefined; notes: string | null }) =>
      record({ data: { businessId: businessId!, metricId, ...input } }),
    onSuccess: (result) => {
      toast.success(result.outcome ?? "Observation recorded.");
      setValue("");
      setNotes("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: (input: MetricFormValues & { businessId: string; metricId: string }) =>
      persist({ data: input }),
    onSuccess: () => {
      toast.success("Metric updated.");
      setEditing(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading || (isLoading && businessId)) {
    return <div className="p-2 text-sm text-muted-foreground">Loading metric…</div>;
  }

  if (!data?.metric) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Measure" title="Metric not found" />
        <EmptyState
          icon={Gauge}
          title="This metric is not available"
          body="It may have been removed, or it belongs to a different business in your workspace."
          primary={{ label: "Back to metrics", to: "/app/metrics" }}
        />
      </div>
    );
  }

  const metric = data.metric;
  const history = data.observations ?? [];
  const chartData = [...history]
    .filter((o) => o.value != null)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map((o) => ({
      label: new Date(o.recordedAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
      value: Number(o.value),
    }));

  return (
    <div className="space-y-8">
      <Link
        to="/app/metrics"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All metrics
      </Link>

      <PageHeader
        eyebrow={metric.category ?? "Measure"}
        title={metric.name}
        {...(metric.rationale ?? metric.description
          ? { subtitle: (metric.rationale ?? metric.description)! }
          : {})}
        actions={
          <>
            <Badge variant="outline" className={`rounded-full ${trendTone(metric.trend)}`}>
              {metric.trend === "improving" ? (
                <TrendingUp className="mr-1 size-3" aria-hidden />
              ) : metric.trend === "declining" || metric.trend === "target_missed" ? (
                <TrendingDown className="mr-1 size-3" aria-hidden />
              ) : null}
              {metric.trendLabel}
            </Badge>
            <Button variant="outline" onClick={() => setEditing((open) => !open)}>
              {editing ? "Cancel" : "Edit metric"}
            </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock
          label="Baseline"
          value={formatMetricValue(metric.baselineValue, metric.unit)}
          caption={
            metric.baselineAt
              ? `Set ${new Date(metric.baselineAt).toLocaleDateString("en-GB")}`
              : "No baseline recorded yet."
          }
        />
        <StatBlock
          label="Current"
          value={formatMetricValue(metric.currentValue, metric.unit)}
          caption={
            metric.currentRecordedAt
              ? `Last reading ${new Date(metric.currentRecordedAt).toLocaleDateString("en-GB")}`
              : "Awaiting the first reading."
          }
        />
        <StatBlock
          label="Target"
          value={formatMetricValue(metric.targetValue, metric.unit)}
          caption={
            metric.targetProgressPercent != null
              ? `${Math.round(metric.targetProgressPercent)}% of the way there.`
              : "No target set."
          }
        />
        <StatBlock
          label="Change vs baseline"
          value={formatSignedPercent(metric.changeFromBaselinePercent)}
          caption={`Confidence: ${metric.confidence}. ${metric.observationCount} reading${metric.observationCount === 1 ? "" : "s"}.`}
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-quiet">
        <SectionLabel aside={`${metric.observationCount} observations`}>Outcome</SectionLabel>
        <p className="text-sm leading-relaxed text-foreground">{metric.outcomeSummary}</p>
        {metric.hypothesis || metric.intervention ? (
          <dl className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
            {metric.hypothesis ? (
              <div className="grid gap-1 md:grid-cols-[8rem_1fr] md:gap-6">
                <dt className="eyebrow pt-0.5">Hypothesis</dt>
                <dd className="text-foreground">{metric.hypothesis}</dd>
              </div>
            ) : null}
            {metric.intervention ? (
              <div className="grid gap-1 md:grid-cols-[8rem_1fr] md:gap-6">
                <dt className="eyebrow pt-0.5">Intervention</dt>
                <dd className="text-foreground">{metric.intervention}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </section>

      {editing ? (
        <MetricForm
          options={options ?? { goals: [], tasks: [], processes: [], diagnosisItems: [] }}
          pending={save.isPending}
          submitLabel="Save changes"
          initial={{
            name: metric.name,
            category: metric.category,
            unit: metric.unit,
            description: metric.description,
            rationale: metric.rationale,
            direction: metric.direction,
            frequency: metric.frequency,
            baselineValue: metric.baselineValue,
            targetValue: metric.targetValue,
            goalId: metric.links.goal?.id ?? null,
            diagnosisItemId: metric.links.diagnosisItem?.id ?? null,
            taskId: metric.links.task?.id ?? null,
            processId: metric.links.process?.id ?? null,
          }}
          onSubmit={(values) => save.mutate({ businessId: businessId!, metricId, ...values })}
        />
      ) : null}

      <section>
        <SectionLabel>History</SectionLabel>
        {chartData.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-quiet">
            No readings yet. Record the first one below to establish the baseline.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-5 shadow-quiet">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} width={56} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "0.8rem",
                    }}
                  />
                  {metric.baselineValue != null ? (
                    <ReferenceLine
                      y={metric.baselineValue}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      label={{ value: "Baseline", fontSize: 11, position: "insideTopLeft" }}
                    />
                  ) : null}
                  {metric.targetValue != null ? (
                    <ReferenceLine
                      y={metric.targetValue}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="4 4"
                      label={{ value: "Target", fontSize: 11, position: "insideTopRight" }}
                    />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-quiet">
        <SectionLabel>Record a reading</SectionLabel>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="observation-value">Value{metric.unit ? ` (${metric.unit})` : ""}</Label>
            <Input
              id="observation-value"
              value={value}
              inputMode="decimal"
              onChange={(event) => setValue(event.target.value)}
              placeholder="0"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="observation-date">Date</Label>
            <Input
              id="observation-date"
              type="date"
              value={recordedAt}
              onChange={(event) => setRecordedAt(event.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="observation-notes">Notes (optional)</Label>
            <Textarea
              id="observation-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What was happening in the business during this period?"
              className="mt-1.5"
            />
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3 border-t border-border pt-5">
          <Button
            disabled={addObservation.isPending}
            onClick={() => {
              const parsed = Number(value);
              if (value.trim() === "" || !Number.isFinite(parsed)) {
                toast.error("Enter a numeric value.");
                return;
              }
              addObservation.mutate({
                value: parsed,
                ...(recordedAt ? { recordedAt: new Date(recordedAt).toISOString() } : {}),
                notes: notes.trim() || null,
              });
            }}
          >
            {addObservation.isPending ? "Recording…" : "Record reading"}
          </Button>
          <p className="text-xs text-muted-foreground">
            History is append-only. Corrections are recorded as new readings, never overwrites.
          </p>
        </div>
      </section>

      {history.length > 0 ? (
        <section>
          <SectionLabel>Observation log</SectionLabel>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-quiet">
            {history.map((observation) => (
              <li key={observation.id} className="flex items-start justify-between gap-4 p-4">
                <div>
                  <p className="numeric text-sm text-foreground">
                    {formatMetricValue(observation.value, metric.unit)}
                  </p>
                  {observation.notes ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {observation.notes}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p>{new Date(observation.recordedAt).toLocaleDateString("en-GB")}</p>
                  <p className="mt-1">{observation.source ?? "manual"}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {metric.links.goal || metric.links.diagnosisItem || metric.links.task || metric.links.process ? (
        <section>
          <SectionLabel>Connected to</SectionLabel>
          <ul className="grid gap-3 md:grid-cols-2">
            {metric.links.goal ? (
              <li className="rounded-xl border border-border bg-card p-4 text-sm shadow-quiet">
                <p className="eyebrow">Goal</p>
                <p className="mt-1.5 text-foreground">{metric.links.goal.name}</p>
              </li>
            ) : null}
            {metric.links.diagnosisItem ? (
              <li className="rounded-xl border border-border bg-card p-4 text-sm shadow-quiet">
                <p className="eyebrow">Diagnosis finding</p>
                <p className="mt-1.5 text-foreground">{metric.links.diagnosisItem.title}</p>
              </li>
            ) : null}
            {metric.links.task ? (
              <li className="rounded-xl border border-border bg-card p-4 text-sm shadow-quiet">
                <p className="eyebrow">Action</p>
                <p className="mt-1.5 text-foreground">{metric.links.task.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.links.task.status}</p>
              </li>
            ) : null}
            {metric.links.process ? (
              <li className="rounded-xl border border-border bg-card p-4 text-sm shadow-quiet">
                <p className="eyebrow">Process</p>
                <Link
                  to="/app/operations/$processId"
                  params={{ processId: metric.links.process.id }}
                  className="mt-1.5 block text-foreground hover:text-primary"
                >
                  {metric.links.process.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">{metric.links.process.status}</p>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
