import { createFileRoute } from "@tanstack/react-router";

import {
  AutonomyBadge,
  PageHeader,
  SectionLabel,
} from "@/components/business-os/primitives";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Business OS" },
      {
        name: "description",
        content:
          "Business profile, team, permissions, AI autonomy levels, notifications, integrations and SEO configuration.",
      },
      { property: "og:title", content: "Settings — Business OS" },
      {
        property: "og:description",
        content: "Profile, team, permissions, AI autonomy, notifications and integrations.",
      },
    ],
  }),
  component: SettingsPage,
});

const GROUPS = [
  { label: "Business profile", note: "Name, industry, location, model, size." },
  { label: "Team", note: "Who has access to this business." },
  { label: "Permissions", note: "Who can verify facts and approve actions." },
  { label: "Notifications", note: "What you want to be told about, and how." },
  { label: "Integrations", note: "Connect the tools your business already runs on." },
  { label: "SEO", note: "Site, locations and publishing approval rules." },
  { label: "Billing", note: "Plan and invoices." },
];

const AUTONOMY_ROWS = [
  { label: "Business diagnosis", level: 1 as const },
  { label: "Fact extraction from interviews", level: 2 as const },
  { label: "Pricing changes", level: 3 as const },
  { label: "SEO publishing", level: 3 as const },
  { label: "Customer reminders", level: 4 as const },
];

function SettingsPage() {
  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        subtitle="How this business is described, who can act on it, and how much freedom the system has when it acts on your behalf."
      />

      <section>
        <SectionLabel aside="Editable once your business exists">Business</SectionLabel>
        <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {GROUPS.map((group) => (
            <li key={group.label} className="bg-card p-5">
              <p className="text-sm font-medium text-foreground">{group.label}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{group.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionLabel aside="Level 0 observe → level 4 autonomous">AI autonomy</SectionLabel>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {AUTONOMY_ROWS.map((row) => (
            <li key={row.label} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <span className="text-sm text-foreground">{row.label}</span>
              <AutonomyBadge level={row.level} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Anything that changes money, pricing, published content or client-facing commitments stays
          at approval-required or below by default.
        </p>
      </section>
    </div>
  );
}
