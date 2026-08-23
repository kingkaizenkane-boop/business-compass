import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionLabel } from "@/components/business-os/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-workspace";
import { createBusiness } from "@/lib/workspace.functions";

export const Route = createFileRoute("/_authenticated/business/new")({
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <WorkspaceProvider>
      <NewBusinessPage />
    </WorkspaceProvider>
  ),
});

function NewBusinessPage() {
  const { activeOrganization, loading, error: workspaceError, setActiveBusinessId, refresh } = useWorkspace();
  const create = useServerFn(createBusiness);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    industry: "",
    subIndustry: "",
    locationLabel: "",
    websiteUrl: "",
    businessModel: "",
    customerModel: "",
    description: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!activeOrganization) {
        throw new Error(
          workspaceError
            ? `Workspace could not be loaded: ${workspaceError.message}`
            : "Workspace is still loading — try again in a moment.",
        );
      }
      return create({
        data: {
          organizationId: activeOrganization.id,
          name: form.name.trim(),
          industry: form.industry.trim() || undefined,
          subIndustry: form.subIndustry.trim() || undefined,
          businessModel: form.businessModel.trim() || undefined,
          customerModel: form.customerModel.trim() || undefined,
          websiteUrl: form.websiteUrl.trim() || undefined,
          locationLabel: form.locationLabel.trim() || undefined,
          description: form.description.trim() || undefined,
        },
      });
    },
    onSuccess: async (business) => {
      setActiveBusinessId(business.id);
      await refresh();
      toast.success("Business created — let's map how it works");
      void navigate({ to: "/app/interview" });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not create the business"),
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-14 md:px-6">
      <PageHeader
        eyebrow="Onboarding"
        title="Tell me the basics."
        subtitle="Just enough to open the file. The real understanding comes from the interview next."
      />

      <form
        className="mt-8 space-y-5 rounded-xl border border-border bg-card p-6 shadow-quiet md:p-8"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <SectionLabel>Business basics</SectionLabel>

        {workspaceError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            Your workspace couldn't be loaded: {workspaceError.message}
          </p>
        ) : null}

        <Field
          id="name"
          label="Business name"
          placeholder="Premium Barber Studio"
          value={form.name}
          onChange={(value) => setForm({ ...form, name: value })}
          required
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="industry"
            label="Industry"
            placeholder="Personal care"
            value={form.industry}
            onChange={(value) => setForm({ ...form, industry: value })}
          />
          <Field
            id="sub-industry"
            label="Sub-industry"
            placeholder="Barbering"
            value={form.subIndustry}
            onChange={(value) => setForm({ ...form, subIndustry: value })}
          />
          <Field
            id="location"
            label="Location"
            placeholder="Ikeja, Lagos"
            value={form.locationLabel}
            onChange={(value) => setForm({ ...form, locationLabel: value })}
          />
          <Field
            id="website"
            label="Website"
            placeholder="example.com"
            value={form.websiteUrl}
            onChange={(value) => setForm({ ...form, websiteUrl: value })}
          />
          <Field
            id="model"
            label="Business model"
            placeholder="Appointment-based services"
            value={form.businessModel}
            onChange={(value) => setForm({ ...form, businessModel: value })}
          />
          <Field
            id="customer-model"
            label="Customer type"
            placeholder="B2C"
            value={form.customerModel}
            onChange={(value) => setForm({ ...form, customerModel: value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">What does the business do?</Label>
          <Textarea
            id="description"
            rows={3}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="One or two lines in your own words."
            className="resize-none"
          />
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-5">
          <Button type="submit" disabled={mutation.isPending || loading || form.name.trim().length < 2}>
            {mutation.isPending ? "Creating…" : "Create and start interview"}
          </Button>
          <p className="text-xs text-muted-foreground">Nothing here is guessed on your behalf.</p>
        </div>
      </form>
    </main>
  );
}

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
