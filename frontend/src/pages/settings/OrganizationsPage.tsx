import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createOrganization, deleteOrganization, listOrganizations } from "../../api/organizations";
import { PageHeader } from "../../components/common/PageHeader";
import { Modal } from "../../components/common/Modal";
import { apiErrorMessage, useToast } from "../../components/common/Toast";
import { Badge, Button, Card, Input } from "../../components/ui/primitives";
import { useOrganization } from "../../context/OrganizationContext";

export function OrganizationsPage() {
  const { activeOrg, switchOrganization } = useOrganization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setShowCreate(true);
      searchParams.delete("create");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: organizations, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: listOrganizations,
  });

  const createMutation = useMutation({
    mutationFn: () => createOrganization(name),
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      showToast(`${org.name} created.`);
      switchOrganization(org.id);
      setShowCreate(false);
      setName("");
    },
    onError: (error) => showToast(apiErrorMessage(error), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      showToast("Organization deleted.");
    },
    onError: (error) => showToast(apiErrorMessage(error), "error"),
  });

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Every organization you belong to."
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Create
          </Button>
        }
      />

      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {organizations?.map((org) => (
              <Card key={org.id} className={`p-5 ${org.id === activeOrg?.id ? "border-teal-500" : ""}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold text-text-primary">{org.name}</h3>
                  <Badge color={org.my_role === "OWNER" ? "amber" : "teal"}>{org.my_role}</Badge>
                </div>
                <p className="mt-1 text-xs text-text-muted">{org.member_count} members</p>
                <div className="mt-4 flex gap-2">
                  {org.id !== activeOrg?.id ? (
                    <Button size="sm" variant="secondary" onClick={() => switchOrganization(org.id)}>
                      Switch to this org
                    </Button>
                  ) : (
                    <span className="text-xs font-medium text-teal-400">Currently active</span>
                  )}
                  {org.my_role === "OWNER" && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (confirm(`Delete "${org.name}"? This removes all its projects and tasks permanently.`)) {
                          deleteMutation.mutate(org.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {organizations?.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-light px-6 py-16 text-center">
            <Building2 className="mb-3 h-8 w-8 text-text-muted" />
            <h3 className="font-display text-base font-semibold text-text-primary">No organizations yet</h3>
            <p className="mt-1 max-w-sm text-sm text-text-secondary">Create one to get started.</p>
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create organization">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Organization name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." required autoFocus />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
