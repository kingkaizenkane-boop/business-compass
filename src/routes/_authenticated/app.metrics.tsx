import { createFileRoute } from "@tanstack/react-router";
import { Gauge } from "lucide-react";

import { AwaitingData } from "@/components/business-os/awaiting-data";

export const Route = createFileRoute("/_authenticated/app/metrics")({
  head: () => ({
    meta: [
      { title: "Metrics — Business OS" },
      {
        name: "description",
        content:
          "The handful of numbers that describe your business, tracked against a baseline with a weekly intelligence read.",
      },
      { property: "og:title", content: "Metrics — Business OS" },
      {
        property: "og:description",
        content: "Business metrics tracked against a baseline, with weekly intelligence.",
      },
    ],
  }),
  component: () => (
    <AwaitingData
      eyebrow="Measure"
      title="Metrics"
      subtitle="Only metrics that answer a question about your business. Each one is tracked against a baseline so the weekly intelligence read can say what changed and why it probably changed."
      icon={Gauge}
      emptyTitle="Nothing measured yet"
      emptyBody="Metrics are defined from your goals and your diagnosis, so they arrive with the blueprint. Once they exist, the weekly report covers what improved, what declined and what needs attention."
    />
  ),
});
