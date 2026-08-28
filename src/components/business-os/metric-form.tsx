import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type MetricLinkOptions = {
  goals: Array<{ id: string; name: string }>;
  tasks: Array<{ id: string; title: string }>;
  processes: Array<{ id: string; name: string }>;
  diagnosisItems: Array<{ id: string; title: string }>;
};

export type MetricFormValues = {
  name: string;
  category: string | null;
  unit: string | null;
  description: string | null;
  rationale: string | null;
  direction: "higher_is_better" | "lower_is_better" | "target_range";
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "custom";
  baselineValue: number | null;
  targetValue: number | null;
  goalId: string | null;
  diagnosisItemId: string | null;
  taskId: string | null;
  processId: string | null;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

function toNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Metric definition editor: used for creation and for editing an existing metric. */
export function MetricForm({
  options,
  pending,
  initial,
  submitLabel = "Save metric",
  onSubmit,
}: {
  options: MetricLinkOptions;
  pending: boolean;
  initial?: Partial<MetricFormValues>;
  submitLabel?: string;
  onSubmit: (values: MetricFormValues) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [rationale, setRationale] = useState(initial?.rationale ?? "");
  const [direction, setDirection] = useState<MetricFormValues["direction"]>(
    initial?.direction ?? "higher_is_better",
  );
  const [frequency, setFrequency] = useState<MetricFormValues["frequency"]>(
    initial?.frequency ?? "monthly",
  );
  const [baseline, setBaseline] = useState(
    initial?.baselineValue != null ? String(initial.baselineValue) : "",
  );
  const [target, setTarget] = useState(
    initial?.targetValue != null ? String(initial.targetValue) : "",
  );
  const [goalId, setGoalId] = useState(initial?.goalId ?? "");
  const [diagnosisItemId, setDiagnosisItemId] = useState(initial?.diagnosisItemId ?? "");
  const [taskId, setTaskId] = useState(initial?.taskId ?? "");
  const [processId, setProcessId] = useState(initial?.processId ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (name.trim().length < 2) {
      setError("Give the metric a name.");
      return;
    }
    if (baseline.trim() !== "" && toNumber(baseline) === null) {
      setError("Baseline must be a number.");
      return;
    }
    if (target.trim() !== "" && toNumber(target) === null) {
      setError("Target must be a number.");
      return;
    }
    setError(null);
    onSubmit({
      name: name.trim(),
      category: category.trim() || null,
      unit: unit.trim() || null,
      description: description.trim() || null,
      rationale: rationale.trim() || null,
      direction,
      frequency,
      baselineValue: toNumber(baseline),
      targetValue: toNumber(target),
      goalId: goalId || null,
      diagnosisItemId: diagnosisItemId || null,
      taskId: taskId || null,
      processId: processId || null,
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-quiet">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="metric-name">Metric name</Label>
          <Input
            id="metric-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Weekday revenue"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="metric-category">Category</Label>
          <Input
            id="metric-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="revenue"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="metric-unit">Unit</Label>
          <Input
            id="metric-unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="₦ / hours / %"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="metric-direction">Direction</Label>
          <select
            id="metric-direction"
            className={`${selectClass} mt-1.5`}
            value={direction}
            onChange={(event) => setDirection(event.target.value as MetricFormValues["direction"])}
          >
            <option value="higher_is_better">Higher is better</option>
            <option value="lower_is_better">Lower is better</option>
            <option value="target_range">Target range</option>
          </select>
        </div>
        <div>
          <Label htmlFor="metric-frequency">Frequency</Label>
          <select
            id="metric-frequency"
            className={`${selectClass} mt-1.5`}
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as MetricFormValues["frequency"])}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div>
          <Label htmlFor="metric-baseline">Baseline</Label>
          <Input
            id="metric-baseline"
            value={baseline}
            inputMode="decimal"
            onChange={(event) => setBaseline(event.target.value)}
            placeholder="420000"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="metric-target">Target</Label>
          <Input
            id="metric-target"
            value={target}
            inputMode="decimal"
            onChange={(event) => setTarget(event.target.value)}
            placeholder="600000"
            className="mt-1.5"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="metric-rationale">Why are we tracking this?</Label>
          <Textarea
            id="metric-rationale"
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            placeholder="Weekday capacity is the binding constraint identified in the diagnosis."
            className="mt-1.5"
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="metric-description">Definition</Label>
          <Textarea
            id="metric-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Total revenue booked Monday to Thursday, excluding deposits."
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="metric-goal">Business goal</Label>
          <select
            id="metric-goal"
            className={`${selectClass} mt-1.5`}
            value={goalId}
            onChange={(event) => setGoalId(event.target.value)}
          >
            <option value="">Not linked</option>
            {options.goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="metric-diagnosis">Diagnosis finding</Label>
          <select
            id="metric-diagnosis"
            className={`${selectClass} mt-1.5`}
            value={diagnosisItemId}
            onChange={(event) => setDiagnosisItemId(event.target.value)}
          >
            <option value="">Not linked</option>
            {options.diagnosisItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="metric-task">Action plan item</Label>
          <select
            id="metric-task"
            className={`${selectClass} mt-1.5`}
            value={taskId}
            onChange={(event) => setTaskId(event.target.value)}
          >
            <option value="">Not linked</option>
            {options.tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="metric-process">Process</Label>
          <select
            id="metric-process"
            className={`${selectClass} mt-1.5`}
            value={processId}
            onChange={(event) => setProcessId(event.target.value)}
          >
            <option value="">Not linked</option>
            {options.processes.map((process) => (
              <option key={process.id} value={process.id}>
                {process.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <div className="mt-6 flex items-center gap-2 border-t border-border pt-5">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <p className="text-xs text-muted-foreground">
          A metric without a link still works, but Business OS cannot explain why it matters.
        </p>
      </div>
    </div>
  );
}
