import { createFileRoute } from "@tanstack/react-router";
import { Brain } from "lucide-react";

import {
  ConfidenceBadge,
  EmptyState,
  MeterRow,
  PageHeader,
  SectionLabel,
  StatBlock,
  VerificationBadge,
} from "@/components/business-os/primitives";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BRAIN_CATEGORIES } from "@/lib/business-os";

export const Route = createFileRoute("/app/brain")({
  head: () => ({
    meta: [
      { title: "Business Brain — Business OS" },
      {
        name: "description",
        content:
          "The system's current understanding of your business: structured facts, evidence, confidence and open questions.",
      },
      { property: "og:title", content: "Business Brain — Business OS" },
      {
        property: "og:description",
        content: "Structured facts, evidence, confidence and open questions about your business.",
      },
    ],
  }),
  component: BrainPage,
});

function BrainPage() {
  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Source of truth"
        title="Your Business Brain"
        subtitle="The system's current understanding of your business. Every fact carries a value, a source, a confidence level and a verification status — AI inference is never shown as fact."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock label="Verified facts" value="—" caption="Confirmed by you or by evidence." />
        <StatBlock label="Inferred insights" value="—" caption="Derived, awaiting confirmation." />
        <StatBlock label="Open questions" value="—" caption="Gaps the Brain wants closed." />
        <StatBlock label="Last updated" value="—" caption="Freshness feeds Brain health." />
      </section>

      <section>
        <SectionLabel aside="Not yet measured">Brain health</SectionLabel>
        <div className="grid gap-5 rounded-xl border border-border bg-card p-6 shadow-quiet sm:grid-cols-2">
          <MeterRow label="Coverage" value={null} />
          <MeterRow label="Confidence" value={null} />
          <MeterRow label="Verified" value={null} />
          <MeterRow label="Freshness" value={null} />
        </div>
      </section>

      <section>
        <SectionLabel>Categories</SectionLabel>
        <Tabs defaultValue={BRAIN_CATEGORIES[0]}>
          <ScrollArea className="w-full">
            <TabsList className="w-max">
              {BRAIN_CATEGORIES.map((category) => (
                <TabsTrigger key={category} value={category}>
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Tabs>
      </section>

      <EmptyState
        icon={Brain}
        title="Your Business Brain is waiting to be built"
        body="Complete your first discovery session and we'll begin mapping your business — identity, customers, offers, operations, economics and the parts that depend entirely on you."
        primary={{ label: "Start Business Discovery", to: "/app/interview" }}
      />

      <section className="rounded-xl border border-dashed border-border bg-surface p-6">
        <SectionLabel>How a fact will read</SectionLabel>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-foreground">Monthly revenue</span>
          <span className="numeric text-sm text-muted-foreground">value pending</span>
          <ConfidenceBadge confidence="inferred" />
          <VerificationBadge state="unverified" />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Facts are versioned. Editing one never destroys history, and conflicting information is
          surfaced for you to resolve rather than silently overwritten.
        </p>
      </section>
    </div>
  );
}
