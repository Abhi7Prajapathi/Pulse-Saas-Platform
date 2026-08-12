import {
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { OrgSwitcher } from "./OrgSwitcher";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/members", label: "Members", icon: Users },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-surface-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface-0 md:flex">
        <div className="flex h-16 items-center gap-2 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 font-display text-sm font-bold text-surface-0">
            P
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-text-primary">Pulse</span>
        </div>

        <div className="px-3 pb-3">
          <OrgSwitcher />
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-teal-950 text-teal-400"
                    : "text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive ? "bg-teal-950 text-teal-400" : "text-text-secondary hover:bg-surface-3 hover:text-text-primary"
              }`
            }
          >
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
          <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{user?.full_name}</p>
              <p className="truncate text-xs text-text-muted">{user?.email}</p>
            </div>
            <button
              onClick={() => logout()}
              aria-label="Log out"
              className="shrink-0 rounded-lg p-2 text-text-muted hover:bg-surface-3 hover:text-danger"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <Outlet />
      </main>
    </div>
  );
}
