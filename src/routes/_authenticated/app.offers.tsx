import { createFileRoute } from "@tanstack/react-router";
import { Tags } from "lucide-react";

import { AwaitingData } from "@/components/business-os/awaiting-data";

export const Route = createFileRoute("/app/offers")({
  head: () => ({
    meta: [
      { title: "Offers — Business OS" },
      {
        name: "description",
        content:
          "Structured offers: target customer, problem, transformation, price, guarantee and differentiator.",
      },
      { property: "og:title", content: "Offers — Business OS" },
      {
        property: "og:description",
        content: "Structured offers with problem, transformation, price and guarantee.",
      },
    ],
  }),
  component: () => (
    <AwaitingData
      eyebrow="Grow"
      title="Offers"
      subtitle="An offer is more than a price. Each one names the customer, the problem, the transformation, the guarantee and what makes it different — and Business OS can propose new ones from your Brain."
      icon={Tags}
      emptyTitle="No offers built yet"
      emptyBody="Offer recommendations depend on knowing your customers and economics. Complete discovery and Business OS will suggest offers aimed at your specific constraint."
    />
  ),
});
