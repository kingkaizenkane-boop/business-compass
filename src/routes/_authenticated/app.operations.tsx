import { createFileRoute } from "@tanstack/react-router";
import { Workflow } from "lucide-react";

import { AwaitingData } from "@/components/business-os/awaiting-data";

export const Route = createFileRoute("/_authenticated/app/operations")({
  head: () => ({
    meta: [
      { title: "Operations — Business OS" },
      {
        name: "description",
        content:
          "Map each process, its owner, its automation level and where the bottleneck sits.",
      },
      { property: "og:title", content: "Operations — Business OS" },
      {
        property: "og:description",
        content: "Processes, owners, automation levels and bottlenecks.",
      },
    ],
  }),
  component: () => (
    <AwaitingData
      eyebrow="Operate"
      title="Operations"
      subtitle="Each process, who carries it, how automated it is, how long it takes and where it breaks. Business OS proposes a target flow next to the current one."
      icon={Workflow}
      emptyTitle="No processes mapped yet"
      emptyBody="Processes come out of the discovery interview — how a customer books, how work gets delivered, how follow-up happens. Once mapped, the recommended flow appears beside the current one."
    />
  ),
});
