import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as orgsApi from "../api/organizations";
import { orgStore } from "../api/client";
import type { Organization } from "../types";
import { useAuth } from "./AuthContext";

interface OrgContextValue {
  organizations: Organization[];
  activeOrg: Organization | null;
  isLoading: boolean;
  switchOrganization: (orgId: number) => void;
  refetchOrganizations: () => void;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [activeOrgId, setActiveOrgId] = useState<number | null>(() => {
    const stored = orgStore.get();
    return stored ? Number(stored) : null;
  });

  const { data: organizations = [], isLoading, refetch } = useQuery({
    queryKey: ["organizations"],
    queryFn: orgsApi.listOrganizations,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveOrgId(null);
      return;
    }
    if (organizations.length === 0) return;

    const stillMember = organizations.some((o) => o.id === activeOrgId);
    if (!activeOrgId || !stillMember) {
      const first = organizations[0];
      orgStore.set(first.id);
      setActiveOrgId(first.id);
    }
  }, [organizations, isAuthenticated, activeOrgId]);

  const switchOrganization = (orgId: number) => {
    orgStore.set(orgId);
    setActiveOrgId(orgId);
    // Clear cached organization-specific data so every view refetches
    // scoped to the newly selected tenant.
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["members"] });
  };

  const activeOrg = organizations.find((o) => o.id === activeOrgId) ?? null;

  return (
    <OrgContext.Provider
      value={{ organizations, activeOrg, isLoading, switchOrganization, refetchOrganizations: refetch }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
}
