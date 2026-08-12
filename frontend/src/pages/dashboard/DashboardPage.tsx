import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FolderKanban, ListTodo, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { listProjects } from "../../api/projects";
import { listMembers } from "../../api/organizations";
import { listTasks } from "../../api/tasks";
import { PageHeader } from "../../components/common/PageHeader";
import { Badge, Card } from "../../components/ui/primitives";
import { useAuth } from "../../context/AuthContext";
import { useOrganization } from "../../context/OrganizationContext";
import type { Task } from "../../types";

const priorityColor: Record<string, "neutral" | "teal" | "amber" | "danger"> = {
  LOW: "neutral",
  MEDIUM: "teal",
  HIGH: "amber",
  URGENT: "danger",
};

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{label}</p>
        <Icon className="h-4 w-4 text-text-muted" />
      </div>
      <p className="mt-2 font-display text-2xl font-semibold text-text-primary">{value}</p>
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { activeOrg } = useOrganization();

  const { data: projects } = useQuery({
    queryKey: ["projects", activeOrg?.id, "dashboard"],
    queryFn: () => listProjects({ page_size: 5, ordering: "-created_at" }),
    enabled: !!activeOrg,
  });

  const { data: allTasks } = useQuery({
    queryKey: ["tasks", activeOrg?.id, "dashboard-all"],
    queryFn: () => listTasks({ page_size: 100 }),
    enabled: !!activeOrg,
  });

  const { data: myTasks } = useQuery({
    queryKey: ["tasks", activeOrg?.id, "mine", user?.id],
    queryFn: () => listTasks({ assigned_to: user!.id, page_size: 100 }),
    enabled: !!activeOrg && !!user,
  });

  const { data: members } = useQuery({
    queryKey: ["members", activeOrg?.id],
    queryFn: () => listMembers(activeOrg!.id),
    enabled: !!activeOrg,
  });

  const tasks = allTasks?.results ?? [];
  const completed = tasks.filter((t) => t.status === "DONE").length;
  const pending = tasks.length - completed;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== "DONE").length;

  return (
    <div>
      <PageHeader title={`Welcome back, ${user?.first_name}`} description={activeOrg ? `Here's what's happening in ${activeOrg.name}.` : undefined} />

      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Projects" value={projects?.count ?? "—"} icon={FolderKanban} />
          <StatCard label="Tasks" value={tasks.length} icon={ListTodo} />
          <StatCard label="Completed" value={completed} icon={CheckCircle2} />
          <StatCard label="Pending" value={pending} icon={ListTodo} />
          <StatCard label="Overdue" value={overdue} icon={AlertTriangle} />
          <StatCard label="Members" value={members?.length ?? "—"} icon={Users} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-text-primary">Recent projects</h2>
              <Link to="/projects" className="text-sm font-medium text-teal-400 hover:text-teal-300">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {projects?.results.length ? (
                projects.results.map((p) => (
                  <Link
                    key={p.id}
                    to={`/projects/${p.id}`}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 hover:border-border-light hover:bg-surface-3"
                  >
                    <span className="text-sm font-medium text-text-primary">{p.name}</span>
                    <span className="text-xs text-text-muted">{p.task_count} tasks</span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-text-muted">No projects yet.</p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-text-primary">Assigned to me</h2>
              <Link to="/tasks" className="text-sm font-medium text-teal-400 hover:text-teal-300">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {myTasks?.results.length ? (
                myTasks.results.slice(0, 6).map((t: Task) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                    <span className="truncate text-sm font-medium text-text-primary">{t.title}</span>
                    <Badge color={priorityColor[t.priority]}>{t.priority}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-muted">Nothing assigned to you right now.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
