import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/business-os/app-shell";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
