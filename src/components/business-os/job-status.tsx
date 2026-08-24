import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Loader2, PauseCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import { getJobStatus } from "@/lib/jobs.functions";
import { cn } from "@/lib/utils";

export type JobTypeFilter = "interview_extraction" | "diagnosis_run" | "blueprint_run" | "action_plan_run" | "process_generation";

/**
 * Live AI job state for a business. Polls while work is queued or running and
 * calls onSettled once a job reaches a terminal state so callers can refetch.
 */
export function useJobStatus(options: {
  businessId: string | null;
  jobTypes?: JobTypeFilter[];
  onSettled?: () => void;
}) {
  const fetchJobs = useServerFn(getJobStatus);
  const settledRef = useRef<Set<string>>(new Set());
  const onSettled = options.onSettled;

  const query = useQuery({
    queryKey: ["ai-jobs", options.businessId, options.jobTypes ?? "all"],
    queryFn: () =>
      fetchJobs({
        data: {
          businessId: options.businessId!,
          ...(options.jobTypes ? { jobTypes: options.jobTypes } : {}),
          limit: 8,
        },
      }),
    enabled: options.businessId !== null,
    refetchInterval: (q) => {
      const jobs = q.state.data?.jobs ?? [];
      return jobs.some((j) => j.status === "queued" || j.status === "running") ? 2500 : false;
    },
  });

  const jobs = query.data?.jobs ?? [];

  useEffect(() => {
    for (const job of jobs) {
      const terminal = job.status === "completed" || job.status === "failed" || job.status === "cancelled";
      if (terminal && !settledRef.current.has(`${job.id}:${job.status}`)) {
        settledRef.current.add(`${job.id}:${job.status}`);
        onSettled?.();
      }
    }
  }, [jobs, onSettled]);

  const active = jobs.find((j) => j.status === "running") ?? jobs.find((j) => j.status === "queued") ?? null;

  return { jobs, active, latest: jobs[0] ?? null, refetch: query.refetch };
}

export function JobStatusStrip({
  businessId,
  jobTypes,
  invalidateKeys,
  className,
}: {
  businessId: string | null;
  jobTypes?: JobTypeFilter[];
  invalidateKeys?: unknown[][];
  className?: string;
}) {
  const queryClient = useQueryClient();
  const { latest, active } = useJobStatus({
    businessId,
    ...(jobTypes ? { jobTypes } : {}),
    onSettled: () => {
      for (const key of invalidateKeys ?? []) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  const job = active ?? latest;
  if (!job) return null;

  const tone =
    job.status === "failed"
      ? "border-destructive/40 bg-destructive/5 text-destructive"
      : job.status === "cancelled"
        ? "border-border bg-muted/40 text-muted-foreground"
        : job.status === "completed"
          ? "border-border bg-muted/30 text-muted-foreground"
          : "border-primary/30 bg-primary/5 text-foreground";

  const Icon =
    job.status === "failed"
      ? AlertTriangle
      : job.status === "cancelled"
        ? PauseCircle
        : job.status === "completed"
          ? CheckCircle2
          : Loader2;

  const message =
    job.status === "failed"
      ? `${job.label} failed — ${job.errorMessage ?? "unknown error"}${job.attempts < job.maxAttempts ? " (will retry)" : ""}`
      : job.status === "cancelled"
        ? `${job.label} paused — ${job.errorMessage ?? "AI budget reached"}`
        : job.status === "completed"
          ? `${job.label} — done`
          : `${job.label}${job.progress ? ` — ${job.progress.toLowerCase()}` : ""}`;

  return (
    <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", tone, className)}>
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", (job.status === "queued" || job.status === "running") && "animate-spin")}
      />
      <span className="truncate">{message}</span>
      {job.attempts > 1 && job.status !== "completed" ? (
        <span className="ml-auto shrink-0 opacity-70">
          attempt {job.attempts}/{job.maxAttempts}
        </span>
      ) : null}
    </div>
  );
}
