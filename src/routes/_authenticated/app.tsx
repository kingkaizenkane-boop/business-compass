import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/business-os/app-shell";
import { WorkspaceProvider } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <WorkspaceProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  );
}
