import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  FlaskConical,
  Pause,
  Play,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AutonomyBadge, PageHeader, SectionLabel } from "@/components/business-os/primitives";
import { formatMetricValue } from "@/components/business-os/metric-format";
import { getProcessMetrics } from "@/lib/metrics.functions";
import { draftExperiment } from "@/lib/experiments.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/hooks/use-workspace";
import type { AutonomyLevel } from "@/lib/business-os";
import { AUTONOMY_LABEL } from "@/lib/business-os";
import {
  controlExecution,
  decideProcessApproval,
  duplicateProcessDefinition,
  getProcess,
  runProcess,
  saveProcessDefinition,
  setProcessLifecycle,
} from "@/lib/process.functions";

export const Route = createFileRoute("/_authenticated/app/operations/$processId")({
  head: () => ({
    meta: [
      { title: "Process detail — Business OS" },
      {
        name: "description",
        content:
          "The full definition of one business process: trigger, steps, owners, autonomy, approvals, runs, evidence and version history.",
      },
      { property: "og:title", content: "Process detail — Business OS" },
      {
        property: "og:description",
        content: "Trigger, steps, owners, autonomy, approvals, runs and evidence for one process.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProcessDetailPage,
});

const STEP_TYPES = [
  "action",
  "decision",
  "wait",
  "approval",
  "notification",
  "data_capture",
  "ai_generation",
  "integration",
  "end",
] as const;
const OWNER_TYPES = ["human", "ai", "hybrid", "system"] as const;
const TRIGGER_TYPES = [
  "manual",
  "scheduled",
  "event",
  "inbound_lead",
  "customer_action",
  "metric_threshold",
  "ai_recommendation",
] as const;

const STEP_LABEL: Record<string, string> = {
  action: "Action",
  decision: "Decision",
  wait: "Wait",
  approval: "Approval",
  notification: "Notification",
  data_capture: "Data capture",
  ai_generation: "AI drafting",
  integration: "Integration",
  end: "End",
};

type DraftStep = {
  name: string;
  description: string | null;
  stepType: (typeof STEP_TYPES)[number];
  ownerType: (typeof OWNER_TYPES)[number];
  autonomyLevel: number;
  input: string;
  output: string;
  condition: string;
  estimatedMinutes: number | null;
  required: boolean;
};

function label(value: string) {
  return value.replace(/_/g, " ");
}

function ProcessDetailPage() {
  const { processId } = Route.useParams();
  const { activeBusiness } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const draft = useServerFn(draftExperiment);

  const fetchProcess = useServerFn(getProcess);
  const save = useServerFn(saveProcessDefinition);
  const lifecycle = useServerFn(setProcessLifecycle);
  const duplicate = useServerFn(duplicateProcessDefinition);
  const start = useServerFn(runProcess);
  const control = useServerFn(controlExecution);
  const decide = useServerFn(decideProcessApproval);

  const queryKey = ["process", businessId, processId];
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchProcess({ data: { businessId: businessId!, processId } }),
    enabled: businessId !== null,
  });

  const fetchProcessMetrics = useServerFn(getProcessMetrics);
  const { data: processMetrics } = useQuery({
    queryKey: ["process-metrics", businessId, processId],
    queryFn: () => fetchProcessMetrics({ data: { businessId: businessId!, processId } }),
    enabled: businessId !== null,
  });

  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [meta, setMeta] = useState({
    name: "",
    purpose: "",
    successDefinition: "",
    triggerType: "manual" as (typeof TRIGGER_TYPES)[number],
    triggerDescription: "",
    autonomyLevel: 1,
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    const p = data.process;
    setSteps(
      p.steps.map((s) => ({
        name: s.name,
        description: s.description,
        stepType: s.stepType,
        ownerType: s.ownerType,
        autonomyLevel: s.autonomyLevel,
        input: String(s.inputDefinition["description"] ?? ""),
        output: String(s.outputDefinition["description"] ?? ""),
        condition: String(s.conditionDefinition["description"] ?? ""),
        estimatedMinutes: s.estimatedMinutes,
        required: s.required,
      })),
    );
    setMeta({
      name: p.name,
      purpose: p.purpose ?? "",
      successDefinition: p.successDefinition ?? "",
      triggerType: p.triggerType,
      triggerDescription: String(p.triggerDefinition["description"] ?? ""),
      autonomyLevel: p.autonomyLevel,
    });
    setDirty(false);
  }, [data]);

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          businessId: businessId!,
          processId,
          patch: {
            name: meta.name,
            purpose: meta.purpose,
            successDefinition: meta.successDefinition,
            triggerType: meta.triggerType,
            triggerDescription: meta.triggerDescription,
            autonomyLevel: meta.autonomyLevel,
          },
          steps: steps.map((s) => ({ ...s })),
        },
      }),
    onSuccess: (result) => {
      setDirty(false);
      if (result.newVersion) {
        toast.success("Saved as a new version. The running version was left untouched.");
        void navigate({ to: "/app/operations/$processId", params: { processId: result.processId } });
      } else {
        toast.success("Process saved.");
        void refresh();
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lifecycleMutation = useMutation({
    mutationFn: (status: "active" | "paused" | "archived") =>
      lifecycle({ data: { businessId: businessId!, processId, status } }),
    onSuccess: () => {
      toast.success("Process updated.");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runMutation = useMutation({
    mutationFn: () => start({ data: { businessId: businessId!, processId } }),
    onSuccess: (execution) => {
      toast.success(
        execution.status === "approval_required"
          ? "Run stopped for your approval."
          : `Run ${label(execution.status)}.`,
      );
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const controlMutation = useMutation({
    mutationFn: (input: { executionId: string; action: "resume" | "pause" | "cancel" }) =>
      control({ data: { businessId: businessId!, ...input } }),
    onSuccess: () => {
      toast.success("Run updated.");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approvalMutation = useMutation({
    mutationFn: (input: { approvalId: string; decision: "approve" | "reject" | "pause" }) =>
      decide({ data: { businessId: businessId!, ...input } }),
    onSuccess: () => {
      toast.success("Decision recorded.");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => duplicate({ data: { businessId: businessId!, processId } }),
    onSuccess: (result) => {
      toast.success("Process duplicated as a draft.");
      void navigate({ to: "/app/operations/$processId", params: { processId: result.processId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-2 text-sm text-muted-foreground">Loading process…</div>;
  if (error || !data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {(error as Error | null)?.message ?? "This process could not be loaded."}
        </p>
        <Button variant="outline" asChild>
          <Link to="/app/operations">Back to operations</Link>
        </Button>
      </div>
    );
  }

  const process = data.process;
  const pendingApprovals = data.approvals.filter((a) => a.status === "pending");

  const updateStep = (index: number, patch: Partial<DraftStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    setDirty(true);
  };
  const moveStep = (index: number, delta: number) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item!);
      return next;
    });
    setDirty(true);
  };

  return (
    <div className="space-y-10">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/app/operations">
          <ArrowLeft className="mr-2 h-4 w-4" /> Operations
        </Link>
      </Button>

      <PageHeader
        eyebrow={`Process · v${process.version} · ${label(process.status)}`}
        title={process.name}
        {...(process.purpose ? { subtitle: process.purpose } : {})}
        actions={
          <>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending}
              variant={dirty ? "default" : "outline"}
            >
              <Save className="mr-2 h-4 w-4" />
              {process.status === "active" ? "Save as new version" : "Save draft"}
            </Button>
            {process.status === "active" ? (
              <>
                <Button variant="outline" onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
                  <Play className="mr-2 h-4 w-4" /> Run now
                </Button>
                <Button variant="outline" onClick={() => lifecycleMutation.mutate("paused")}>
                  <Pause className="mr-2 h-4 w-4" /> Pause
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => lifecycleMutation.mutate("active")}>
                <Play className="mr-2 h-4 w-4" /> Activate
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              <FlaskConical className="mr-2 h-4 w-4" /> Test this process
            </Button>
            <Button variant="ghost" onClick={() => duplicateMutation.mutate()}>
              <Copy className="mr-2 h-4 w-4" /> Duplicate
            </Button>
            {process.status !== "archived" ? (
              <Button variant="ghost" onClick={() => lifecycleMutation.mutate("archived")}>
                Archive
              </Button>
            ) : null}
          </>
        }
      />

      {/* ------------------------------------------------- overview / trigger */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <SectionLabel>Definition</SectionLabel>
          <div className="space-y-3">
            <div>
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={meta.name}
                onChange={(e) => {
                  setMeta({ ...meta, name: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
            <div>
              <Label htmlFor="p-purpose">Purpose — the outcome this repeatedly produces</Label>
              <Textarea
                id="p-purpose"
                value={meta.purpose}
                rows={3}
                onChange={(e) => {
                  setMeta({ ...meta, purpose: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
            <div>
              <Label htmlFor="p-success">Success criteria</Label>
              <Textarea
                id="p-success"
                value={meta.successDefinition}
                rows={2}
                onChange={(e) => {
                  setMeta({ ...meta, successDefinition: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Trigger</Label>
                <Select
                  value={meta.triggerType}
                  onValueChange={(v) => {
                    setMeta({ ...meta, triggerType: v as (typeof TRIGGER_TYPES)[number] });
                    setDirty(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {label(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Autonomy (enforced ceiling for every step)</Label>
                <Select
                  value={String(meta.autonomyLevel)}
                  onValueChange={(v) => {
                    setMeta({ ...meta, autonomyLevel: Number(v) });
                    setDirty(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {([0, 1, 2, 3, 4] as AutonomyLevel[]).map((l) => (
                      <SelectItem key={l} value={String(l)}>
                        L{l} — {AUTONOMY_LABEL[l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="p-trigger">When exactly does this start?</Label>
              <Input
                id="p-trigger"
                value={meta.triggerDescription}
                onChange={(e) => {
                  setMeta({ ...meta, triggerDescription: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <SectionLabel>Owner &amp; autonomy</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-muted-foreground">
                Owner: {process.ownerType}
              </Badge>
              <AutonomyBadge level={Math.min(process.autonomyLevel, 4) as AutonomyLevel} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              No step that leaves your business runs on its own in this release. Business OS prepares
              the work and stops for your approval.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <SectionLabel>Version history</SectionLabel>
            <ul className="space-y-2 text-sm">
              {data.versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <Link
                    to="/app/operations/$processId"
                    params={{ processId: v.id }}
                    className={v.id === process.id ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}
                  >
                    Version {v.version}
                  </Link>
                  <Badge variant="outline" className="text-muted-foreground">
                    {label(v.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <SectionLabel>Outcomes</SectionLabel>
            <dl className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>
                <dt className="eyebrow">Runs</dt>
                <dd className="numeric mt-1 text-foreground">{process.stats.runs}</dd>
              </div>
              <div>
                <dt className="eyebrow">Success</dt>
                <dd className="numeric mt-1 text-foreground">
                  {process.stats.successRate === null ? "—" : `${process.stats.successRate}%`}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Failed</dt>
                <dd className="numeric mt-1 text-foreground">{process.stats.failed}</dd>
              </div>
            </dl>

            {processMetrics && processMetrics.length > 0 ? (
              <ul className="mt-5 space-y-3 border-t border-border pt-4">
                {processMetrics.map((metric) => (
                  <li key={metric.id}>
                    <Link
                      to="/app/metrics/$metricId"
                      params={{ metricId: metric.id }}
                      className="block text-xs hover:text-primary"
                    >
                      <span className="text-foreground">{metric.name}</span>
                      <span className="mt-1 block text-muted-foreground">
                        {formatMetricValue(metric.currentValue, metric.unit)} · {metric.trendLabel}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                No business metric is attached to this process yet, so its business impact cannot be
                measured — only its run reliability.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- builder */}
      <section>
        <SectionLabel aside="Reorder, edit or remove steps, then save">Steps</SectionLabel>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="numeric w-6 text-sm text-muted-foreground">{index + 1}</span>
                <Input
                  value={step.name}
                  onChange={(e) => updateStep(index, { name: e.target.value })}
                  className="min-w-[14rem] flex-1"
                />
                <Select
                  value={step.stepType}
                  onValueChange={(v) => updateStep(index, { stepType: v as DraftStep["stepType"] })}
                >
                  <SelectTrigger className="w-[9.5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STEP_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {STEP_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={step.ownerType}
                  onValueChange={(v) => updateStep(index, { ownerType: v as DraftStep["ownerType"] })}
                >
                  <SelectTrigger className="w-[7.5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {label(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(step.autonomyLevel)}
                  onValueChange={(v) => updateStep(index, { autonomyLevel: Number(v) })}
                >
                  <SelectTrigger className="w-[5.5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4].map((l) => (
                      <SelectItem key={l} value={String(l)}>
                        L{l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="ml-auto flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => moveStep(index, -1)} aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => moveStep(index, 1)} aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete step"
                    onClick={() => {
                      setSteps((prev) => prev.filter((_, i) => i !== index));
                      setDirty(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Input
                  placeholder="Input needed"
                  value={step.input}
                  onChange={(e) => updateStep(index, { input: e.target.value })}
                />
                <Input
                  placeholder="Output produced"
                  value={step.output}
                  onChange={(e) => updateStep(index, { output: e.target.value })}
                />
                <Input
                  placeholder="Condition / exception path"
                  value={step.condition}
                  onChange={(e) => updateStep(index, { condition: e.target.value })}
                />
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={() => {
              setSteps((prev) => [
                ...prev,
                {
                  name: "New step",
                  description: null,
                  stepType: "action",
                  ownerType: "human",
                  autonomyLevel: 1,
                  input: "",
                  output: "",
                  condition: "",
                  estimatedMinutes: null,
                  required: true,
                },
              ]);
              setDirty(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add step
          </Button>
        </div>
      </section>

      {/* ------------------------------------------------- approvals */}
      {pendingApprovals.length > 0 ? (
        <section>
          <SectionLabel>Waiting on your decision</SectionLabel>
          <div className="space-y-3">
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="rounded-xl border border-caution/40 bg-caution/5 p-5">
                <h3 className="text-base font-medium text-foreground">{approval.title}</h3>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
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
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => approvalMutation.mutate({ approvalId: approval.id, decision: "approve" })}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => approvalMutation.mutate({ approvalId: approval.id, decision: "pause" })}>
                    Pause
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => approvalMutation.mutate({ approvalId: approval.id, decision: "reject" })}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------- evidence */}
      <section className="rounded-xl border border-border bg-card p-5">
        <SectionLabel>Why Business OS created this process</SectionLabel>
        {process.evidence.rationale ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{process.evidence.rationale}</p>
        ) : (
          <p className="text-sm text-muted-foreground">This process was created manually.</p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="eyebrow">Diagnosis findings</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {process.evidence.diagnosisTitles.length > 0 ? (
                process.evidence.diagnosisTitles.map((t) => <li key={t}>· {t}</li>)
              ) : (
                <li>—</li>
              )}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Blueprint sections</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {process.evidence.blueprintSections.length > 0 ? (
                process.evidence.blueprintSections.map((t) => <li key={t}>· {t}</li>)
              ) : (
                <li>—</li>
              )}
            </ul>
            {process.evidence.blueprintVersion !== null ? (
              <p className="mt-2 text-xs text-muted-foreground">Blueprint v{process.evidence.blueprintVersion}</p>
            ) : null}
          </div>
        </div>
        {process.evidence.actionTitle ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <span className="eyebrow mr-2">Source action</span>
            {process.evidence.actionTitle}
          </p>
        ) : null}
        {process.evidence.facts.length > 0 ? (
          <div className="mt-4">
            <p className="eyebrow">Business Brain facts</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {process.evidence.facts.map((fact) => (
                <li key={fact.factId}>
                  · <span className="text-foreground">{fact.factKey}</span> ({fact.category}): {fact.value}
                  {fact.verified ? " — verified" : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------- runs */}
      <section>
        <SectionLabel aside="Each run stays attached to the version it ran under">Runs</SectionLabel>
        {data.executions.length === 0 ? (
          <p className="text-sm text-muted-foreground">This process has not run yet.</p>
        ) : (
          <div className="space-y-3">
            {data.executions.map((execution) => (
              <div key={execution.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      v{execution.processVersion} · {label(execution.status)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(execution.createdAt).toLocaleString()} · trigger: {execution.triggerSource}
                      {execution.durationMs !== null ? ` · ${Math.round(execution.durationMs / 100) / 10}s` : ""}
                    </p>
                  </div>
                  {["running", "waiting", "approval_required", "queued"].includes(execution.status) ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => controlMutation.mutate({ executionId: execution.id, action: "resume" })}
                      >
                        Resume
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => controlMutation.mutate({ executionId: execution.id, action: "cancel" })}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : null}
                </div>
                {execution.error ? (
                  <p className="mt-2 text-xs text-destructive">{execution.error}</p>
                ) : null}
                {execution.stepLog.length > 0 ? (
                  <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {execution.stepLog.map((entry, i) => (
                      <li key={`${execution.id}-${i}`}>
                        {entry.sequence}. {entry.name} — {label(entry.outcome)}
                        {entry.note ? ` (${entry.note})` : ""}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
