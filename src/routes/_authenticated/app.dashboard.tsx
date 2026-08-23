import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Compass } from "lucide-react";

import { LoopDiagram } from "@/components/business-os/loop-diagram";
import {
  EmptyState,
  MeterRow,
  PageHeader,
  SectionLabel,
  StatBlock,
} from "@/components/business-os/primitives";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { getBrainSnapshot } from "@/lib/brain.functions";

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Business OS" },
      {
        name: "description",
        content:
          "What matters in your business today: health, the biggest opportunity, the biggest risk and the recommended next action.",
      },
      { property: "og:title", content: "Dashboard — Business OS" },
      {
        property: "og:description",
        content: "Business health, top opportunity, top risk and the next recommended action.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardPage() {
  const { activeBusiness } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const fetchSnapshot = useServerFn(getBrainSnapshot);

  const snapshotQuery = useQuery({
    queryKey: ["brain", businessId],
    queryFn: () => fetchSnapshot({ data: { businessId: businessId! } }),
    enabled: businessId !== null,
  });

  const totals = snapshotQuery.data?.totals;
  const hasBrain = (totals?.facts ?? 0) > 0;
  const coverage = totals && hasBrain ? Math.min(100, Math.round((totals.facts / 60) * 100)) : null;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Today"
        title={greeting()}
        subtitle={
          activeBusiness
            ? `Here's what matters in ${activeBusiness.name} today. This brief grows sharper as your Brain fills in.`
            : "Here's what matters in your business today. Once your Business Brain exists, this page leads with health, your biggest opportunity, your biggest risk and one recommended action."
        }
        actions={
          <Button asChild>
            <Link to="/app/interview">
              {hasBrain ? "Continue discovery" : "Start Business Discovery"}
            </Link>
          </Button>
        }
      />

      {hasBrain && totals ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatBlock
            label="Facts captured"
            value={String(totals.facts)}
            caption="Everything the Brain holds."
          />
          <StatBlock
            label="Verified"
            value={String(totals.verified)}
            caption="Confirmed by you."
          />
          <StatBlock
            label="Inferred"
            value={String(totals.inferred)}
            caption="Derived, awaiting confirmation."
          />
          <StatBlock
            label="Avg confidence"
            value={`${totals.averageConfidence}%`}
            caption="How strongly facts are supported."
          />
        </section>
      ) : (
        <EmptyState
          icon={Compass}
          title="There's nothing to report yet"
          body="Business OS won't guess. Complete your first discovery session and this becomes a daily brief on what changed, what's working and what to do next."
          primary={{ label: "Start Business Discovery", to: "/app/interview" }}
          secondary={{ label: "Create a business", to: "/business/new" }}
        />
      )}

      <section>
        <SectionLabel aside={hasBrain ? "Live" : "Not yet measured"}>Brain health</SectionLabel>
        <div className="grid gap-5 rounded-xl border border-border bg-card p-6 shadow-quiet sm:grid-cols-2">
          <MeterRow label="Coverage" value={coverage} hint="How much of the business is mapped." />
          <MeterRow
            label="Confidence"
            value={hasBrain && totals ? totals.averageConfidence : null}
            hint="How strongly each fact is supported."
          />
          <MeterRow
            label="Verified"
            value={hasBrain && totals ? Math.round((totals.verified / totals.facts) * 100) : null}
            hint="Facts you have personally confirmed."
          />
          <MeterRow
            label="Evidence"
            value={snapshotQuery.data ? snapshotQuery.data.evidence.length : null}
            hint="Answers and documents backing the Brain."
          />
        </div>
      </section>

      <section>
        <SectionLabel aside="Business → Interview → Brain → Diagnosis → Blueprint → Action → Learning">
          Where you are in the loop
        </SectionLabel>
        <LoopDiagram current={hasBrain ? "brain" : "onboarding"} variant="compact" />
      </section>
    </div>
  );
}
