import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/seo")({
  component: SeoLayout,
});

const TABS: { to: string; label: string; exact?: boolean }[] = [
  { to: "/app/seo", label: "Overview", exact: true },
  { to: "/app/seo/opportunities", label: "Opportunities" },
  { to: "/app/seo/library", label: "Page library" },
  { to: "/app/seo/platform", label: "Platform SEO" },
];

function SeoLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="space-y-8">
      <nav
        aria-label="SEO sections"
        className="flex flex-wrap gap-1 border-b border-border pb-px"
      >
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to as never}
              className={cn(
                "rounded-t-lg border-b-2 px-3.5 py-2.5 text-sm transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
