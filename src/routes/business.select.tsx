import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/business-os/primitives";

export const Route = createFileRoute("/business/select")({
  head: () => ({
    meta: [
      { title: "Choose a business — Business OS" },
      {
        name: "description",
        content:
          "Switch between the businesses you have access to and see how complete each Business Brain is.",
      },
      { property: "og:title", content: "Choose a business — Business OS" },
      { property: "og:description", content: "Switch business and see Brain completeness." },
    ],
  }),
  component: SelectBusinessPage,
});

function SelectBusinessPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 md:py-20">
      <PageHeader
        eyebrow="Workspace"
        title="Choose a business"
        subtitle="You can belong to several organisations. Each business keeps its own Brain, diagnosis and plan, and data never crosses between them."
      />
      <div className="mt-8">
        <EmptyState
          icon={Building2}
          title="No businesses yet"
          body="Create your first business and Business OS starts building its understanding from the very first answer you give."
          primary={{ label: "Create a business", to: "/business/new" }}
        />
      </div>
    </div>
  );
}
