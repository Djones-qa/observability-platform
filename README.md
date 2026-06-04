# Observability & Distributed Tracing Platform

[![CI](https://github.com/Djones-qa/observability-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/Djones-qa/observability-platform/actions/workflows/ci.yml)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-1.x-blueviolet?logo=opentelemetry)](https://opentelemetry.io/)
[![Jaeger](https://img.shields.io/badge/Jaeger-1.53-blue?logo=jaeger)](https://www.jaegertracing.io/)
[![Prometheus](https://img.shields.io/badge/Prometheus-2.48-orange?logo=prometheus)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Grafana-10.2-F46800?logo=grafana)](https://grafana.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.28-326CE5?logo=kubernetes)](https://kubernetes.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A production-grade observability platform demonstrating the full telemetry stack: distributed tracing, metrics collection, dashboarding, and alerting — wired together with OpenTelemetry and deployable locally with Docker Compose or to Kubernetes via Helm-ready manifests.

---

## Stack

| Component | Role |
|---|---|
| **OpenTelemetry SDK** | Instrumentation for traces, metrics, and logs in each service |
| **OTel Collector** | Central telemetry pipeline — receives, processes, and exports |
| **Jaeger** | Distributed trace collection and UI |
| **Prometheus** | Metrics scraping and time-series storage |
| **Grafana** | Dashboards and alerting visualization |
| **Alertmanager** | Alert routing with Slack webhook integration |
| **TypeScript + Node.js** | Three instrumented microservices (api-gateway, order-service, inventory-service) |
| **Docker Compose** | Full local stack in one command |
| **Kubernetes** | Manifests for production deployment |
| **GitHub Actions** | CI pipeline validating configs, lint, and type checks |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Requests                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Gateway   │  :3000
                    │  (TypeScript)   │
                    └────┬───────┬────┘
                         │       │
           ┌─────────────▼─┐   ┌─▼──────────────────┐
           │ Order Service │   │ Inventory Service   │
           │  (TypeScript) │   │   (TypeScript)      │
           │    :3001       │   │       :3002         │
           └───────────────┘   └─────────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              │ OTLP (gRPC :4317)
                    ┌─────────▼──────────┐
                    │   OTel Collector   │
                    │  (Receives, Batch) │
                    └────┬──────────┬───┘
                         │          │
              ┌──────────▼──┐   ┌───▼──────────┐
              │   Jaeger    │   │  Prometheus  │
              │   Traces    │   │   Metrics    │
              │   :16686    │   │   :9090      │
              └─────────────┘   └──────┬───────┘
                                       │
                              ┌────────▼────────┐
                              │    Grafana      │
                              │  Dashboards     │  :3003
                              └────────────────-┘
                              ┌─────────────────┐
                              │  Alertmanager   │  :9093
                              │  → Slack        │
                              └─────────────────┘
```

---

## Quick Start — Docker Compose

**Prerequisites:** Docker Desktop 4.x+, Docker Compose v2

```bash
git clone https://github.com/Djones-qa/observability-platform.git
cd observability-platform

# Optional: set Slack webhook for alerts
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Start the full stack
docker compose up --build -d

# Follow logs
docker compose logs -f
```

### Access the UIs

| Service | URL | Credentials |
|---|---|---|
| API Gateway | http://localhost:3000 | — |
| Jaeger UI | http://localhost:16686 | — |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3003 | admin / observability |
| Alertmanager | http://localhost:9093 | — |
| OTel zPages | http://localhost:55679/debug/tracez | — |

### Generate traces

```bash
# Hit the API Gateway to produce traces
curl http://localhost:3000/api/orders

# Create an order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"cust-001","items":[{"productId":"prod-x1","quantity":2,"price":29.99}]}'

# Check inventory directly
curl http://localhost:3002/inventory
```

Then open Jaeger at http://localhost:16686 and select the `api-gateway` service to see traces.

### Tear down

```bash
docker compose down -v
```

---

## Project Structure

```
observability-platform/
├── .github/
│   └── workflows/
│       └── ci.yml                  # CI — lint, typecheck, config validation, Docker build
├── services/
│   ├── api-gateway/                # Express gateway, fan-out to downstream services
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── tracing.ts          # OTel SDK bootstrap
│   │   │   └── routes/
│   │   │       ├── orders.ts
│   │   │       └── health.ts
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── order-service/              # Order CRUD with OTel instrumentation
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   └── tracing.ts
│   │   └── Dockerfile
│   └── inventory-service/          # Inventory management with stock metrics
│       ├── src/
│       │   ├── server.ts
│       │   └── tracing.ts
│       └── Dockerfile
├── otel-collector/
│   └── otel-collector-config.yaml  # Receivers, processors, exporters pipeline
├── prometheus/
│   ├── prometheus.yml              # Scrape configs for all services
│   └── alert-rules.yml             # Alert rules (service down, latency, stock levels)
├── grafana/
│   ├── provisioning/               # Auto-provisioned datasources and dashboard folders
│   └── dashboards/
│       ├── services-overview.json  # Request rates, latency, error rates
│       └── jvm-runtime.json        # Node.js heap, event loop, GC metrics
├── alertmanager/
│   └── alertmanager.yml            # Slack routing with severity-based channels
├── k8s/
│   ├── namespace.yaml
│   ├── api-gateway/deployment.yaml
│   ├── otel-collector/             # Deployment + ConfigMap
│   ├── jaeger/deployment.yaml
│   ├── prometheus/deployment.yaml  # With RBAC + PVC
│   └── grafana/deployment.yaml     # With PVC + Ingress + Secret
├── docker-compose.yml
├── package.json                    # npm workspaces root
├── tsconfig.base.json
├── LICENSE
└── README.md
```

---

## Instrumentation Details

Each service bootstraps the OTel SDK in `tracing.ts` before any other imports:

```typescript
// server.ts — tracing must come first
import './tracing';
import express from 'express';
```

Traces are exported via OTLP/gRPC to the collector, which fans out to Jaeger. Metrics are exported on a 10-second interval and scraped by Prometheus via the collector's Prometheus exporter endpoint (`:8889`).

**Custom metrics per service:**

| Service | Metric | Type |
|---|---|---|
| api-gateway | `api_gateway_requests_total` | Counter |
| api-gateway | `api_gateway_request_duration_ms` | Histogram |
| order-service | `orders_created_total` | Counter |
| order-service | `order_processing_duration_ms` | Histogram |
| inventory-service | `inventory_checks_total` | Counter |
| inventory-service | `inventory_stock_level` | Observable Gauge |

---

## Grafana Dashboards

Two dashboards are auto-provisioned on startup:

- **Services Overview** — request rates, p99 latency, error rate, order volume, inventory stock levels
- **Node.js Runtime Metrics** — heap used/total, event loop lag (p99), active handles, GC duration, CPU usage

---

## Alert Rules

| Alert | Severity | Condition |
|---|---|---|
| ServiceDown | critical | `up == 0` for 1m |
| HighErrorRate | warning | 5xx rate > 5% for 2m |
| HighRequestLatency | warning | p99 > 1s for 5m |
| APIGatewayHighLatency | warning | p95 > 500ms for 3m |
| LowInventoryStock | warning | stock < 10 units for 5m |
| OutOfStock | critical | stock == 0 for 1m |
| OtelCollectorHighMemory | warning | RSS > 400MB for 5m |

---

## Kubernetes Deployment

Apply manifests in order:

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Deploy infrastructure
kubectl apply -f k8s/otel-collector/
kubectl apply -f k8s/jaeger/
kubectl apply -f k8s/prometheus/
kubectl apply -f k8s/grafana/

# Deploy services
kubectl apply -f k8s/api-gateway/

# Check rollout
kubectl rollout status deployment/api-gateway -n observability
```

---

## CI Pipeline

The GitHub Actions workflow runs on every push to `main` / `develop` and on pull requests:

1. **Lint & Type Check** — `tsc --noEmit` for each service (matrix)
2. **Build** — full TypeScript compile, artifact upload
3. **Validate Configs** — OTel Collector, Prometheus, alert rules, Alertmanager via official Docker images
4. **Validate K8s Manifests** — `kubeconform` against Kubernetes 1.28 schemas
5. **Docker Build** — multi-stage build validation for each service image

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SLACK_WEBHOOK_URL` | placeholder | Slack incoming webhook for Alertmanager |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana admin username |
| `GRAFANA_ADMIN_PASSWORD` | `observability` | Grafana admin password |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4317` | OTLP gRPC endpoint for services |
| `NODE_ENV` | `development` | Node environment |

---

## Author

**Darrius Jones**

[![GitHub](https://img.shields.io/badge/GitHub-Djones--qa-181717?logo=github)](https://github.com/Djones-qa)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-darrius--jones--28226b350-0A66C2?logo=linkedin)](https://linkedin.com/in/darrius-jones-28226b350)

---

## License

[MIT](./LICENSE) © 2024 Darrius Jones
