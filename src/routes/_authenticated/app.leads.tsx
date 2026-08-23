import { createFileRoute } from "@tanstack/react-router";
import { Compass } from "lucide-react";

import { AwaitingData } from "@/components/business-os/awaiting-data";

export const Route = createFileRoute("/_authenticated/app/leads")({
  head: () => ({
    meta: [
      { title: "Leads — Business OS" },
      {
        name: "description",
        content: "Track leads from new to won or lost, with source, value and follow-up notes.",
      },
      { property: "og:title", content: "Leads — Business OS" },
      { property: "og:description", content: "Leads by stage, source and value." },
    ],
  }),
  component: () => (
    <AwaitingData
      eyebrow="Operate"
      title="Leads"
      subtitle="New, contacted, qualified, proposal, won, lost — with source, value and notes. Response time here is one of the strongest predictors your diagnosis will use."
      icon={Compass}
      emptyTitle="No leads yet"
      emptyBody="Leads can be entered manually or arrive from your website and SEO pages once those are live. Their sources feed straight back into the Business Brain."
    />
  ),
});
