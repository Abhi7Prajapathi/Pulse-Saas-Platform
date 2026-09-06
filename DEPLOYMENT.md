# Pulse — Local Kubernetes Deployment Guide (minikube)

This walks through spinning up the full stack (Postgres, Redis, Django backend, React frontend, nginx Ingress) on minikube, from a completely fresh machine.

---

## Prerequisites

- Docker Desktop installed and running
- `minikube` installed
- `kubectl` installed
- Docker Hub account with push access to your images (`abhilashr7/pulse-saas-platform-backend`, `abhilashr7/pulse-saas-platform-frontend`)

---

## 1. Start minikube

```bash
minikube start
minikube status
```

Confirm `host`, `kubelet`, and `apiserver` all show `Running`.

## 2. Enable the ingress addon

```bash
minikube addons enable ingress
kubectl get pods -n ingress-nginx
```

Wait until the ingress controller pod shows `Running`.

## 3. Apply the manifests (in order)

Namespace first, everything else after:

```bash
cd k8s
kubectl apply -f namespace.yml
kubectl apply -f configmap.yml
kubectl apply -f postgres.yml
kubectl apply -f redis.yml
kubectl apply -f backend.yml
kubectl apply -f frontend.yml
kubectl apply -f ingress.yml
```

Check everything is up:

```bash
kubectl get pods -n app-namespace
```

All pods should show `1/1 Running`.

## 4. Run database migrations

```bash
kubectl exec -it deployment/backend -n app-namespace -- python manage.py migrate
```

## 5. Create an admin account (first time only)

```bash
kubectl exec -it deployment/backend -n app-namespace -- python manage.py createsuperuser
```

Use an email, a username that isn't the same as the email, and a password 8+ characters.

## 6. Point your browser at the cluster

**If you're on Docker Desktop driver on Windows/Mac (most common):**

Open a **separate terminal window** and run, then leave it running:

```bash
minikube tunnel
```

Add this line to your hosts file (`C:\Windows\System32\drivers\etc\hosts` on Windows, `/etc/hosts` on Mac/Linux — needs admin/sudo to edit):

```
127.0.0.1   myapp.local
```

**If you're on Linux with the docker or none driver:**

```bash
minikube ip
```

Use that IP instead of `127.0.0.1` in the hosts file, and you can skip `minikube tunnel`.

## 7. Open the app

Go to **http://myapp.local/login** in your browser and log in.

---

## Every time you change code and want to redeploy

**Backend:**
```bash
cd backend
docker build -t abhilashr7/pulse-saas-platform-backend .
docker push abhilashr7/pulse-saas-platform-backend
kubectl rollout restart deployment backend -n app-namespace
```

**Frontend:**
```bash
cd frontend
docker build -t abhilashr7/pulse-saas-platform-frontend .
docker push abhilashr7/pulse-saas-platform-frontend
kubectl rollout restart deployment frontend -n app-namespace
```

**Editing a YAML file (configmap, deployment, ingress, etc.):**
```bash
kubectl apply -f <file>.yml -n app-namespace
```
Editing the file alone does nothing — `kubectl apply` is what actually syncs it to the cluster.

**If a rollout restart doesn't seem to pick up your new image** (common with the `latest` tag on minikube), force it:
```bash
kubectl delete pod -l app=<backend-or-frontend> -n app-namespace
```

---

## Everyday commands

| Task | Command |
|---|---|
| See all pods | `kubectl get pods -n app-namespace` |
| See a Deployment's desired vs ready replicas | `kubectl get deployment <name> -n app-namespace` |
| Tail logs | `kubectl logs deployment/<name> -n app-namespace` |
| Shell into a pod | `kubectl exec -it deployment/<name> -n app-namespace -- /bin/sh` |
| Django shell | `kubectl exec -it deployment/backend -n app-namespace -- python manage.py shell` |
| List all users | In Django shell: `from django.contrib.auth import get_user_model; get_user_model().objects.values('id','username','email','is_superuser')` |
| Reset a user's password | `kubectl exec -it deployment/backend -n app-namespace -- python manage.py changepassword <email>` |
| Why is a pod not starting | `kubectl describe pod <pod-name> -n app-namespace` (check Events at the bottom) |
| Check ingress has an address bound | `kubectl get ingress -n app-namespace` |

---

## Shutting down

```bash
minikube stop
```
Data in the Postgres PVC persists across `minikube stop`/`start`. Running `minikube delete` wipes everything, including the persistent volume.

---

## Notes on this setup

- **Postgres runs as a single replica with a PersistentVolumeClaim.** Never scale it beyond 1 replica without proper streaming replication configured — a second bare Postgres pod would have its own separate, disconnected data.
- **Frontend is served as a static production build** (`vite build` + `serve`), not the Vite dev server — this is what allows it to safely run multiple replicas behind the ingress. Do not switch back to `npm run dev` in the Docker image.
- **Backend and frontend are both stateless** and can be scaled to any number of replicas.
