import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { createProject, deleteProject, listProjects } from "../../api/projects";
import { EmptyState, PageHeader } from "../../components/common/PageHeader";
import { apiErrorMessage, useToast } from "../../components/common/Toast";
import { Button, Card, Input } from "../../components/ui/primitives";
import { useOrganization } from "../../context/OrganizationContext";
import { Modal } from "../../components/common/Modal";

export function ProjectsPage() {
  const { activeOrg } = useOrganization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const canManage = activeOrg?.my_role === "OWNER" || activeOrg?.my_role === "ADMIN";

  const { data, isLoading } = useQuery({
    queryKey: ["projects", activeOrg?.id, search, page],
    queryFn: () => listProjects({ search: search || undefined, page }),
    enabled: !!activeOrg,
  });

  const createMutation = useMutation({
    mutationFn: () => createProject({ name, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      showToast("Project created.");
      setShowCreate(false);
      setName("");
      setDescription("");
    },
    onError: (error) => showToast(apiErrorMessage(error), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      showToast("Project deleted.");
    },
    onError: (error) => showToast(apiErrorMessage(error), "error"),
  });

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Organize work into projects and track progress."
        actions={
          canManage && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New project
            </Button>
          )
        }
      />

      <div className="p-6">
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            className="pl-9"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {isLoading ? (
          <SkeletonGrid />
        ) : data && data.results.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.results.map((project) => (
                <Card key={project.id} className="group relative p-5">
                  <Link to={`/projects/${project.id}`} className="block">
                    <h3 className="font-display text-base font-semibold text-text-primary group-hover:text-teal-400">
                      {project.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                      {project.description || "No description."}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
                      <span>{project.task_count} tasks</span>
                      <span>{project.created_by?.full_name}</span>
                    </div>
                  </Link>
                  {canManage && (
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
                          deleteMutation.mutate(project.id);
                        }
                      }}
                      className="absolute right-3 top-3 rounded-lg p-1.5 text-text-muted opacity-0 hover:bg-surface-3 hover:text-danger group-hover:opacity-100"
                      aria-label="Delete project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </Card>
              ))}
            </div>

            {data.num_pages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button variant="secondary" size="sm" disabled={!data.previous} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-text-secondary">
                  Page {data.current_page} of {data.num_pages}
                </span>
                <Button variant="secondary" size="sm" disabled={!data.next} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to start organizing tasks."
            action={
              canManage && (
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" /> New project
                </Button>
              )
            }
          />
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New project">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Website Redesign" required autoFocus />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Description</label>
            <textarea
              className="w-full rounded-lg border border-border-light bg-surface-1 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-teal-400"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this project about?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-surface-2" />
      ))}
    </div>
  );
}
