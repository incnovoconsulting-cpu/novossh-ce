# NovoSSH Kubernetes Production Manifests

Production-ready Kubernetes manifests for NovoSSH deployment with HA, auto-scaling, security hardening, and monitoring.

## Quick Start

### 1. Create Namespace
```bash
kubectl apply -f k8s/namespace.yaml
```

### 2. Update Secrets
Edit `k8s/secrets.yaml` with your production values:
- PostgreSQL connection string
- Tailscale OAuth credentials
- Session and JWT secrets

### 3. Deploy Application
```bash
kubectl apply -f k8s/
```

### 4. Verify Deployment
```bash
kubectl -n novossh get pods
kubectl -n novossh get services
kubectl -n novossh get ingress
```

## Manifests

| File | Description |
|------|-------------|
| `namespace.yaml` | Dedicated namespace with labels |
| `configmap.yaml` | Non-secret configuration |
| `secrets.yaml` | Secrets template (update before deploy) |
| `deployment.yaml` | Main deployment (3 replicas, HA, probes) |
| `service.yaml` | ClusterIP service with WebSocket support |
| `ingress.yaml` | Ingress with TLS, WebSocket, security headers |
| `hpa.yaml` | HorizontalPodAutoscaler (3-10 replicas) |
| `pdb.yaml` | PodDisruptionBudget (minAvailable: 2) |
| `networkpolicy.yaml` | Restrict pod-to-pod traffic |
| `serviceaccount.yaml` | Dedicated service account |

## Architecture

```
Internet
    │
    ▼
┌─────────────────────────────────┐
│  Ingress (nginx)                │
│  - TLS termination              │
│  - WebSocket support            │
│  - Rate limiting                │
│  - Security headers             │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Service (ClusterIP)            │
│  - Load balancing               │
│  - Port 80 → 8787               │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Deployment (3 replicas)        │
│  - Rolling updates              │
│  - Pod anti-affinity            │
│  - Topology spread              │
│  - SecurityContext              │
│  - Liveness/readiness probes    │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  PostgreSQL (external)          │
│  - Encrypted connection         │
│  - Secret in k8s secrets        │
└─────────────────────────────────┘
```

## Security Features

- **Non-root containers**: Runs as user 1001
- **Read-only rootfs**: Prevents filesystem modifications
- **Dropped capabilities**: All Linux capabilities dropped
- **Seccomp profile**: RuntimeDefault seccomp profile
- **Network policies**: Restricts pod-to-pod traffic
- **TLS encryption**: All external traffic encrypted
- **Security headers**: XSS, CSRF, clickjacking protection

## Scaling

- **HPA**: Auto-scales based on CPU (70%) and memory (80%)
- **Min replicas**: 3 (HA)
- **Max replicas**: 10
- **Scale down**: 10% per minute with 5-minute stabilization
- **Scale up**: 50% per minute or 2 pods (whichever is higher)

## Monitoring

Prometheus annotations are included for:
- Pod scraping on port 8787
- Metrics endpoint at `/metrics`

## Prerequisites

1. **Kubernetes cluster**: 1.24+
2. **Ingress controller**: nginx-ingress
3. **Cert-manager**: For TLS certificates
4. **PostgreSQL**: External database

## Configuration

### Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
| NODE_ENV | ConfigMap | Environment (production) |
| PORT | ConfigMap | Server port (8787) |
| HOST | ConfigMap | Bind address (0.0.0.0) |
| DATABASE_URL | Secret | PostgreSQL connection string |
| TAILSCALE_CLIENT_ID | Secret | Tailscale OAuth client ID |
| TAILSCALE_CLIENT_SECRET | Secret | Tailscale OAuth secret |
| SESSION_SECRET | Secret | Express session secret |
| JWT_SECRET | Secret | JWT signing secret |

### Resource Limits

| Resource | Request | Limit |
|----------|---------|-------|
| CPU | 500m | 2000m |
| Memory | 256Mi | 512Mi |

## Troubleshooting

### Check Pod Status
```bash
kubectl -n novossh describe pod <pod-name>
kubectl -n novossh logs <pod-name>
```

### Check Health
```bash
kubectl -n novossh port-forward svc/novossh 8787:80
curl http://localhost:8787/api/health
```

### Check HPA
```bash
kubectl -n novossh get hpa
kubectl -n novossh describe hpa novossh
```

### Check Network Policies
```bash
kubectl -n novossh get networkpolicy
kubectl -n novossh describe networkpolicy novossh
```

## Updates

### Rolling Update
```bash
kubectl -n novossh set image deployment/novossh novossh=novossh:v0.2.0
```

### Rollback
```bash
kubectl -n novossh rollout undo deployment/novossh
kubectl -n novossh rollout history deployment/novossh
```

## Cleanup

```bash
kubectl delete -f k8s/
```

## Related

- `Dockerfile.tailscale` - Production Docker image
- `docker-compose.tailscale.yml` - Local development with Tailscale
- `PHASE3_PLAN.md` - Phase 3 implementation plan
- `ROADMAP.md` - Product roadmap
