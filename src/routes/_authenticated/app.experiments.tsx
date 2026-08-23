import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";

import { AwaitingData } from "@/components/business-os/awaiting-data";

export const Route = createFileRoute("/_authenticated/app/experiments")({
  head: () => ({
    meta: [
      { title: "Experiments — Business OS" },
      {
        name: "description",
        content:
          "Run structured experiments with a hypothesis, baseline, success metric and guardrails, then record the decision.",
      },
      { property: "og:title", content: "Experiments — Business OS" },
      {
        property: "og:description",
        content: "Hypothesis, baseline, success metric, guardrails, result, decision.",
      },
    ],
  }),
  component: () => (
    <AwaitingData
      eyebrow="Learn"
      title="Experiments"
      subtitle="Every significant change is testable: hypothesis, baseline, intervention, success metric, guardrails, result, decision. This is how the Brain learns what works in your business specifically."
      icon={FlaskConical}
      emptyTitle="No experiments yet"
      emptyBody="Experiments usually start from an approved action — you'll be able to convert a recommendation into a measured test with a stated baseline and a clear decision rule."
    />
  ),
});
