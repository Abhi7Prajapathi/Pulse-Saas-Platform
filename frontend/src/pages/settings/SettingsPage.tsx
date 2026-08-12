import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { updateOrganization } from "../../api/organizations";
import { PageHeader } from "../../components/common/PageHeader";
import { apiErrorMessage, useToast } from "../../components/common/Toast";
import { Button, Card, Input } from "../../components/ui/primitives";
import { useAuth } from "../../context/AuthContext";
import { useOrganization } from "../../context/OrganizationContext";

export function SettingsPage() {
  const { user } = useAuth();
  const { activeOrg } = useOrganization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [orgName, setOrgName] = useState(activeOrg?.name ?? "");

  const isOwner = activeOrg?.my_role === "OWNER";

  const renameMutation = useMutation({
    mutationFn: () => updateOrganization(activeOrg!.id, orgName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      showToast("Organization updated.");
    },
    onError: (error) => showToast(apiErrorMessage(error), "error"),
  });

  return (
    <div>
      <PageHeader title="Settings" description="Manage your profile and organization." />

      <div className="max-w-2xl space-y-6 p-6">
        <Card className="p-5">
          <h2 className="font-display text-base font-semibold text-text-primary">Profile</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">Name</label>
              <Input value={user?.full_name ?? ""} disabled />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">Email</label>
              <Input value={user?.email ?? ""} disabled />
            </div>
          </div>
        </Card>

        {activeOrg && (
          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-text-primary">Organization</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                renameMutation.mutate();
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">Organization name</label>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!isOwner} />
                {!isOwner && <p className="mt-1 text-xs text-text-muted">Only the organization owner can rename it.</p>}
              </div>
              {isOwner && (
                <Button type="submit" loading={renameMutation.isPending}>
                  Save changes
                </Button>
              )}
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
