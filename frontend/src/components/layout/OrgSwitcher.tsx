import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "../../context/OrganizationContext";

export function OrgSwitcher() {
  const { organizations, activeOrg, switchOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!activeOrg) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border-light bg-surface-3 px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-2"
      >
        <span className="truncate">{activeOrg.name}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-lg border border-border-light bg-surface-2 shadow-xl">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  switchOrganization(org.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-3 ${
                  org.id === activeOrg.id ? "text-teal-400" : "text-text-primary"
                }`}
              >
                <span className="truncate">{org.name}</span>
                <span className="text-xs text-text-muted">{org.my_role}</span>
              </button>
            ))}
            <button
              onClick={() => {
                setOpen(false);
                navigate("/organizations?create=1");
              }}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-teal-400 hover:bg-surface-3"
            >
              <Plus className="h-4 w-4" /> Create organization
            </button>
          </div>
        </>
      )}
    </div>
  );
}
