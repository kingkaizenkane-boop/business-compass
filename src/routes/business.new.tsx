import { createFileRoute } from "@tanstack/react-router";

import { PageHeader, SectionLabel } from "@/components/business-os/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/business/new")({
  head: () => ({
    meta: [
      { title: "Create a business — Business OS" },
      {
        name: "description",
        content:
          "The basics only: name, industry, location, model and main services. The real discovery happens in the interview.",
      },
      { property: "og:title", content: "Create a business — Business OS" },
      {
        property: "og:description",
        content: "Business basics in a minute, then straight into discovery.",
      },
    ],
  }),
  component: NewBusinessPage,
});

const FIELDS: Array<{ id: string; label: string; placeholder: string }> = [
  { id: "name", label: "Business name", placeholder: "Premium Barber Studio" },
  { id: "industry", label: "Industry", placeholder: "Personal care" },
  { id: "sub-industry", label: "Sub-industry", placeholder: "Barbering" },
  { id: "location", label: "Location", placeholder: "Ikeja, Lagos" },
  { id: "website", label: "Website", placeholder: "example.com" },
  { id: "model", label: "Business model", placeholder: "Appointment-based service" },
  { id: "employees", label: "Number of employees", placeholder: "5" },
  { id: "services", label: "Primary services", placeholder: "Haircut, beard grooming" },
  { id: "years", label: "Years operating", placeholder: "6" },
];

function NewBusinessPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 md:py-20">
      <PageHeader
        eyebrow="Onboarding"
        title="Tell us the basics"
        subtitle="Nine short fields. Everything deeper — how you win customers, where the work jams up, what depends on you — comes out of the discovery conversation, not a form."
      />

      <form className="mt-8 space-y-6" aria-describedby="business-new-note">
        <SectionLabel>Business basics</SectionLabel>
        <div className="grid gap-5 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>{field.label}</Label>
              <Input id={field.id} placeholder={field.placeholder} disabled />
            </div>
          ))}
        </div>
        <Button type="submit" disabled className="w-full sm:w-auto">
          Start Business Discovery
        </Button>
        <p id="business-new-note" className="text-xs leading-relaxed text-muted-foreground">
          Saving is disabled until the database and accounts are wired up, so nothing you type here
          would persist yet.
        </p>
      </form>
    </div>
  );
}
