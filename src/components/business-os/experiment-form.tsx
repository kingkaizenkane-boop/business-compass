import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPERIMENT_TYPE_CAVEAT,
  EXPERIMENT_TYPE_LABEL,
  type ExperimentType,
} from "@/lib/experiments-types";

export type ExperimentMetricOption = {
  id: string;
  name: string;
  unit: string | null;
  baselineValue: number | null;
  currentValue: number | null;
  observationCount: number;
};

export type ExperimentFormValues = {
  name: string;
  description: string | null;
  hypothesisIntervention: string | null;
  hypothesisExpectedChange: string | null;
  hypothesisRationale: string | null;
  experimentType: ExperimentType;
  interventionSummary: string | null;
  comparisonDefinition: string | null;
  startDate: string | null;
  endDate: string | null;
  primaryMetricId: string | null;
  secondaryMetricIds: string[];
  baselineValue: number | null;
  baselineSource: string | null;
  targetValue: number | null;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

function toNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Experiment editor. The hypothesis is deliberately three separate fields so a
 * business owner is forced to state what changes, what they expect, and why.
 * `locked` reflects a started experiment — its definition can no longer move.
 */
export function ExperimentForm({
  metrics,
  initial,
  pending,
  locked = false,
  submitLabel = "Save experiment",
  onSubmit,
  onCancel,
  onRequestBaseline,
}: {
  metrics: ExperimentMetricOption[];
  initial?: Partial<ExperimentFormValues>;
  pending: boolean;
  locked?: boolean;
  submitLabel?: string;
  onSubmit: (values: ExperimentFormValues) => void;
  onCancel?: () => void;
  onRequestBaseline?: (metricId: string) => Promise<{ value: number; source: string } | null>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [intervention, setIntervention] = useState(initial?.hypothesisIntervention ?? "");
  const [expected, setExpected] = useState(initial?.hypothesisExpectedChange ?? "");
  const [because, setBecause] = useState(initial?.hypothesisRationale ?? "");
  const [type, setType] = useState<ExperimentType>(initial?.experimentType ?? "before_after");
  const [summary, setSummary] = useState(initial?.interventionSummary ?? "");
  const [comparison, setComparison] = useState(initial?.comparisonDefinition ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [primaryMetricId, setPrimaryMetricId] = useState(initial?.primaryMetricId ?? "");
  const [secondary, setSecondary] = useState<string[]>(initial?.secondaryMetricIds ?? []);
  const [baseline, setBaseline] = useState(
    initial?.baselineValue != null ? String(initial.baselineValue) : "",
  );
  const [baselineSource, setBaselineSource] = useState(initial?.baselineSource ?? "");
  const [target, setTarget] = useState(
    initial?.targetValue != null ? String(initial.targetValue) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [baselineBusy, setBaselineBusy] = useState(false);

  const selectedMetric = metrics.find((m) => m.id === primaryMetricId) ?? null;

  // A metric change invalidates a baseline pulled from a different metric.
  useEffect(() => {
    if (!primaryMetricId) return;
    if (initial?.primaryMetricId === primaryMetricId) return;
    setBaseline("");
    setBaselineSource("");
  }, [primaryMetricId, initial?.primaryMetricId]);

  async function pullBaseline() {
    if (!primaryMetricId || !onRequestBaseline) return;
    setBaselineBusy(true);
    try {
      const found = await onRequestBaseline(primaryMetricId);
      if (found) {
        setBaseline(String(found.value));
        setBaselineSource(found.source);
        setError(null);
      } else {
        setError(
          "That metric has no recorded observation yet. Record one on the metric first — Business OS will not invent a baseline.",
        );
      }
    } finally {
      setBaselineBusy(false);
    }
  }

  function submit() {
    if (name.trim().length < 3) return setError("Give the experiment a name.");
    if (!intervention.trim() || !expected.trim()) {
      return setError("State the hypothesis: what you will change, and what you expect to happen.");
    }
    if (!summary.trim()) return setError("Describe the intervention — exactly what is changing.");
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      return setError("The end date must fall after the start date.");
    }
    if (type === "controlled" && !comparison.trim()) {
      return setError("A controlled experiment needs its comparison group or period defined.");
    }
    setError(null);
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      hypothesisIntervention: intervention.trim(),
      hypothesisExpectedChange: expected.trim(),
      hypothesisRationale: because.trim() || null,
      experimentType: type,
      interventionSummary: summary.trim(),
      comparisonDefinition: comparison.trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
      primaryMetricId: primaryMetricId || null,
      secondaryMetricIds: secondary,
      baselineValue: toNumber(baseline),
      baselineSource: baselineSource.trim() || null,
      targetValue: toNumber(target),
    });
  }

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-quiet">
      {locked ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          This experiment has started. The hypothesis, baseline, design and primary metric are frozen
          so the record stays honest — dates, target and narrative can still be edited.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Experiment name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shorten quote turnaround" />
        </Field>
        <Field label="Design" hint={EXPERIMENT_TYPE_CAVEAT[type]}>
          <select
            className={selectClass}
            value={type}
            disabled={locked}
            onChange={(e) => setType(e.target.value as ExperimentType)}
          >
            {(Object.keys(EXPERIMENT_TYPE_LABEL) as ExperimentType[]).map((option) => (
              <option key={option} value={option}>
                {EXPERIMENT_TYPE_LABEL[option]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <p className="eyebrow">Hypothesis</p>
        <Field label="IF we…" hint="The change you are making.">
          <Textarea
            rows={2}
            value={intervention}
            disabled={locked}
            onChange={(e) => setIntervention(e.target.value)}
            placeholder="respond to every new enquiry within one hour during business hours"
          />
        </Field>
        <Field label="THEN we expect…" hint="The movement you expect, in words. Numbers go in the target field.">
          <Textarea
            rows={2}
            value={expected}
            disabled={locked}
            onChange={(e) => setExpected(e.target.value)}
            placeholder="a higher share of enquiries to convert into booked jobs"
          />
        </Field>
        <Field label="BECAUSE…" hint="The reasoning or evidence behind the expectation.">
          <Textarea
            rows={2}
            value={because}
            disabled={locked}
            onChange={(e) => setBecause(e.target.value)}
            placeholder="the Brain shows most lost enquiries went cold before a reply was sent"
          />
        </Field>
      </div>

      <Field label="Intervention" hint="Exactly what changes in the business while this runs.">
        <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </Field>

      {type === "controlled" ? (
        <Field
          label="Comparison group or period"
          hint="What this is measured against. Without it, no causal claim can be made."
        >
          <Textarea
            rows={2}
            value={comparison}
            disabled={locked}
            onChange={(e) => setComparison(e.target.value)}
          />
        </Field>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Start date">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="End date">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <p className="eyebrow">Measurement</p>
        <Field label="Primary metric" hint="The one number this experiment is judged on.">
          <select
            className={selectClass}
            value={primaryMetricId}
            disabled={locked}
            onChange={(e) => setPrimaryMetricId(e.target.value)}
          >
            <option value="">Select a metric…</option>
            {metrics.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.name}
                {metric.unit ? ` (${metric.unit})` : ""} · {metric.observationCount} readings
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Baseline"
            hint={baselineSource ? `Source: ${baselineSource}` : "Pull this from recorded history rather than typing a guess."}
          >
            <div className="flex gap-2">
              <Input
                value={baseline}
                disabled={locked}
                onChange={(e) => setBaseline(e.target.value)}
                placeholder="—"
                className="numeric"
              />
              {onRequestBaseline && !locked ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!primaryMetricId || baselineBusy}
                  onClick={() => void pullBaseline()}
                >
                  {baselineBusy ? "Reading…" : "Use recorded"}
                </Button>
              ) : null}
            </div>
          </Field>
          <Field
            label="Target"
            hint={
              selectedMetric
                ? `Stated up front so success is not judged after the fact.${selectedMetric.unit ? ` Measured in ${selectedMetric.unit}.` : ""}`
                : "Stated up front so success is not judged after the fact."
            }
          >
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="—"
              className="numeric"
            />
          </Field>
        </div>

        {metrics.length > 1 ? (
          <Field label="Guardrail / secondary metrics" hint="Watched for unintended damage while this runs.">
            <div className="flex flex-wrap gap-2">
              {metrics
                .filter((metric) => metric.id !== primaryMetricId)
                .slice(0, 12)
                .map((metric) => {
                  const on = secondary.includes(metric.id);
                  return (
                    <Button
                      key={metric.id}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      disabled={locked}
                      onClick={() =>
                        setSecondary((current) =>
                          on ? current.filter((id) => id !== metric.id) : [...current, metric.id],
                        )
                      }
                    >
                      {metric.name}
                    </Button>
                  );
                })}
            </div>
          </Field>
        ) : null}
      </div>

      <Field label="Notes" hint="Optional context for whoever reads this later.">
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2 border-t border-border pt-5">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
