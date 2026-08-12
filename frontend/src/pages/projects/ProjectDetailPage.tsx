import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getProject } from "../../api/projects";
import { listTasks } from "../../api/tasks";
import { Badge, Card } from "../../components/ui/primitives";
import type { Task, TaskStatus } from "../../types";

const columns: { key: TaskStatus; label: string }[] = [
  { key: "TODO", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "IN_REVIEW", label: "In Review" },
  { key: "DONE", label: "Done" },
];

const priorityColor: Record<string, "neutral" | "teal" | "amber" | "danger"> = {
  LOW: "neutral",
  MEDIUM: "teal",
  HIGH: "amber",
  URGENT: "danger",
};

export function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = Number(id);

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks", "project", projectId],
    queryFn: () => listTasks({ project: projectId, page_size: 100 }),
  });

  if (loadingProject) {
    return <div className="p-6 text-sm text-text-secondary">Loading project…</div>;
  }

  if (!project) {
    return <div className="p-6 text-sm text-text-secondary">Project not found.</div>;
  }

  const grouped: Record<TaskStatus, Task[]> = { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] };
  tasks?.results.forEach((t) => grouped[t.status].push(t));

  return (
    <div>
      <div className="border-b border-border px-6 py-5">
        <Link to="/projects" className="mb-3 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to projects
        </Link>
        <h1 className="font-display text-xl font-semibold text-text-primary">{project.name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-secondary">{project.description || "No description provided."}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
          <span>Created by {project.created_by?.full_name}</span>
          <span>{new Date(project.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        {columns.map((col) => (
          <div key={col.key}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{col.label}</h3>
              <span className="text-xs text-text-muted">{grouped[col.key].length}</span>
            </div>
            <div className="space-y-2">
              {grouped[col.key].map((task) => (
                <Card key={task.id} className="p-3">
                  <p className="text-sm font-medium text-text-primary">{task.title}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge color={priorityColor[task.priority]}>{task.priority}</Badge>
                    {task.assigned_to && (
                      <span className="text-xs text-text-muted">{task.assigned_to.full_name}</span>
                    )}
                  </div>
                </Card>
              ))}
              {grouped[col.key].length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-muted">
                  No tasks
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
