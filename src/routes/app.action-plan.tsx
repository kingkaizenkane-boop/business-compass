import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";

import {
  AutonomyBadge,
  EmptyState,
  PageHeader,
  SectionLabel,
} from "@/components/business-os/primitives";

export const Route = createFileRoute("/app/action-plan")({
  head: () => ({
    meta: [
      { title: "90-Day Action Plan — Business OS" },
      {
        name: "description",
        content:
          "Your diagnosis converted into sequenced actions across the next 90 days, each with impact, effort, owner and status.",
      },
      { property: "og:title", content: "90-Day Action Plan — Business OS" },
      {
        property: "og:description",
        content: "Sequenced actions for the next 90 days with impact, effort, owner and status.",
      },
    ],
  }),
  component: ActionPlanPage,
});

const HORIZONS = [
  { label: "Now", range: "Days 1–30", note: "Constraint removal and quick structural wins." },
  { label: "Next", range: "Days 31–60", note: "Systems, automation and offer changes." },
  { label: "Later", range: "Days 61–90", note: "Growth moves that depend on the earlier work." },
];

function ActionPlanPage() {
  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Execution"
        title="Your 90-day action plan"
        subtitle="Every action traces back to a diagnosed constraint and carries an expected impact, an effort estimate, an owner and a due date. Nothing changes in your business without your approval."
      />

      <section>
        <SectionLabel aside="No actions generated yet">Horizons</SectionLabel>
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-3">
          {HORIZONS.map((horizon) => (
            <div key={horizon.label} className="bg-card p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg text-foreground">{horizon.label}</h2>
                <span className="numeric text-xs text-muted-foreground">{horizon.range}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{horizon.note}</p>
              <p className="mt-6 rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                Empty
              </p>
            </div>
          ))}
        </div>
      </section>

      <EmptyState
        icon={ClipboardList}
        title="No plan to approve yet"
        body="The action plan is generated from your diagnosis, so it arrives after your Business Brain and diagnosis exist. Each action then moves through ready for approval, approved, in progress and measured."
        primary={{ label: "Start Business Discovery", to: "/app/interview" }}
        secondary={{ label: "See the diagnosis", to: "/app/diagnosis" }}
      />

      <section className="rounded-xl border border-dashed border-border bg-surface p-6">
        <SectionLabel>Autonomy</SectionLabel>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Every automated action states how much freedom it has. You can raise or lower these where
          policy allows.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          <li className="flex items-center gap-2 text-xs text-muted-foreground">
            Customer reminders <AutonomyBadge level={4} />
          </li>
          <li className="flex items-center gap-2 text-xs text-muted-foreground">
            Pricing changes <AutonomyBadge level={3} />
          </li>
          <li className="flex items-center gap-2 text-xs text-muted-foreground">
            Business diagnosis <AutonomyBadge level={1} />
          </li>
        </ul>
      </section>
    </div>
  );
}
