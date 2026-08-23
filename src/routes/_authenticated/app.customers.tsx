import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { AwaitingData } from "@/components/business-os/awaiting-data";

export const Route = createFileRoute("/app/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Business OS" },
      {
        name: "description",
        content:
          "Segments, lifetime value and purchase history, with best, at-risk and reactivation opportunities identified.",
      },
      { property: "og:title", content: "Customers — Business OS" },
      {
        property: "og:description",
        content: "Segments, lifetime value, at-risk customers and reactivation opportunities.",
      },
    ],
  }),
  component: () => (
    <AwaitingData
      eyebrow="Operate"
      title="Customers"
      subtitle="Segment, lifetime value, first and last purchase, and source. Over time Business OS flags your best customers, who is drifting away and where upsell or reactivation is worth the effort."
      icon={Users}
      emptyTitle="No customers recorded"
      emptyBody="Customer records can be imported or created once your business exists. Until then, the discovery interview captures how your customer base behaves in aggregate."
    />
  ),
});
