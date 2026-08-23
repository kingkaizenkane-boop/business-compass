import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";

import { AwaitingData } from "@/components/business-os/awaiting-data";

export const Route = createFileRoute("/_authenticated/app/services")({
  head: () => ({
    meta: [
      { title: "Services — Business OS" },
      {
        name: "description",
        content:
          "Your services and products with pricing, duration, capacity and cost, connected to revenue and demand.",
      },
      { property: "og:title", content: "Services — Business OS" },
      {
        property: "og:description",
        content: "Services and products with pricing, duration, capacity and cost.",
      },
    ],
  }),
  component: () => (
    <AwaitingData
      eyebrow="Operate"
      title="Services"
      subtitle="Price, duration, capacity, cost and status for everything you sell. These records connect your customers, offers, revenue and SEO to the same underlying catalogue."
      icon={Package}
      emptyTitle="No services defined"
      emptyBody="Your primary services are captured during onboarding and refined in the interview, then editable here with full pricing and capacity detail."
    />
  ),
});
