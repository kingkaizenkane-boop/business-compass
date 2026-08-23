import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/business-os/primitives";

export const Route = createFileRoute("/_authenticated/app/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Business OS" },
      {
        name: "description",
        content:
          "Told when it matters: your diagnosis is ready, items need your input, an experiment produced a result.",
      },
      { property: "og:title", content: "Notifications — Business OS" },
      { property: "og:description", content: "Alerts that matter to your business, not noise." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Attention"
        title="Notifications"
        subtitle="You'll hear from Business OS when your diagnosis is ready, when items need your input, when an SEO page passes review, when an experiment produces a result and when your Brain changes."
      />
      <EmptyState
        icon={Bell}
        title="Nothing needs your attention"
        body="This stays quiet on purpose. Notifications appear when something in your business actually changed or when the system needs a decision from you."
        primary={{ label: "Start Business Discovery", to: "/app/interview" }}
      />
    </div>
  );
}
