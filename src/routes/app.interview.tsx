import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, HelpCircle, PauseCircle, SkipForward } from "lucide-react";

import { PageHeader, SectionLabel } from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { INTERVIEW_STAGES } from "@/lib/business-os";

export const Route = createFileRoute("/app/interview")({
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
    ],
  }),
  component: InterviewPage,
});

function InterviewPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Business DNA"
        title="Let's understand your business."
        subtitle="I'll ask you a few questions about how your business works. You can pause at any time and continue later."
      />

      <section className="rounded-xl border border-border bg-card p-6 shadow-quiet">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="eyebrow">Stage 1 of {INTERVIEW_STAGES.length}</p>
            <p className="mt-1 text-base font-medium text-foreground">{INTERVIEW_STAGES[0]}</p>
          </div>
          <p className="text-xs text-muted-foreground">Not started — no time estimate yet</p>
        </div>
        <Progress value={0} className="mt-4 h-1.5" />
        <ul className="mt-5 flex flex-wrap gap-1.5">
          {INTERVIEW_STAGES.map((stage, i) => (
            <li key={stage}>
              <Badge
                variant="outline"
                className={
                  i === 0 ? "rounded-full border-primary/40 text-primary" : "rounded-full text-muted-foreground"
                }
              >
                {stage}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-xl border border-border bg-card p-6 shadow-quiet md:p-8"
      >
        <SectionLabel>Question</SectionLabel>
        <p className="text-xl leading-snug text-foreground md:text-2xl">
          How do most new customers currently find you?
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Answer in your own words. Follow-up questions adapt to what you say — there is no fixed
          question count and nothing here is a form.
        </p>

        <label htmlFor="dna-response" className="sr-only">
          Your answer
        </label>
        <Textarea
          id="dna-response"
          rows={5}
          disabled
          placeholder="Answering unlocks once your business and account are connected."
          className="mt-6 resize-none text-base"
        />

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button disabled>
            Continue
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button variant="outline" disabled>
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Button>
          <Button variant="ghost" disabled>
            <SkipForward className="size-4" aria-hidden />
            Skip for now
          </Button>
          <Button variant="ghost" disabled>
            <HelpCircle className="size-4" aria-hidden />
            I don't know
          </Button>
          <Button variant="ghost" disabled>
            Need to check
          </Button>
          <Button variant="ghost" disabled className="ml-auto">
            <PauseCircle className="size-4" aria-hidden />
            Pause interview
          </Button>
        </div>

        <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          Every meaningful answer saves automatically. If your connection drops, your answer is held
          locally and synced when you're back — responses are never lost to a failed AI call.
        </p>
      </motion.section>

      <section className="rounded-xl border border-dashed border-border bg-surface p-6">
        <SectionLabel aside="0 items">Needs your input</SectionLabel>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Anything you skip or need to look up is parked here as a pending item — figures like monthly
          revenue, average customer value or retention rate — so the interview never stalls on a number
          you don't have to hand.
        </p>
      </section>
    </div>
  );
}
