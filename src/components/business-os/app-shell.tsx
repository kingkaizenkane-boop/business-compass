import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  Brain,
  ChevronsUpDown,
  CircleHelp,
  ClipboardList,
  Compass,
  FileText,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  MessagesSquare,
  Package,
  Search,
  Settings,
  Sparkles,
  Tags,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type NavItem = { label: string; to: string; icon: typeof Brain };

const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", to: "/app/dashboard", icon: LayoutDashboard },
  { label: "Business Brain", to: "/app/brain", icon: Brain },
  { label: "Interview", to: "/app/interview", icon: MessagesSquare },
  { label: "Diagnosis", to: "/app/diagnosis", icon: Activity },
  { label: "Blueprint", to: "/app/blueprint", icon: FileText },
  { label: "Action Plan", to: "/app/action-plan", icon: ClipboardList },
];

const SECONDARY_NAV: NavItem[] = [
  { label: "Operations", to: "/app/operations", icon: Workflow },
  { label: "Customers", to: "/app/customers", icon: Users },
  { label: "Leads", to: "/app/leads", icon: Compass },
  { label: "Services", to: "/app/services", icon: Package },
  { label: "Offers", to: "/app/offers", icon: Tags },
  { label: "SEO", to: "/app/seo", icon: Search },
  { label: "Experiments", to: "/app/experiments", icon: FlaskConical },
  { label: "Metrics", to: "/app/metrics", icon: Gauge },
  { label: "Connectors", to: "/app/connectors", icon: Plug },
  { label: "AI usage", to: "/app/ai-usage", icon: Sparkles },
];

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: (() => void) | undefined }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = pathname === item.to;
        return (
          <li key={item.to}>
            <Link
              to={item.to}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function BusinessSelector({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { businesses, activeBusiness, setActiveBusinessId } = useWorkspace();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center justify-between gap-2 rounded-lg border border-sidebar-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent/50">
          <span className="min-w-0">
            <span className="eyebrow block">Business</span>
            <span className="mt-0.5 block truncate text-sm font-medium text-sidebar-foreground">
              {activeBusiness ? activeBusiness.name : "No business yet"}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {businesses.length === 0 ? (
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            You haven't created a business yet. Brain completeness appears here once you do.
          </DropdownMenuLabel>
        ) : (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Switch business
            </DropdownMenuLabel>
            {businesses.map((business) => (
              <DropdownMenuItem
                key={business.id}
                onSelect={() => {
                  setActiveBusinessId(business.id);
                  onNavigate?.();
                }}
                className={business.id === activeBusiness?.id ? "font-medium text-foreground" : ""}
              >
                {business.name}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/business/new" onClick={onNavigate}>
            Create a business
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 pb-6">
      <BusinessSelector onNavigate={onNavigate} />
      <nav aria-label="Core loop" className="space-y-2">
        <p className="eyebrow px-2.5">Core loop</p>
        <NavList items={PRIMARY_NAV} onNavigate={onNavigate} />
      </nav>
      <nav aria-label="Operate and grow" className="space-y-2">
        <p className="eyebrow px-2.5">Operate &amp; grow</p>
        <NavList items={SECONDARY_NAV} onNavigate={onNavigate} />
      </nav>
      <nav aria-label="Account" className="mt-auto space-y-2 border-t border-sidebar-border pt-4">
        <NavList
          items={[
            { label: "Notifications", to: "/app/notifications", icon: Bell },
            { label: "Settings", to: "/app/settings", icon: Settings },
            { label: "Help", to: "/app/help", icon: CircleHelp },
          ]}
          onNavigate={onNavigate}
        />
      </nav>
    </div>
  );
}

function ActiveBusinessLabel() {
  const { activeBusiness, loading } = useWorkspace();
  if (loading) {
    return <span className="truncate text-sm text-muted-foreground">Loading your workspace…</span>;
  }
  if (!activeBusiness) {
    return (
      <span className="truncate text-sm text-muted-foreground">
        No active business —{" "}
        <Link to="/business/new" className="text-primary underline underline-offset-4">
          create one
        </Link>
      </span>
    );
  }
  return (
    <span className="truncate text-sm text-muted-foreground">
      {activeBusiness.name}
      {activeBusiness.industry ? ` · ${activeBusiness.industry}` : ""}
    </span>
  );
}

function BrainHealthPill() {
  const { activeBusiness } = useWorkspace();
  return (
    <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground sm:flex">
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", activeBusiness ? "bg-primary" : "bg-muted-foreground")}
      />
      {activeBusiness ? "Brain building" : "Brain health —"}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[110rem]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar pt-5 lg:flex">
          <Link to="/" className="mb-6 flex items-center gap-2 px-6">
            <Sparkles className="size-4 text-primary" aria-hidden />
            <span className="text-sm font-semibold tracking-[0.14em] text-sidebar-foreground">
              BUSINESS OS
            </span>
          </Link>
          <SidebarBody />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    Menu
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 bg-sidebar pt-5">
                  <SheetTitle className="mb-5 px-4 text-sm font-semibold tracking-[0.14em]">
                    BUSINESS OS
                  </SheetTitle>
                  <SidebarBody />
                </SheetContent>
              </Sheet>
              <ActiveBusinessLabel />
            </div>

            <div className="flex items-center gap-1.5">
              <BrainHealthPill />
              <Button variant="ghost" size="sm" onClick={() => void supabase.auth.signOut()}>
                Sign out
              </Button>
              <Button variant="ghost" size="icon" aria-label="Notifications" asChild>
                <Link to="/app/notifications">
                  <Bell className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" aria-label="Profile" asChild>
                <Link to="/app/settings">
                  <UserRound className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-8 md:px-8 md:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
