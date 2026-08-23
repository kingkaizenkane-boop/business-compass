import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { EmptyState, PageHeader, SectionLabel } from "@/components/business-os/primitives";

export const Route = createFileRoute("/app/seo")({
  head: () => ({
    meta: [
      { title: "SEO Engine — Business OS" },
      {
        name: "description",
        content:
          "Keyword opportunities, topic clusters and generated pages — built from your Business Brain and reviewed before publishing.",
      },
      { property: "og:title", content: "SEO Engine — Business OS" },
      {
        property: "og:description",
        content: "Keyword opportunities, clusters and reviewed page generation.",
      },
    ],
  }),
  component: SeoPage,
});

const CHECKS = [
  "Content quality",
  "Business relevance",
  "Search intent",
  "Uniqueness",
  "Internal linking",
  "Metadata",
  "Schema",
  "Canonical URL",
  "Indexability",
];

function SeoPage() {
  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Grow"
        title="SEO engine"
        subtitle="Pages are only generated where your Business Brain holds enough real information to support them — your services, your locations, your actual expertise. Nothing publishes without passing review."
      />

      <section>
        <SectionLabel>Quality gate</SectionLabel>
        <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {CHECKS.map((check) => (
            <li key={check} className="flex items-center justify-between gap-3 bg-card p-4 text-sm">
              <span className="text-foreground">{check}</span>
              <span className="text-xs text-muted-foreground">Required</span>
            </li>
          ))}
        </ul>
      </section>

      <EmptyState
        icon={Search}
        title="No SEO opportunities discovered yet"
        body="Keyword discovery runs against what you actually sell and where you sell it. Once your services and locations are known, opportunities are clustered, scored and turned into briefs you approve before anything is written."
        primary={{ label: "Start Business Discovery", to: "/app/interview" }}
        secondary={{ label: "Define your services", to: "/app/services" }}
        note="Pages for your business and pages that market Business OS itself are kept in separate datasets and never mixed."
      />
    </div>
  );
}
