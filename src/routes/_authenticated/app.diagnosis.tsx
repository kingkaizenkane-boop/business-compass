import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";

import { EmptyState, PageHeader, SectionLabel } from "@/components/business-os/primitives";
import { DIAGNOSIS_CATEGORIES } from "@/lib/business-os";

export const Route = createFileRoute("/app/diagnosis")({
  head: () => ({
    meta: [
      { title: "Business Diagnosis — Business OS" },
      {
        name: "description",
        content:
          "Where your biggest opportunities and constraints are right now, scored by category with the evidence behind each score.",
      },
      { property: "og:title", content: "Business Diagnosis — Business OS" },
      {
        property: "og:description",
        content: "Scored constraints and ranked opportunities, with the evidence behind each score.",
      },
    ],
  }),
  component: DiagnosisPage,
});

function DiagnosisPage() {
  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Diagnosis"
        title="Your Business Diagnosis"
        subtitle="Where your biggest opportunities and constraints are right now. Each score shows its trend, its confidence and the reasoning behind it — nothing is scored without evidence in your Brain."
      />

      <section>
        <SectionLabel aside="Scores appear once the Brain has enough coverage">
          Categories assessed
        </SectionLabel>
        <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {DIAGNOSIS_CATEGORIES.map((category) => (
            <li key={category} className="flex items-baseline justify-between gap-4 bg-card p-5">
              <span className="text-sm text-foreground">{category}</span>
              <span className="numeric text-sm text-muted-foreground">—</span>
            </li>
          ))}
        </ol>
      </section>

      <EmptyState
        icon={Activity}
        title="No diagnosis yet"
        body="A diagnosis is only as honest as the information behind it. Once your Business Brain reaches sufficient coverage and confidence, Business OS scores each area and ranks your opportunities by impact, urgency and confidence."
        primary={{ label: "Start Business Discovery", to: "/app/interview" }}
        secondary={{ label: "Review the Brain", to: "/app/brain" }}
      />
    </div>
  );
}
