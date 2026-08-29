import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Brain, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  ExperimentForm,
  type ExperimentFormValues,
} from "@/components/business-os/experiment-form";
import { JobStatusStrip } from "@/components/business-os/job-status";
import { formatMetricValue, formatSignedPercent } from "@/components/business-os/metric-format";
import { PageHeader, SectionLabel, StatBlock } from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  getBaselineSuggestion,
  getExperiment,
  getExperimentOptions,
  recordExperimentObservation,
  regenerateLearning,
  saveExperiment,
  transitionExperiment,
} from "@/lib/experiments.functions";
import {
  EXPERIMENT_STATUS_LABEL,
  LEARNING_STATUS_LABEL,
  canTransition,
  type ExperimentAction,
  type ExperimentView,
} from "@/lib/experiments-types";

export const Route = createFileRoute("/_authenticated/app/experiments/$experimentId")({
  head: () => ({
    meta: [
      { title: "Experiment — Business OS" },
      {
        name: "description",
        content:
          "One experiment in full: hypothesis, intervention, baseline, measurements, the deterministic result and what the Business Brain learned from it.",
      },
      { property: "og:title", content: "Experiment — Business OS" },
      {
        property: "og:description",
        content: "Hypothesis, baseline, measurements, result and learning for a single business test.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExperimentDetailPage,
});

const ACTIONS: Array<{ action: ExperimentAction; label: string; variant?: "outline" | "ghost" }> = [
  { action: "plan", label: "Mark as planned", variant: "outline" },
  { action: "start", label: "Start experiment" },
  { action: "pause", label: "Pause", variant: "outline" },
  { action: "resume", label: "Resume" },
  { action: "complete", label: "Complete & measure" },
  { action: "cancel", label: "Cancel", variant: "ghost" },
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 md:grid-cols-[9rem_1fr] md:gap-6">
      <dt className="eyebrow pt-0.5">{label}</dt>
      <dd className="text-sm leading-relaxed text-foreground">{value}</dd>
    </div>
  );
}

function ExperimentDetailPage() {
  const { experimentId } = Route.useParams();
  const { activeBusiness, loading } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const queryClient = useQueryClient();

  const fetchExperiment = useServerFn(getExperiment);
  const fetchOptions = useServerFn(getExperimentOptions);
  const fetchBaseline = useServerFn(getBaselineSuggestion);
  const persist = useServerFn(saveExperiment);
  const move = useServerFn(transitionExperiment);
  const record = useServerFn(recordExperimentObservation);
  const regenerate = useServerFn(regenerateLearning);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  const queryKey = ["experiment", businessId, experimentId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchExperiment({ data: { businessId: businessId!, experimentId } }),
    enabled: businessId !== null,
  });

  const { data: options } = useQuery({
    queryKey: ["experiment-options", businessId],
    queryFn: () => fetchOptions({ data: { businessId: businessId! } }),
    enabled: businessId !== null && editing,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ["experiments", businessId] });
    void queryClient.invalidateQueries({ queryKey: ["metrics", businessId] });
  };

  const save = useMutation({
    mutationFn: (values: ExperimentFormValues) =>
      persist({ data: { businessId: businessId!, experimentId, ...values } }),
    onSuccess: () => {
      toast.success("Experiment updated.");
      setEditing(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const transition = useMutation({
    mutationFn: (action: ExperimentAction) =>
      move({ data: { businessId: businessId!, experimentId, action } }),
    onSuccess: (_result, action) => {
      toast.success(
        action === "complete"
          ? "Result measured. Business OS is writing what this taught us."
          : "Experiment updated.",
      );
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const observe = useMutation({
    mutationFn: (input: { value: number; notes: string | null }) =>
      record({
        data: {
          businessId: businessId!,
          experimentId,
          value: input.value,
          notes: input.notes,
        },
      }),
    onSuccess: () => {
      toast.success("Measurement recorded.");
      setValue("");
      setNotes("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const relearn = useMutation({
    mutationFn: () => regenerate({ data: { businessId: businessId!, experimentId } }),
    onSuccess: () => toast.success("Re-reading the result."),
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading || (isLoading && businessId)) {
    return <div className="p-2 text-sm text-muted-foreground">Loading experiment…</div>;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">That experiment is not available.</p>
        <Button asChild variant="outline">
          <Link to="/app/experiments">Back to experiments</Link>
        </Button>
      </div>
    );
  }

  const experiment: ExperimentView = data.experiment;
  const unit = experiment.primaryMetric?.unit ?? null;
  const observations = data.observations;
  const inPeriod = observations.filter((o) => o.inPeriod);

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/app/experiments">
          <ArrowLeft className="mr-1.5 size-4" aria-hidden />
          All experiments
        </Link>
      </Button>

      <PageHeader
        eyebrow={`${experiment.experimentTypeLabel} · ${EXPERIMENT_STATUS_LABEL[experiment.status]}`}
        title={experiment.name}
        {...(experiment.interventionSummary || experiment.description
          ? { subtitle: experiment.interventionSummary ?? experiment.description! }
          : {})}
        actions={
          <>
            {ACTIONS.filter((option) => canTransition(experiment.status, option.action)).map(
              (option) => (
                <Button
                  key={option.action}
                  variant={option.variant ?? "default"}
                  disabled={transition.isPending}
                  onClick={() => transition.mutate(option.action)}
                >
                  {option.label}
                </Button>
              ),
            )}
            {experiment.status !== "completed" && experiment.status !== "cancelled" ? (
              <Button variant="outline" onClick={() => setEditing((open) => !open)}>
                {editing ? "Close editor" : "Edit"}
              </Button>
            ) : null}
          </>
        }
      />

      <JobStatusStrip
        businessId={businessId}
        jobTypes={["experiment_learning"]}
        invalidateKeys={[queryKey, ["experiments", businessId]]}
      />

      {!experiment.readiness.ready && experiment.status !== "completed" && experiment.status !== "cancelled" ? (
        <section className="rounded-xl border border-caution/50 bg-caution/5 p-5">
          <p className="eyebrow text-caution-foreground">Before this can start</p>
          <ul className="mt-3 space-y-2">
            {experiment.readiness.blockers.map((blocker) => (
              <li key={blocker} className="text-sm leading-relaxed text-foreground">
                {blocker}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editing && businessId ? (
        <ExperimentForm
          metrics={options?.metrics ?? []}
          pending={save.isPending}
          locked={experiment.definitionLocked}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={(values) => save.mutate(values)}
          onRequestBaseline={async (metricId) => {
            const found = await fetchBaseline({ data: { businessId, metricId } });
            return found ? { value: found.value, source: found.source } : null;
          }}
          initial={{
            name: experiment.name,
            description: experiment.description,
            hypothesisIntervention: experiment.hypothesisIntervention,
            hypothesisExpectedChange: experiment.hypothesisExpectedChange,
            hypothesisRationale: experiment.hypothesisRationale,
            experimentType: experiment.experimentType,
            interventionSummary: experiment.interventionSummary,
            comparisonDefinition: experiment.comparisonDefinition,
            startDate: experiment.startDate,
            endDate: experiment.endDate,
            primaryMetricId: experiment.primaryMetric?.id ?? null,
            secondaryMetricIds: experiment.secondaryMetrics.map((m) => m.id),
            baselineValue: experiment.baselineValue,
            baselineSource: experiment.baselineSource,
            targetValue: experiment.targetValue,
          }}
        />
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-6 shadow-quiet">
          <SectionLabel>Hypothesis</SectionLabel>
          <dl className="divide-y divide-border">
            <Row label="If we" value={experiment.hypothesisIntervention ?? "Not stated"} />
            <Row label="Then we expect" value={experiment.hypothesisExpectedChange ?? "Not stated"} />
            <Row label="Because" value={experiment.hypothesisRationale ?? "Not stated"} />
            <Row label="Intervention" value={experiment.interventionSummary ?? "Not stated"} />
            {experiment.comparisonDefinition ? (
              <Row label="Compared with" value={experiment.comparisonDefinition} />
            ) : null}
            <Row
              label="Window"
              value={
                experiment.startDate && experiment.endDate
                  ? `${experiment.startDate} → ${experiment.endDate}${
                      experiment.remainingDays != null ? ` · ${experiment.remainingDays} days left` : ""
                    }`
                  : "No dates set"
              }
            />
          </dl>
          <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            {experiment.typeCaveat}
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatBlock
              label="Baseline"
              value={formatMetricValue(experiment.baselineValue, unit)}
              caption={experiment.baselineSource ?? "Recorded before the intervention began."}
            />
            <StatBlock
              label={experiment.status === "completed" ? "Final" : "Latest"}
              value={formatMetricValue(experiment.result.finalValue, unit)}
              caption={`${experiment.result.observationsInPeriod} readings inside the window.`}
            />
            <StatBlock
              label="Target"
              value={formatMetricValue(experiment.targetValue, unit)}
              caption={
                experiment.result.targetAchieved === null
                  ? "Judged against what was stated up front."
                  : experiment.result.targetAchieved
                    ? "Reached."
                    : "Not reached."
              }
            />
            <StatBlock
              label="Change"
              value={formatSignedPercent(experiment.result.percentChange)}
              caption={
                experiment.result.absoluteChange == null
                  ? "No measured movement yet."
                  : `${formatMetricValue(experiment.result.absoluteChange, unit)} in absolute terms.`
              }
            />
          </div>

          {experiment.targetProgressPercent != null ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-quiet">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-foreground">Progress to target</span>
                <span className="numeric text-sm text-muted-foreground">
                  {Math.round(experiment.targetProgressPercent)}%
                </span>
              </div>
              <Progress value={experiment.targetProgressPercent} className="mt-2 h-1.5" />
              {experiment.timeProgressPercent != null ? (
                <>
                  <div className="mt-4 flex items-baseline justify-between gap-3">
                    <span className="text-sm text-foreground">Time elapsed</span>
                    <span className="numeric text-sm text-muted-foreground">
                      {Math.round(experiment.timeProgressPercent)}%
                    </span>
                  </div>
                  <Progress value={experiment.timeProgressPercent} className="mt-2 h-1.5" />
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-quiet">
        <SectionLabel
          aside={
            experiment.result.confidence == null
              ? "Confidence not yet earned"
              : `Confidence ${experiment.result.confidence}%`
          }
        >
          Result
        </SectionLabel>
        <p className="text-sm leading-relaxed text-foreground">{experiment.result.statement}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full">
            {LEARNING_STATUS_LABEL[experiment.result.learningStatus]}
          </Badge>
          <Badge variant="outline" className="rounded-full text-muted-foreground">
            Data completeness {experiment.result.dataCompleteness}%
          </Badge>
          <Badge variant="outline" className="rounded-full text-muted-foreground">
            {experiment.result.observationsInPeriod} readings in window
          </Badge>
        </div>
        {experiment.result.dataCompleteness < 50 && experiment.status !== "draft" ? (
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Fewer measurements were recorded than this metric's frequency expects, so the result is
            held at low confidence rather than presented as certain.
          </p>
        ) : null}
      </section>

      {experiment.status === "completed" ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-quiet">
          <SectionLabel
            aside={
              <Button
                size="sm"
                variant="ghost"
                disabled={relearn.isPending}
                onClick={() => relearn.mutate()}
              >
                <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
                Re-read
              </Button>
            }
          >
            What we learned
          </SectionLabel>
          {experiment.learning ? (
            <dl className="divide-y divide-border">
              <Row label="Learning" value={experiment.learning} />
              {experiment.limitation ? <Row label="Limitation" value={experiment.limitation} /> : null}
              {experiment.recommendation ? (
                <Row label="Recommendation" value={experiment.recommendation} />
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              The numbers are already recorded. Business OS is writing the interpretation — this
              appears within a minute or two.
            </p>
          )}
          {experiment.learningGeneratedAt ? (
            <p className="mt-5 flex items-center gap-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
              <Brain className="size-3.5" aria-hidden />
              Written into the Business Brain on{" "}
              {new Date(experiment.learningGeneratedAt).toLocaleDateString()} — future diagnoses and
              recommendations take this into account.
            </p>
          ) : null}
        </section>
      ) : null}

      {experiment.status === "running" || experiment.status === "paused" ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-quiet">
          <SectionLabel
            aside={experiment.primaryMetric ? experiment.primaryMetric.name : "No metric attached"}
          >
            Record a measurement
          </SectionLabel>
          {experiment.primaryMetric ? (
            <div className="grid gap-4 md:grid-cols-[10rem_1fr_auto] md:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Value{unit ? ` (${unit})` : ""}
                </Label>
                <Input
                  className="numeric"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Note</Label>
                <Textarea
                  rows={1}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="What was happening when this was measured?"
                />
              </div>
              <Button
                disabled={observe.isPending || value.trim() === ""}
                onClick={() => {
                  const parsed = Number(value);
                  if (!Number.isFinite(parsed)) {
                    toast.error("Enter a number.");
                    return;
                  }
                  observe.mutate({ value: parsed, notes: notes.trim() || null });
                }}
              >
                Record
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Attach a primary metric before recording measurements.
            </p>
          )}
        </section>
      ) : null}

      {experiment.secondaryMetrics.length > 0 ? (
        <section>
          <SectionLabel>Guardrails</SectionLabel>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {experiment.secondaryMetrics.map((metric) => (
              <li key={metric.id}>
                <Link
                  to="/app/metrics/$metricId"
                  params={{ metricId: metric.id }}
                  className="block rounded-xl border border-border bg-card p-5 shadow-quiet transition-colors hover:border-primary/40"
                >
                  <p className="text-sm text-foreground">{metric.name}</p>
                  <p className="numeric mt-2 text-lg text-foreground">
                    {formatMetricValue(metric.currentValue, metric.unit)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.trendLabel}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {observations.length > 0 ? (
        <section>
          <SectionLabel aside={`${inPeriod.length} inside the measurement window`}>
            Measurement history
          </SectionLabel>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-quiet">
            {observations.slice(0, 24).map((observation) => (
              <li
                key={observation.id}
                className={`flex items-baseline gap-4 px-5 py-3 text-sm ${
                  observation.inPeriod ? "" : "opacity-55"
                }`}
              >
                <span className="numeric w-28 shrink-0 text-foreground">
                  {formatMetricValue(observation.value, unit)}
                </span>
                <span className="w-28 shrink-0 text-xs text-muted-foreground">
                  {observation.recordedAt.slice(0, 10)}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {observation.inPeriod ? (observation.notes ?? "—") : "Outside the window"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-quiet">
          <SectionLabel>Where this came from</SectionLabel>
          <dl className="divide-y divide-border">
            {experiment.links.diagnosisItem ? (
              <Row
                label="Finding"
                value={
                  <Link to="/app/diagnosis" className="text-primary">
                    {experiment.links.diagnosisItem.title}
                  </Link>
                }
              />
            ) : null}
            {experiment.links.task ? (
              <Row
                label="Action"
                value={
                  <Link to="/app/action-plan" className="text-primary">
                    {experiment.links.task.title}
                  </Link>
                }
              />
            ) : null}
            {experiment.links.process ? (
              <Row
                label="Process"
                value={
                  <Link
                    to="/app/operations/$processId"
                    params={{ processId: experiment.links.process.id }}
                    className="text-primary"
                  >
                    {experiment.links.process.name}
                    {experiment.links.process.version ? ` (v${experiment.links.process.version})` : ""}
                  </Link>
                }
              />
            ) : null}
            {experiment.primaryMetric ? (
              <Row
                label="Metric"
                value={
                  <Link
                    to="/app/metrics/$metricId"
                    params={{ metricId: experiment.primaryMetric.id }}
                    className="text-primary"
                  >
                    {experiment.primaryMetric.name}
                  </Link>
                }
              />
            ) : null}
            {!experiment.links.diagnosisItem &&
            !experiment.links.task &&
            !experiment.links.process &&
            !experiment.primaryMetric ? (
              <Row label="Origin" value="Created directly, with no upstream finding attached." />
            ) : null}
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-quiet">
          <SectionLabel aside={`${experiment.evidence.length} facts`}>Evidence</SectionLabel>
          {experiment.evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No Brain facts were carried into this experiment.
            </p>
          ) : (
            <ul className="space-y-3">
              {experiment.evidence.map((item, index) => (
                <li key={`${item.factKey}-${index}`} className="text-sm leading-relaxed">
                  <p className="text-foreground">{item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.factKey} · {item.quality}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
