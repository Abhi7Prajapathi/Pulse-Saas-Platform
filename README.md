# Pulse — Multi-Tenant SaaS Project Management Platform

A full-stack, multi-tenant project management platform. Multiple organizations share
the same application while their data is strictly isolated from one another — enforced
at the API/database layer, never trusted from the frontend.

**Stack:** React + Vite + TypeScript + Tailwind (frontend) · Django + DRF + PostgreSQL + JWT (backend) · Kubernetes (minikube) · Prometheus + Grafana (monitoring)

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
│   ├── Dockerfile             # installs requirements/development.txt
│   ├── manage.py
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/                # typed API client modules (auth, organizations, projects, tasks)
│   │   ├── components/
│   │   │   ├── ui/              # Button, Card, Badge, Input primitives
│   │   │   ├── layout/          # AppLayout (sidebar/topbar), OrgSwitcher
│   │   │   └── common/          # Modal, Toast, PageHeader, ProtectedRoute
│   │   ├── context/             # AuthContext, OrganizationContext
│   │   ├── pages/                # auth/, dashboard/, projects/, tasks/, members/, settings/
│   │   └── types/
│   └── .env.example
├── monitoring.yaml            # Prometheus + Grafana + RBAC (namespace: app-namespace)
└── pulse-dashboard.json       # Grafana dashboard (import via the Grafana UI)
```

---

## 2. Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ (running locally or accessible remotely — **SQLite is not supported**)
- For the Kubernetes/monitoring part: Docker, minikube, kubectl (Helm is **not** required)

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
| `ALLOWED_HOSTS` | Comma-separated hostnames. **Must include `backend-service`** when running in Kubernetes, otherwise Prometheus gets `400 Bad Request` |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_HOST` / `POSTGRES_PORT` | Database connection |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins allowed to call the API (e.g. `http://localhost:5173`) |
| `JWT_SECRET` | Signing key for JWTs — generate a separate long random string |

### Migrate & run

```bash
python manage.py migrate
python manage.py runserver
```

The API is now at `http://localhost:8000/api/`.
Prometheus metrics are exposed at `http://localhost:8000/metrics`.

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

## 6. Monitoring (Prometheus + Grafana on minikube)

Everything lives in the `app-namespace` namespace.

### 6.1 One-time backend changes (already applied in this repo)

1. **`requirements/base.txt`** — add `django-prometheus`.
   The Dockerfile installs `requirements/development.txt`, so make sure that file
   starts with `-r base.txt` (otherwise the package is not installed in the image).

2. **`config/settings/base.py`**

   ```python
   INSTALLED_APPS = [
       # ...
       "django_prometheus",                  # underscore, NOT a hyphen
       # local apps...
   ]

   MIDDLEWARE = [
       "django_prometheus.middleware.PrometheusBeforeMiddleware",  # must be FIRST
       # ...all other middleware...
       "django_prometheus.middleware.PrometheusAfterMiddleware",   # must be LAST
   ]

   ALLOWED_HOSTS = [...,"backend-service", "backend-service.app-namespace.svc.cluster.local"]
   ```

3. **`config/urls.py`**

   ```python
   from django.urls import path, include

   urlpatterns = [
       # ...existing paths...
       path("", include("django_prometheus.urls")),   # exposes /metrics
   ]
   ```

### 6.2 Build and deploy the backend image (Windows PowerShell)

```powershell
cd backend
minikube image build -t pulse-backend:v1 .       # use a NEW tag every time
kubectl get deploy backend -n app-namespace -o jsonpath="{.spec.template.spec.containers[*].name}"
kubectl set image deployment/backend <container-name>=pulse-backend:v1 -n app-namespace
kubectl rollout status deployment/backend -n app-namespace
```

Verify the package is inside the pod and `/metrics` works:

```powershell
kubectl exec deploy/backend -n app-namespace -- pip show django-prometheus
kubectl port-forward -n app-namespace svc/backend-service 8081:80
curl.exe localhost:8081/metrics          # should print "# HELP ..." lines
```

> Restart the `port-forward` after every rollout — it stays attached to the old pod.
> Use `curl.exe`, not `curl` (PowerShell aliases `curl` to `Invoke-WebRequest`).

### 6.3 Install kube-state-metrics (no Helm needed)

```powershell
kubectl apply -k "github.com/kubernetes/kube-state-metrics/examples/standard?ref=v2.13.0"
kubectl rollout status deployment/kube-state-metrics -n kube-system
```

(Needs `git` installed. With Helm: `helm install kube-state-metrics prometheus-community/kube-state-metrics -n kube-system`.)

### 6.4 Deploy Prometheus + Grafana

```powershell
kubectl apply -f monitoring.yaml
kubectl rollout restart deployment/monitoring-deployment -n app-namespace
kubectl rollout status deployment/monitoring-deployment -n app-namespace
```

`monitoring.yaml` contains the Prometheus ConfigMap (4 scrape jobs), the
ServiceAccount/ClusterRole/ClusterRoleBinding Prometheus needs, and the Prometheus
and Grafana Deployments/Services. The restart is required because the config is
mounted with `subPath`, which does not hot-reload.

Scrape jobs:

| Job | Target | Gives you |
|---|---|---|
| `prometheus` | `localhost:9090` | Prometheus self-metrics |
| `backend` | `backend-service:80` (path `/metrics`) | Django request rate, status codes, latency |
| `kubelet` | cAdvisor via the API-server proxy | CPU and memory per pod |
| `kube-state-metrics` | `kube-state-metrics.kube-system.svc.cluster.local:8080` | Pod status, restarts |

### 6.5 Open the UIs

Run each in its own terminal and leave them running:

```powershell
kubectl port-forward -n app-namespace svc/monitoring-service 9090:9090
kubectl port-forward -n app-namespace svc/grafana-service 3000:3000
```

- Prometheus: `http://localhost:9090` → **Status → Target health** → all 4 jobs must be **UP**
- Grafana: `http://localhost:3000` (default login `admin` / `admin`)

### 6.6 Connect Grafana and load the dashboard

1. **Connections → Data sources → Add → Prometheus**
   URL: `http://monitoring-service:9090` (**not** `localhost`) → **Save & test**
2. **Dashboards → New → Import → Upload JSON file** → `pulse-dashboard.json`
   → set **Data source** = `prometheus`, **Namespace** = `app-namespace`

The dashboard shows running / not-running pods, restarts, CPU and memory per pod,
and Django request rate, status codes, per-view traffic and p95 latency.
Generate some traffic in the Pulse UI so the Django panels have data.

> Grafana has no persistent volume. If its pod restarts, dashboards and data
> sources are lost — just re-add the data source and re-import `pulse-dashboard.json`.

### 6.7 Useful queries (Grafana → Explore)

```
sum(rate(container_cpu_usage_seconds_total{namespace="app-namespace", pod!=""}[5m])) by (pod)
sum(container_memory_working_set_bytes{namespace="app-namespace", pod!=""}) by (pod)
sum(kube_pod_container_status_restarts_total{namespace="app-namespace"}) by (pod)
sum(rate(django_http_responses_total_by_status_total[5m])) by (status)
```

---

## 7. Troubleshooting (every error hit during setup, with the fix)

| Symptom | Cause | Fix |
|---|---|---|
| Prometheus target `backend` DOWN: **404 Not Found** | Django had no `/metrics` route, and/or the scrape config used a custom `metrics_path: /prometheus/metrics` | Add the `django_prometheus` URL include (6.1), remove the custom `metrics_path` so the default `/metrics` is used |
| `/metrics` still 404 after changing code | The running pod still uses the old image (Dockerfile installs **`requirements/development.txt`**, or the image was never rebuilt) | Add `django-prometheus` to `base.txt` and make sure `development.txt` has `-r base.txt`. Rebuild with a **new tag** (`minikube image build -t pulse-backend:vN .`), `kubectl set image`, then check `kubectl exec deploy/backend -n app-namespace -- pip show django-prometheus` |
| `Unable to listen on port 8080 … forbidden by its access permissions` | Windows has reserved that port (Hyper-V/WinNAT) | Use another local port: `kubectl port-forward ... 8081:80`. See reserved ranges: `netsh interface ipv4 show excludedportrange protocol=tcp` |
| Django crashes on startup after editing `settings.py` | App named `"django-prometheus"` (hyphen), missing `]` on `INSTALLED_APPS`, extra `]` on `MIDDLEWARE` | Use `"django_prometheus"`; keep the lists syntactically closed |
| Metrics collected wrongly / middleware errors | Prometheus middleware in the wrong position | `PrometheusBeforeMiddleware` first, `PrometheusAfterMiddleware` last |
| Prometheus target `backend` DOWN: **400 Bad Request** | `ALLOWED_HOSTS` doesn't contain `backend-service` | Add `backend-service` to the `ALLOWED_HOSTS` env var in the backend Deployment (the env var overrides the default in `base.py`) |
| `kubectl top pods`: **Metrics API not available** | metrics-server needs 1–2 minutes after `minikube addons enable metrics-server` | Wait, check `kubectl get pods -n kube-system \| findstr metrics-server` shows `1/1 Running` |
| Edited the monitoring YAML but nothing changed | An old copy of the file was applied, or Prometheus wasn't restarted (`subPath` mounts don't hot-reload) | Apply the new `monitoring.yaml` and run `kubectl rollout restart deployment/monitoring-deployment -n app-namespace`; `apply` should print `serviceaccount/prometheus created` the first time |
| `kubelet` / cAdvisor target DOWN with 403 | Missing RBAC or `serviceAccountName: prometheus` | Use the provided `monitoring.yaml` (contains ServiceAccount, ClusterRole, ClusterRoleBinding and sets `serviceAccountName`) |
| `kube-state-metrics` target DOWN / not found | kube-state-metrics isn't installed | See 6.3 |
| Imported community dashboard **15760** shows "No data" and empty dropdowns | It expects a `cluster` label and kube-prometheus-stack job names that this setup doesn't have | Use `pulse-dashboard.json` instead |
| Grafana CPU / memory panels empty | On this cluster the cAdvisor pod rows have `namespace` and `pod` labels but **no `container` or `image` label**, so filters like `container!=""` or `image!=""` match nothing | Filter only on `namespace` and `pod!=""` (as in the provided dashboard) |
| Grafana data source test fails with `localhost:9090` | Grafana runs inside the cluster; `localhost` is Grafana's own pod | Use `http://monitoring-service:9090` |
| `ErrImagePull` / `ImagePullBackOff` after `set image` | Image exists only in minikube's local store but the pull policy tries a registry | Build with `minikube image build`, and set `imagePullPolicy: IfNotPresent` on the container |
| `helm : not recognized` | Helm isn't installed | Use the `kubectl apply -k` command in 6.3, or `winget install Helm.Helm` and reopen PowerShell |
| Grafana dashboards vanished | Grafana pod restarted (no volume) | Re-add the data source and re-import `pulse-dashboard.json`; keep that file in the repo |
| Django panels in Grafana flat / empty | No traffic yet | Use the app for a minute, then refresh |

Quick health checklist when something looks wrong:

```powershell
kubectl get pods -n app-namespace
kubectl logs deploy/backend -n app-namespace
kubectl get pods -n kube-system | findstr "kube-state metrics-server"
# Prometheus -> Status -> Target health: all 4 jobs UP?
```

---

## 8. What's intentionally not included yet

CI/CD, Terraform and persistent storage for Grafana/Prometheus are not part of this
deliverable. The codebase is structured (settings split by environment, modular
Django apps, a clean frontend API layer) so those can be layered on without
restructuring the application.

---

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