import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { PageHeader, SectionLabel } from "@/components/business-os/primitives";
import { Button } from "@/components/ui/button";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_authenticated/business/select")({
  head: () => ({
    meta: [
      { title: "Choose a business — Business OS" },
      {
        name: "description",
        content: "Switch between the businesses in your workspace, or add another one.",
      },
      { property: "og:title", content: "Choose a business — Business OS" },
      { property: "og:description", content: "Switch between the businesses in your workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <WorkspaceProvider>
      <SelectBusinessPage />
    </WorkspaceProvider>
  ),
});

function SelectBusinessPage() {
  const { businesses, activeBusiness, setActiveBusinessId, loading } = useWorkspace();
  const navigate = useNavigate();

  return (
    <main className="mx-auto max-w-2xl px-4 py-14 md:px-6">
      <PageHeader
        eyebrow="Workspace"
        title="Which business are we working on?"
        subtitle="Each business keeps its own Brain, diagnosis and plan. Nothing is shared between them."
      />

      <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-quiet">
        <SectionLabel aside={`${businesses.length} total`}>Your businesses</SectionLabel>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : businesses.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            You haven't created a business yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {businesses.map((business) => (
              <li key={business.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{business.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {business.industry ?? "Industry not set"}
                    {business.id === activeBusiness?.id ? " · active" : ""}
                  </p>
                </div>
                <Button
                  variant={business.id === activeBusiness?.id ? "outline" : "default"}
                  size="sm"
                  onClick={() => {
                    setActiveBusinessId(business.id);
                    void navigate({ to: "/app/dashboard" });
                  }}
                >
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 border-t border-border pt-5">
          <Button variant="outline" asChild>
            <Link to="/business/new">Add another business</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
