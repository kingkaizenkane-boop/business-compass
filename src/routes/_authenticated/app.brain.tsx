import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Brain } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  ConfidenceBadge,
  EmptyState,
  MeterRow,
  PageHeader,
  SectionLabel,
  StatBlock,
  VerificationBadge,
} from "@/components/business-os/primitives";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/hooks/use-workspace";
import { getBrainSnapshot, verifyFact } from "@/lib/brain.functions";
import type { Confidence } from "@/lib/business-os";

export const Route = createFileRoute("/_authenticated/app/brain")({
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrainPage,
});

const CONFIDENCE_MAP: Record<string, Confidence> = {
  very_high: "high",
  high: "high",
  medium: "medium",
  low: "low",
  very_low: "low",
};

function BrainPage() {
  const { activeBusiness } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const fetchSnapshot = useServerFn(getBrainSnapshot);
  const verify = useServerFn(verifyFact);
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<string>("all");

  const snapshotQuery = useQuery({
    queryKey: ["brain", businessId],
    queryFn: () => fetchSnapshot({ data: { businessId: businessId! } }),
    enabled: businessId !== null,
  });

  const snapshot = snapshotQuery.data ?? null;
  const facts = snapshot?.facts ?? [];

  const mutation = useMutation({
    mutationFn: (input: { factId: string; verified: boolean }) => verify({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["brain", businessId] });
    },
    onError: () => toast.error("Could not update that fact"),
  });

  const categories = ["all", ...(snapshot?.categories.map((c) => c.category) ?? [])];
  const visible = category === "all" ? facts : facts.filter((f) => f.category === category);

  const totals = snapshot?.totals;
  const lastUpdated = facts[0]?.created_at
    ? new Date(facts[0].created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : "—";

  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Source of truth"
        title="Your Business Brain"
        subtitle="The system's current understanding of your business. Every fact carries a value, a source, a confidence level and a verification status — AI inference is never shown as fact."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock
          label="Verified facts"
          value={totals ? String(totals.verified) : "—"}
          caption="Confirmed by you or by evidence."
        />
        <StatBlock
          label="Inferred insights"
          value={totals ? String(totals.inferred) : "—"}
          caption="Derived, awaiting confirmation."
        />
        <StatBlock
          label="Total facts"
          value={totals ? String(totals.facts) : "—"}
          caption="Everything the Brain currently holds."
        />
        <StatBlock label="Last updated" value={lastUpdated} caption="Freshness feeds Brain health." />
      </section>

      <section>
        <SectionLabel aside={totals && totals.facts > 0 ? "Live" : "Not yet measured"}>
          Brain health
        </SectionLabel>
        <div className="grid gap-5 rounded-xl border border-border bg-card p-6 shadow-quiet sm:grid-cols-2">
          <MeterRow
            label="Coverage"
            value={totals && totals.facts > 0 ? Math.min(100, Math.round((totals.facts / 60) * 100)) : null}
          />
          <MeterRow label="Confidence" value={totals && totals.facts > 0 ? totals.averageConfidence : null} />
          <MeterRow
            label="Verified"
            value={totals && totals.facts > 0 ? Math.round((totals.verified / totals.facts) * 100) : null}
          />
          <MeterRow label="Evidence items" value={snapshot ? snapshot.evidence.length : null} />
        </div>
      </section>

      {facts.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="Your Business Brain is waiting to be built"
          body="Complete your first discovery session and we'll begin mapping your business — identity, customers, offers, operations, economics and the parts that depend entirely on you."
          primary={{ label: "Start Business Discovery", to: "/app/interview" }}
        />
      ) : (
        <>
          <section>
            <SectionLabel>Categories</SectionLabel>
            <Tabs value={category} onValueChange={setCategory}>
              <ScrollArea className="w-full">
                <TabsList className="w-max">
                  {categories.map((item) => (
                    <TabsTrigger key={item} value={item} className="capitalize">
                      {item === "all" ? "All" : item}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Tabs>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-quiet">
            <ul className="divide-y divide-border">
              {visible.map((fact) => (
                <li key={fact.id} className="flex flex-wrap items-start gap-3 p-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {fact.fact_key.replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {fact.value_text ?? (fact.value_number != null ? String(fact.value_number) : "—")}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="eyebrow capitalize">{fact.category}</span>
                      <ConfidenceBadge
                        confidence={
                          fact.fact_type === "inference" || fact.fact_type === "assumption"
                            ? "inferred"
                            : (CONFIDENCE_MAP[fact.confidence_level] ?? "medium")
                        }
                      />
                      <VerificationBadge state={fact.verified ? "verified" : "unverified"} />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={fact.verified ? "outline" : "default"}
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ factId: fact.id, verified: !fact.verified })}
                  >
                    {fact.verified ? "Unverify" : "Verify"}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className="rounded-xl border border-dashed border-border bg-surface p-6">
        <SectionLabel>How facts behave</SectionLabel>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Facts are versioned and always traceable to the answer they came from. Editing one never
          destroys history, and conflicting information is surfaced for you to resolve rather than
          silently overwritten.
        </p>
      </section>
    </div>
  );
}
