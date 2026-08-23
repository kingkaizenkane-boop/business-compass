import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ArrowRight, HelpCircle, PauseCircle, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionLabel } from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/hooks/use-workspace";
import { getInterviewState, pauseInterview, submitInterviewResponse } from "@/lib/interview.functions";

export const Route = createFileRoute("/_authenticated/app/interview")({
  head: () => ({
    meta: [
      { title: "Business DNA Interview — Business OS" },
      {
        name: "description",
        content:
          "An adaptive conversation that maps how your business actually works. Pause any time and resume exactly where you stopped.",
      },
      { property: "og:title", content: "Business DNA Interview — Business OS" },
      {
        property: "og:description",
        content: "An adaptive interview that maps how your business actually works.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InterviewPage,
});

function InterviewPage() {
  const { activeBusiness, loading } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;

  const fetchState = useServerFn(getInterviewState);
  const submit = useServerFn(submitInterviewResponse);
  const pause = useServerFn(pauseInterview);
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState("");

  const stateQuery = useQuery({
    queryKey: ["interview", businessId],
    queryFn: () => fetchState({ data: { businessId: businessId! } }),
    enabled: businessId !== null,
  });

  const state = stateQuery.data ?? null;
  const question = state?.currentQuestion ?? null;

  useEffect(() => {
    setAnswer("");
  }, [question?.questionKey]);

  const mutation = useMutation({
    mutationFn: (action: "answer" | "skip" | "unknown" | "check") => {
      if (!businessId || !state || !question) throw new Error("Nothing to submit yet");
      return submit({
        data: {
          businessId,
          sessionId: state.sessionId,
          questionId: question.id,
          questionKey: question.questionKey,
          questionText: question.questionText,
          answer: action === "answer" ? answer : undefined,
          action,
        },
      });
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["interview", businessId], result.state);
      void queryClient.invalidateQueries({ queryKey: ["brain", businessId] });
      if (result.factsAdded > 0) {
        toast.success(`Saved — ${result.factsAdded} fact${result.factsAdded === 1 ? "" : "s"} added to your Brain`);
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save that answer"),
  });

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading your workspace…</p>;
  }

  if (!activeBusiness) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader
          eyebrow="Business DNA"
          title="Create a business first."
          subtitle="The interview writes into a specific business, so we need one before we can start."
        />
        <Button asChild>
          <a href="/business/new">Create a business</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Business DNA"
        title="Let's understand your business."
        subtitle="I'll ask you about how your business works. You can pause at any time and continue later — every answer is saved as you go."
      />

      <section className="rounded-xl border border-border bg-card p-6 shadow-quiet">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="eyebrow">
              {question
                ? `Stage ${question.stageSequence} of ${state?.stages.length ?? 16}`
                : "All stages covered"}
            </p>
            <p className="mt-1 text-base font-medium text-foreground">
              {question ? question.stageName : "Interview complete"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {state
              ? `${state.answeredCount} of ${state.totalQuestions} answered · ${state.coverageScore}% coverage`
              : "Loading…"}
          </p>
        </div>
        <Progress value={state?.progressPercent ?? 0} className="mt-4 h-1.5" />
        <ul className="mt-5 flex flex-wrap gap-1.5">
          {(state?.stages ?? []).map((stage) => (
            <li key={stage.stageKey}>
              <Badge
                variant="outline"
                className={
                  stage.stageKey === question?.stageKey
                    ? "rounded-full border-primary/40 text-primary"
                    : stage.total > 0 && stage.answered === stage.total
                      ? "rounded-full border-primary/20 text-foreground"
                      : "rounded-full text-muted-foreground"
                }
              >
                {stage.name}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      {question ? (
        <motion.section
          key={question.questionKey}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl border border-border bg-card p-6 shadow-quiet md:p-8"
        >
          <SectionLabel>Question</SectionLabel>
          <p className="text-xl leading-snug text-foreground md:text-2xl">{question.questionText}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {question.helpText ??
              "Answer in your own words — this is a conversation, not a form. Everything you say becomes structured facts you can review and correct."}
          </p>

          <label htmlFor="dna-response" className="sr-only">
            Your answer
          </label>
          <Textarea
            id="dna-response"
            rows={5}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Type your answer…"
            className="mt-6 resize-none text-base"
          />

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => mutation.mutate("answer")}
              disabled={mutation.isPending || answer.trim().length === 0}
            >
              {mutation.isPending ? "Saving…" : "Continue"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button variant="ghost" onClick={() => mutation.mutate("skip")} disabled={mutation.isPending}>
              <SkipForward className="size-4" aria-hidden />
              Skip for now
            </Button>
            <Button variant="ghost" onClick={() => mutation.mutate("unknown")} disabled={mutation.isPending}>
              <HelpCircle className="size-4" aria-hidden />
              I don't know
            </Button>
            <Button variant="ghost" onClick={() => mutation.mutate("check")} disabled={mutation.isPending}>
              Need to check
            </Button>
            <Button
              variant="ghost"
              className="ml-auto"
              disabled={mutation.isPending || !state}
              onClick={() => {
                if (!state) return;
                void pause({ data: { sessionId: state.sessionId } }).then(() =>
                  toast.success("Interview paused — resume any time"),
                );
              }}
            >
              <PauseCircle className="size-4" aria-hidden />
              Pause interview
            </Button>
          </div>

          <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            Every answer saves the moment you continue, and facts are extracted into your Business Brain
            where you can verify or correct them.
          </p>
        </motion.section>
      ) : (
        <section className="rounded-xl border border-border bg-card p-6 shadow-quiet md:p-8">
          <SectionLabel>Discovery complete</SectionLabel>
          <p className="text-xl leading-snug text-foreground">
            You've covered every stage of the interview.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Your Brain now holds what you told us. Review the facts, verify the ones that matter, then run
            a diagnosis.
          </p>
          <div className="mt-5 flex gap-2">
            <Button asChild>
              <a href="/app/brain">Review your Brain</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/app/diagnosis">Run diagnosis</a>
            </Button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-dashed border-border bg-surface p-6">
        <SectionLabel aside={`${state?.pending.length ?? 0} items`}>Needs your input</SectionLabel>
        {state && state.pending.length > 0 ? (
          <ul className="space-y-2 text-sm text-foreground">
            {state.pending.map((item) => (
              <li key={item.questionKey} className="flex items-start gap-2">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>
                  {item.questionText}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.status === "needs_verification" ? "to verify" : "to look up"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Anything you skip or need to look up is parked here as a pending item, so the interview never
            stalls on a number you don't have to hand.
          </p>
        )}
      </section>
    </div>
  );
}
