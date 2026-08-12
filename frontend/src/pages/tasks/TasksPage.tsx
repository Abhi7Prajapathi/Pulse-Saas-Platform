import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, List, ListTodo, Plus, Search } from "lucide-react";
import { useState } from "react";
import { listMembers } from "../../api/organizations";
import { listProjects } from "../../api/projects";
import { createTask, deleteTask, updateTask } from "../../api/tasks";
import { listTasks } from "../../api/tasks";
import { EmptyState, PageHeader } from "../../components/common/PageHeader";
import { Modal } from "../../components/common/Modal";
import { apiErrorMessage, useToast } from "../../components/common/Toast";
import { Badge, Button, Card, Input } from "../../components/ui/primitives";
import { useOrganization } from "../../context/OrganizationContext";
import type { Task, TaskPriority, TaskStatus } from "../../types";

const statusColumns: { key: TaskStatus; label: string }[] = [
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

const statusColor: Record<string, "neutral" | "teal" | "amber" | "success"> = {
  TODO: "neutral",
  IN_PROGRESS: "teal",
  IN_REVIEW: "amber",
  DONE: "success",
};

export function TasksPage() {
  const { activeOrg } = useOrganization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [view, setView] = useState<"list" | "kanban">("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", activeOrg?.id, search, statusFilter, priorityFilter],
    queryFn: () =>
      listTasks({
        search: search || undefined,
        status: (statusFilter as TaskStatus) || undefined,
        priority: (priorityFilter as TaskPriority) || undefined,
        page_size: 100,
      }),
    enabled: !!activeOrg,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) => updateTask(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (error) => showToast(apiErrorMessage(error), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      showToast("Task deleted.");
    },
    onError: (error) => showToast(apiErrorMessage(error), "error"),
  });

  const tasks = data?.results ?? [];

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Track and organize work across every project."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border-light bg-surface-3 p-0.5">
              <button
                onClick={() => setView("list")}
                className={`rounded-md p-1.5 ${view === "list" ? "bg-surface-2 text-teal-400" : "text-text-muted"}`}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("kanban")}
                className={`rounded-md p-1.5 ${view === "kanban" ? "bg-surface-2 text-teal-400" : "text-text-muted"}`}
                aria-label="Kanban view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New task
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input className="pl-9" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border-light bg-surface-1 px-3 py-2 text-sm text-text-primary"
          >
            <option value="">All statuses</option>
            {statusColumns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-border-light bg-surface-1 px-3 py-2 text-sm text-text-primary"
          >
            <option value="">All priorities</option>
            {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-text-secondary">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No tasks found"
            description="Try adjusting your filters, or create a new task."
            action={
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" /> New task
              </Button>
            }
          />
        ) : view === "kanban" ? (
          <KanbanBoard
            tasks={tasks}
            onDrop={(taskId, status) => updateStatusMutation.mutate({ id: taskId, status })}
          />
        ) : (
          <TaskList tasks={tasks} onDelete={(id) => deleteMutation.mutate(id)} />
        )}
      </div>

      <CreateTaskModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

function KanbanBoard({ tasks, onDrop }: { tasks: Task[]; onDrop: (taskId: number, status: TaskStatus) => void }) {
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statusColumns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(col.key);
            }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = Number(e.dataTransfer.getData("text/task-id"));
              if (taskId) onDrop(taskId, col.key);
              setDragOverCol(null);
            }}
            className={`rounded-xl border p-3 transition-colors ${
              dragOverCol === col.key ? "border-teal-400 bg-surface-3" : "border-border bg-surface-1"
            }`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-text-primary">{col.label}</h3>
              <span className="text-xs text-text-muted">{colTasks.length}</span>
            </div>
            <div className="space-y-2">
              {colTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/task-id", String(task.id))}
                >
                  <Card className="cursor-grab p-3 active:cursor-grabbing">
                    <p className="text-sm font-medium text-text-primary">{task.title}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge color={priorityColor[task.priority]}>{task.priority}</Badge>
                      {task.assigned_to && <span className="text-xs text-text-muted">{task.assigned_to.full_name}</span>}
                    </div>
                    {task.due_date && (
                      <p className="mt-1.5 text-xs text-text-muted">Due {new Date(task.due_date).toLocaleDateString()}</p>
                    )}
                  </Card>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskList({ tasks, onDelete }: { tasks: Task[]; onDelete: (id: number) => void }) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface-3 text-xs uppercase tracking-wide text-text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Priority</th>
            <th className="px-4 py-3 font-medium">Assignee</th>
            <th className="px-4 py-3 font-medium">Due</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b border-border last:border-0 hover:bg-surface-3">
              <td className="px-4 py-3 font-medium text-text-primary">{task.title}</td>
              <td className="px-4 py-3">
                <Badge color={statusColor[task.status]}>{task.status.replace("_", " ")}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge color={priorityColor[task.priority]}>{task.priority}</Badge>
              </td>
              <td className="px-4 py-3 text-text-secondary">{task.assigned_to?.full_name ?? "Unassigned"}</td>
              <td className="px-4 py-3 text-text-secondary">
                {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => onDelete(task.id)} className="text-xs text-text-muted hover:text-danger">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function CreateTaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeOrg } = useOrganization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [dueDate, setDueDate] = useState("");

  const { data: projects } = useQuery({
    queryKey: ["projects", activeOrg?.id, "all-for-select"],
    queryFn: () => listProjects({ page_size: 100 }),
    enabled: !!activeOrg && open,
  });

  const { data: members } = useQuery({
    queryKey: ["members", activeOrg?.id],
    queryFn: () => listMembers(activeOrg!.id),
    enabled: !!activeOrg && open,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createTask({
        title,
        project_id: Number(projectId),
        priority,
        assigned_to_id: assignedTo ? Number(assignedTo) : null,
        due_date: dueDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      showToast("Task created.");
      onClose();
      setTitle("");
      setProjectId("");
      setAssignedTo("");
      setDueDate("");
    },
    onError: (error) => showToast(apiErrorMessage(error), "error"),
  });

  return (
    <Modal open={open} onClose={onClose} title="New task">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Design homepage" required autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className="w-full rounded-lg border border-border-light bg-surface-1 px-3 py-2 text-sm text-text-primary"
          >
            <option value="">Select a project</option>
            {projects?.results.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-lg border border-border-light bg-surface-1 px-3 py-2 text-sm text-text-primary"
            >
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Due date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Assignee</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full rounded-lg border border-border-light bg-surface-1 px-3 py-2 text-sm text-text-primary"
          >
            <option value="">Unassigned</option>
            {members?.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createMutation.isPending}>
            Create task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
