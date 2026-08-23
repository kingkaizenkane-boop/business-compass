import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { EmptyState, PageHeader, SectionLabel } from "@/components/business-os/primitives";
import { BLUEPRINT_SECTIONS } from "@/lib/business-os";

export const Route = createFileRoute("/_authenticated/app/blueprint")({
  head: () => ({
    meta: [
      { title: "Business Blueprint — Business OS" },
      {
        name: "description",
        content:
          "Your positioning, ideal customer, offer, pricing, acquisition, retention and operating model as one strategic document.",
      },
      { property: "og:title", content: "Business Blueprint — Business OS" },
      {
        property: "og:description",
        content: "Positioning, offer, acquisition, retention and operating model in one document.",
      },
    ],
  }),
  component: BlueprintPage,
});

function BlueprintPage() {
  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Strategy"
        title="Your Business Blueprint"
        subtitle="A working strategic document, not a business plan template. It is generated from your Business Brain, edited by you, and versioned every time it changes."
      />

      <section>
        <SectionLabel aside="Version history begins with your first blueprint">
          Sections
        </SectionLabel>
        <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {BLUEPRINT_SECTIONS.map((section, i) => (
            <li key={section} className="bg-card p-5">
              <div className="flex items-baseline gap-3">
                <span className="numeric text-xs text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium text-foreground">{section}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Awaiting Brain coverage</p>
            </li>
          ))}
        </ol>
      </section>

      <EmptyState
        icon={FileText}
        title="Your blueprint hasn't been written yet"
        body="Business OS drafts the blueprint from what it knows about your customers, your offer and your operating constraints. That means discovery comes first."
        primary={{ label: "Start Business Discovery", to: "/app/interview" }}
        secondary={{ label: "See the diagnosis", to: "/app/diagnosis" }}
      />
    </div>
  );
}
