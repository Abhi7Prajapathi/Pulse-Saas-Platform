# Pulse — Multi-Tenant SaaS Project Management Platform

A full-stack, multi-tenant project management platform. Multiple organizations share
the same application while their data is strictly isolated from one another — enforced
at the API/database layer, never trusted from the frontend.

**Stack:** React + Vite + TypeScript + Tailwind (frontend) · Django + DRF + PostgreSQL + JWT (backend)

---

## 1. Folder structure

```
saas-platform/
├── backend/
│   ├── apps/
│   │   ├── accounts/          # custom User model, auth endpoints
│   │   ├── organizations/     # Organization, Membership, tenant resolution, permissions
│   │   ├── projects/          # Project model + API
│   │   ├── tasks/             # Task model + API
│   │   └── common/            # pagination, exception handling, response helpers
│   ├── config/
│   │   ├── settings/          # base.py, development.py, production.py
│   │   └── urls.py
│   ├── requirements/          # base.txt, development.txt, production.txt
│   ├── manage.py
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/                # typed API client modules (auth, organizations, projects, tasks)
    │   ├── components/
    │   │   ├── ui/              # Button, Card, Badge, Input primitives
    │   │   ├── layout/          # AppLayout (sidebar/topbar), OrgSwitcher
    │   │   └── common/          # Modal, Toast, PageHeader, ProtectedRoute
    │   ├── context/             # AuthContext, OrganizationContext
    │   ├── pages/                # auth/, dashboard/, projects/, tasks/, members/, settings/
    │   └── types/
    └── .env.example
```

---

## 2. Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ (running locally or accessible remotely — **SQLite is not supported**)

---

## 3. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements/development.txt
```

### Database

Create the database and a user (adjust names/password as you like):

```sql
CREATE USER saas_user WITH PASSWORD 'saas_password' CREATEDB;
CREATE DATABASE saas_platform OWNER saas_user;
```

### Environment variables

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DEBUG` | `True` for local dev, `False` in production |
| `SECRET_KEY` | Django secret key — generate a long random string |
| `ALLOWED_HOSTS` | Comma-separated hostnames |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_HOST` / `POSTGRES_PORT` | Database connection |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins allowed to call the API (e.g. `http://localhost:5173`) |
| `JWT_SECRET` | Signing key for JWTs — generate a separate long random string |

### Migrate & run

```bash
python manage.py migrate
python manage.py runserver 
```

The API is now at `http://localhost:8000/api/`.

### Seed data (for testing tenant isolation)

```bash
python manage.py seed_data
```

Creates **Organization A** and **Organization B**, each with 1 owner, 1 admin, 3
members, 3 projects, and several tasks. All seeded users share the password
`DemoPass123!` (e.g. `owner-a@demo.test`, `member-b-2@demo.test`). Log in as an
Org A user and confirm you can never see Org B's data, and vice versa.

### Run tests

```bash
python manage.py test apps
```

25 tests cover registration, login, JWT refresh/logout, organization creation,
role-based permissions, project/task CRUD, and — most importantly — cross-tenant
access attempts (a user in Org A can never reach Org B's projects, tasks, or
members, whether by direct ID, by list endpoint, or by supplying another org's ID
in the request header).

### API documentation

Interactive Swagger UI: `http://localhost:8000/api/docs/`
Raw OpenAPI schema: `http://localhost:8000/api/schema/`

### Django admin

`http://localhost:8000/admin/` — create a superuser first: `python manage.py createsuperuser`

---

## 4. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL defaults to http://localhost:8000/api
npm run dev
```

The app is now at `http://localhost:5173/`.

---

## 5. The multi-tenant security model

Every organization-scoped request (`/api/projects/*`, `/api/tasks/*`,
`/api/organizations/{id}/members/*`) must include an `X-Organization-Id` header.
The frontend sets this automatically from whichever organization is currently
selected in the org switcher.

That header value is **never trusted on its own**. On every single request, the
backend re-verifies — via a `Membership` row — that the authenticated user actually
belongs to the organization named in the header (`apps/organizations/tenant.py`).
If they don't, the request is rejected with `403 PERMISSION_DENIED` before it
reaches any business logic.

From there, every queryset in `projects` and `tasks` is filtered through that
verified organization (`Project.objects.filter(organization=...)`,
`Task.objects.filter(project__organization=...)`) — so a resource ID belonging to
another tenant simply doesn't exist from the caller's point of view (`404`, not
`403`, since we don't want to reveal whether the ID exists at all).

Additional layers:
- **Serializer-level validation**: creating a task validates that both the target
  project and the assignee belong to the caller's active organization — you can't
  smuggle another org's project ID or user ID into a request body.
- **Model-level validation**: `Task.clean()` re-checks the same invariant, so it
  can't be violated even via the Django shell, admin, or a fixture load.
- **Role permissions are enforced server-side**, not just hidden in the UI: OWNER
  and ADMIN can manage projects/tasks/members; MEMBER can view everything and
  update the status of tasks assigned to them, but cannot create/delete projects,
  delete tasks, or manage members. Only OWNER can delete the organization or
  change ADMIN role assignments.

This is exercised end-to-end in `apps/organizations/tests/test_tenant_isolation.py`,
including the canonical scenario:

```
User A → Organization A → Project A
User A → attempt to access Project B
              ↓
           DENIED
```

---

## 6. What's intentionally not included yet

Per the project brief, Docker, CI/CD, Kubernetes, Terraform, and observability
tooling are deliberately **not** part of this deliverable — the codebase is
structured (settings split by environment, modular Django apps, a clean frontend
API layer) so those can be layered on without restructuring the application.


## Demo Accounts

| Email | Password | Role |
|---|---|---|
| `owner-a@demo.test` | `DemoPass123!` | Owner of Organization A |
| `admin-a@demo.test` | `DemoPass123!` | Admin of Organization A |
| `member-a-1@demo.test` | `DemoPass123!` | Member of Organization A |
| `member-a-2@demo.test` | `DemoPass123!` | Member of Organization A |
| `member-a-3@demo.test` | `DemoPass123!` | Member of Organization A |
| `owner-b@demo.test` | `DemoPass123!` | Owner of Organization B |
| `admin-b@demo.test` | `DemoPass123!` | Admin of Organization B |
| `member-b-1@demo.test` | `DemoPass123!` | Member of Organization B |
| `member-b-2@demo.test` | `DemoPass123!` | Member of Organization B |
| `member-b-3@demo.test` | `DemoPass123!` | Member of Organization B |