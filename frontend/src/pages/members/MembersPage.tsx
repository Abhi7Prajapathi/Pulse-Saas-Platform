import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { addMember, listMembers, removeMember, updateMemberRole } from "../../api/organizations";
import { EmptyState, PageHeader } from "../../components/common/PageHeader";
import { Modal } from "../../components/common/Modal";
import { apiErrorMessage, useToast } from "../../components/common/Toast";
import { Badge, Button, Card, Input } from "../../components/ui/primitives";
import { useAuth } from "../../context/AuthContext";
import { useOrganization } from "../../context/OrganizationContext";
import type { Role } from "../../types";

export function MembersPage() {
  const { activeOrg } = useOrganization();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");

  const canManage = activeOrg?.my_role === "OWNER" || activeOrg?.my_role === "ADMIN";

  const { data: members, isLoading } = useQuery({
    queryKey: ["members", activeOrg?.id],
    queryFn: () => listMembers(activeOrg!.id),
    enabled: !!activeOrg,
  });

  const inviteMutation = useMutation({
    mutationFn: () => addMember(activeOrg!.id, email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      showToast("Member added.");
      setShowInvite(false);
      setEmail("");
      setRole("MEMBER");
    },
    onError: (error) => showToast(apiErrorMessage(error), "error"),
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: number; role: Role }) =>
      updateMemberRole(activeOrg!.id, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      showToast("Role updated.");
    },
    onError: (error) => showToast(apiErrorMessage(error), "error"),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: number) => removeMember(activeOrg!.id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      showToast("Member removed.");
    },
    onError: (error) => showToast(apiErrorMessage(error), "error"),
  });

  return (
    <div>
      <PageHeader
        title="Members"
        description={`People with access to ${activeOrg?.name ?? "this organization"}.`}
        actions={
          canManage && (
            <Button onClick={() => setShowInvite(true)}>
              <Plus className="h-4 w-4" /> Add member
            </Button>
          )
        }
      />

      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-text-secondary">Loading members…</p>
        ) : members && members.length > 0 ? (
          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-3 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-surface-3">
                    <td className="px-4 py-3 font-medium text-text-primary">{m.user.full_name}</td>
                    <td className="px-4 py-3 text-text-secondary">{m.user.email}</td>
                    <td className="px-4 py-3">
                      {canManage && m.role !== "OWNER" ? (
                        <select
                          value={m.role}
                          onChange={(e) => roleMutation.mutate({ memberId: m.id, role: e.target.value as Role })}
                          className="rounded-lg border border-border-light bg-surface-1 px-2 py-1 text-xs text-text-primary"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="MEMBER">MEMBER</option>
                        </select>
                      ) : (
                        <Badge color={m.role === "OWNER" ? "amber" : "teal"}>{m.role}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      {canManage && m.role !== "OWNER" && m.user.id !== user?.id && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${m.user.full_name} from this organization?`)) {
                              removeMutation.mutate(m.id);
                            }
                          }}
                          className="text-xs text-text-muted hover:text-danger"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <EmptyState icon={Users} title="No members" description="Invite people to collaborate in this organization." />
        )}
      </div>

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Add member">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            inviteMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" required autoFocus />
            <p className="mt-1 text-xs text-text-muted">They must already have a Pulse account under this email.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-lg border border-border-light bg-surface-1 px-3 py-2 text-sm text-text-primary"
            >
              <option value="MEMBER">MEMBER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={inviteMutation.isPending}>
              Add member
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
