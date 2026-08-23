import type { LucideIcon } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/business-os/primitives";

/**
 * Standard screen for a module whose data layer is not connected yet.
 * Honest by design: no fabricated production metrics anywhere in the product.
 */
export function AwaitingData({
  eyebrow,
  title,
  subtitle,
  icon,
  emptyTitle,
  emptyBody,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyBody: string;
}) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <EmptyState
        icon={icon}
        title={emptyTitle}
        body={emptyBody}
        primary={{ label: "Start Business Discovery", to: "/app/interview" }}
        secondary={{ label: "See the Business Brain", to: "/app/brain" }}
        note="Nothing here is simulated. This screen fills in from your Business Brain — never from sample data."
      />
    </div>
  );
}
