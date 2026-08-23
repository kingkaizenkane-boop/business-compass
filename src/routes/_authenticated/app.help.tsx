import { createFileRoute } from "@tanstack/react-router";

import { LoopDiagram } from "@/components/business-os/loop-diagram";
import { PageHeader, SectionLabel } from "@/components/business-os/primitives";

export const Route = createFileRoute("/app/help")({
  head: () => ({
    meta: [
      { title: "How Business OS works — Business OS" },
      {
        name: "description",
        content:
          "The loop behind the product: onboarding, discovery, Business Brain, diagnosis, blueprint, action, measurement, learning.",
      },
      { property: "og:title", content: "How Business OS works — Business OS" },
      {
        property: "og:description",
        content: "Onboarding to learning: the loop behind Business OS.",
      },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <div className="space-y-9">
      <PageHeader
        eyebrow="Help"
        title="How Business OS works"
        subtitle="One loop, running continuously. Each pass makes the system's understanding of your business more specific and its recommendations more useful."
      />
      <section>
        <SectionLabel>The loop</SectionLabel>
        <LoopDiagram />
      </section>
      <section className="rounded-xl border border-border bg-card p-6 shadow-quiet">
        <SectionLabel>Two rules the product never breaks</SectionLabel>
        <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Inference is never shown as fact.</span>{" "}
            Anything derived is labelled, and you can verify, correct or reject it.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Conflicting information is never silently overwritten.
            </span>{" "}
            If what you tell us contradicts what we recorded, you decide which is right.
          </li>
        </ul>
      </section>
    </div>
  );
}
