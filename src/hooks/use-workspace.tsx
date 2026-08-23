import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { getWorkspace } from "@/lib/workspace.functions";

type Business = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  industry: string | null;
  business_model: string | null;
  status: string;
  created_at: string;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  plan_code: string;
  status: string;
};

type WorkspaceValue = {
  loading: boolean;
  error: Error | null;
  organizations: Organization[];
  businesses: Business[];
  activeBusiness: Business | null;
  activeOrganization: Organization | null;
  setActiveBusinessId: (id: string) => void;
  refresh: () => Promise<void>;
};

const STORAGE_KEY = "business-os.active-business";

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const fetchWorkspace = useServerFn(getWorkspace);
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => fetchWorkspace({ data: undefined }),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActiveId(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const businesses = data?.businesses ?? [];

  const activeBusiness = useMemo(() => {
    if (businesses.length === 0) return null;
    return businesses.find((b) => b.id === activeId) ?? businesses[0]!;
  }, [businesses, activeId]);

  const setActiveBusinessId = useCallback((id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["workspace"] });
  }, [queryClient]);

  const value: WorkspaceValue = {
    loading: isLoading,
    error: (error as Error) ?? null,
    organizations: data?.organizations ?? [],
    businesses,
    activeBusiness,
    activeOrganization:
      (data?.organizations ?? []).find((o) => o.id === activeBusiness?.organization_id) ??
      data?.organizations?.[0] ??
      null,
    setActiveBusinessId,
    refresh,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
