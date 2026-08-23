import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";

import { LoopDiagram } from "@/components/business-os/loop-diagram";
import {
  EmptyState,
  MeterRow,
  PageHeader,
  SectionLabel,
} from "@/components/business-os/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/dashboard")({
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
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Today"
        title={greeting()}
        subtitle="Here's what matters in your business today. Once your Business Brain exists, this page leads with health, your biggest opportunity, your biggest risk and one recommended action."
        actions={
          <Button asChild>
            <Link to="/app/interview">Start Business Discovery</Link>
          </Button>
        }
      />

      <EmptyState
        icon={Compass}
        title="There's nothing to report yet"
        body="Business OS won't guess. Complete your first discovery session and this becomes a daily brief on what changed, what's working and what to do next."
        primary={{ label: "Start Business Discovery", to: "/app/interview" }}
        secondary={{ label: "Create a business", to: "/business/new" }}
      />

      <section>
        <SectionLabel aside="Not yet measured">Brain health</SectionLabel>
        <div className="grid gap-5 rounded-xl border border-border bg-card p-6 shadow-quiet sm:grid-cols-2">
          <MeterRow label="Coverage" value={null} hint="How much of the business is mapped." />
          <MeterRow label="Confidence" value={null} hint="How strongly each fact is supported." />
          <MeterRow label="Verified" value={null} hint="Facts you have personally confirmed." />
          <MeterRow label="Freshness" value={null} hint="How current the understanding is." />
        </div>
      </section>

      <section>
        <SectionLabel aside="Business → Interview → Brain → Diagnosis → Blueprint → Action → Learning">
          Where you are in the loop
        </SectionLabel>
        <LoopDiagram current="onboarding" variant="compact" />
      </section>
    </div>
  );
}
