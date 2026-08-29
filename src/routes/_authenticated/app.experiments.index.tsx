import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, FlaskConical, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  ExperimentForm,
  type ExperimentFormValues,
} from "@/components/business-os/experiment-form";
import { formatMetricValue, formatSignedPercent } from "@/components/business-os/metric-format";
import { EmptyState, PageHeader, SectionLabel, StatBlock } from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  getBaselineSuggestion,
  getExperimentOptions,
  getExperiments,
  saveExperiment,
} from "@/lib/experiments.functions";
import {
  EXPERIMENT_STATUS_LABEL,
  LEARNING_STATUS_LABEL,
  type ExperimentStatus,
  type ExperimentLearningStatus,
} from "@/lib/experiments-types";

export const Route = createFileRoute("/_authenticated/app/experiments/")({
  head: () => ({
    meta: [
      { title: "Experiments & Learning — Business OS" },
      {
        name: "description",
        content:
          "Test business changes deliberately: a stated hypothesis, a real baseline, one primary metric, guardrails, and an honest result the Business Brain learns from.",
      },
      { property: "og:title", content: "Experiments & Learning — Business OS" },
      {
        property: "og:description",
        content:
          "Hypothesis, baseline, intervention, measurement, result, learning — the loop that teaches Business OS what works in your business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExperimentsPage,
});

const STATUS_TONE: Record<ExperimentStatus, string> = {
  draft: "border-border text-muted-foreground",
  planned: "border-signal/40 text-signal",
  running: "border-primary/40 text-primary",
  paused: "border-caution/50 text-caution-foreground",
  completed: "border-positive/40 text-positive",
  cancelled: "border-border text-muted-foreground line-through",
};

const LEARNING_TONE: Record<ExperimentLearningStatus, string> = {
  pending: "border-border text-muted-foreground",
  positive: "border-positive/40 text-positive",
  negative: "border-destructive/40 text-destructive",
  inconclusive: "border-caution/50 text-caution-foreground",
};

const FILTERS: Array<{ key: "all" | ExperimentStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "planned", label: "Planned" },
  { key: "running", label: "Running" },
  { key: "completed", label: "Completed" },
];

function ExperimentsPage() {
  const { activeBusiness, loading } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const fetchExperiments = useServerFn(getExperiments);
  const fetchOptions = useServerFn(getExperimentOptions);
  const fetchBaseline = useServerFn(getBaselineSuggestion);
  const persist = useServerFn(saveExperiment);

  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | ExperimentStatus>("all");

  const queryKey = ["experiments", businessId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchExperiments({ data: { businessId: businessId! } }),
    enabled: businessId !== null,
  });

  const { data: options } = useQuery({
    queryKey: ["experiment-options", businessId],
    queryFn: () => fetchOptions({ data: { businessId: businessId! } }),
    enabled: businessId !== null && creating,
  });

  const create = useMutation({
    mutationFn: (values: ExperimentFormValues) =>
      persist({ data: { businessId: businessId!, ...values } }),
    onSuccess: (result) => {
      toast.success("Experiment drafted. Set it running when you're ready.");
      setCreating(false);
      void queryClient.invalidateQueries({ queryKey });
      void navigate({
        to: "/app/experiments/$experimentId",
        params: { experimentId: result.experimentId },
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading || (isLoading && businessId)) {
    return <div className="p-2 text-sm text-muted-foreground">Loading experiments…</div>;
  }

  const experiments = data?.experiments ?? [];
  const summary = data?.summary;
  const term = search.trim().toLowerCase();
  const visible = experiments.filter((experiment) => {
    if (filter !== "all" && experiment.status !== filter) return false;
    if (!term) return true;
    return [experiment.name, experiment.hypothesis ?? "", experiment.interventionSummary ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Learn"
        title="Experiments"
        subtitle="Every significant change is testable: hypothesis, baseline, intervention, success metric, guardrails, result, decision. This is how the Brain learns what works in your business specifically."
        actions={
          businessId ? (
            <Button onClick={() => setCreating((open) => !open)}>
              <Plus className="mr-1.5 size-4" aria-hidden />
              {creating ? "Cancel" : "New experiment"}
            </Button>
          ) : null
        }
      />

      {creating && businessId ? (
        <ExperimentForm
          metrics={options?.metrics ?? []}
          pending={create.isPending}
          submitLabel="Create draft"
          onCancel={() => setCreating(false)}
          onSubmit={(values) => create.mutate(values)}
          onRequestBaseline={async (metricId) => {
            const found = await fetchBaseline({ data: { businessId, metricId } });
            return found ? { value: found.value, source: found.source } : null;
          }}
        />
      ) : null}

      {experiments.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No experiments yet"
          body="Experiments usually start from a diagnosis finding, an approved action or a live process — Business OS turns the recommendation into a measured test with a stated baseline and a clear decision rule."
          primary={{ label: "See the diagnosis", to: "/app/diagnosis" }}
          secondary={{ label: "See the action plan", to: "/app/action-plan" }}
          note="Nothing here is simulated. Baselines and results come only from measurements you or a process recorded."
        />
      ) : (
        <>
          {summary ? (
            <section>
              <SectionLabel aside={`${summary.completed} completed of ${summary.total}`}>
                Learning summary
              </SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatBlock
                  label="Running"
                  value={String(summary.running)}
                  caption="Live tests currently collecting measurements."
                />
                <StatBlock
                  label="Worked"
                  value={String(summary.positive)}
                  caption="Completed with movement in the intended direction."
                />
                <StatBlock
                  label="Didn't work"
                  value={String(summary.negative)}
                  caption="A real answer. Business OS keeps these — they are the most useful."
                />
                <StatBlock
                  label="Inconclusive"
                  value={String(summary.inconclusive)}
                  caption="Not enough measurement to draw a conclusion either way."
                />
              </div>
            </section>
          ) : null}

          <section>
            <SectionLabel aside={`${visible.length} shown`}>Experiments</SectionLabel>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="max-w-sm flex-1">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search experiments…"
                  aria-label="Search experiments"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((option) => (
                  <Button
                    key={option.key}
                    size="sm"
                    variant={filter === option.key ? "default" : "outline"}
                    onClick={() => setFilter(option.key)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-quiet">
                No experiments match that view.
              </p>
            ) : (
              <ul className="grid gap-4 lg:grid-cols-2">
                {visible.map((experiment) => (
                  <li key={experiment.id}>
                    <Link
                      to="/app/experiments/$experimentId"
                      params={{ experimentId: experiment.id }}
                      className="block rounded-xl border border-border bg-card p-5 shadow-quiet transition-colors hover:border-primary/40"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base text-foreground">{experiment.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {experiment.experimentTypeLabel}
                            {experiment.primaryMetric ? ` · ${experiment.primaryMetric.name}` : " · no metric yet"}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <Badge
                            variant="outline"
                            className={`rounded-full ${STATUS_TONE[experiment.status]}`}
                          >
                            {EXPERIMENT_STATUS_LABEL[experiment.status]}
                          </Badge>
                          {experiment.status === "completed" ? (
                            <Badge
                              variant="outline"
                              className={`rounded-full ${LEARNING_TONE[experiment.learningStatus]}`}
                            >
                              {LEARNING_STATUS_LABEL[experiment.learningStatus]}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      {experiment.hypothesisExpectedChange ? (
                        <p className="mt-4 text-sm leading-relaxed text-foreground">
                          <span className="eyebrow mr-2">If</span>
                          {experiment.hypothesisIntervention}
                          <span className="eyebrow mx-2">then</span>
                          {experiment.hypothesisExpectedChange}
                        </p>
                      ) : null}

                      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="eyebrow">Baseline</p>
                          <p className="numeric mt-1 text-sm text-foreground">
                            {formatMetricValue(
                              experiment.baselineValue,
                              experiment.primaryMetric?.unit ?? null,
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="eyebrow">
                            {experiment.status === "completed" ? "Final" : "Latest"}
                          </p>
                          <p className="numeric mt-1 text-sm text-foreground">
                            {formatMetricValue(
                              experiment.result.finalValue,
                              experiment.primaryMetric?.unit ?? null,
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="eyebrow">Change</p>
                          <p className="numeric mt-1 text-sm text-foreground">
                            {formatSignedPercent(experiment.result.percentChange)}
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 flex items-center gap-1.5 text-xs text-primary">
                        Open experiment <ArrowRight className="size-3" aria-hidden />
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
