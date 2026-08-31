# BrowserPilot — Production Architecture & AWS Readiness Specification

This document provides the canonical architectural blueprint and deployment readiness specification for BrowserPilot on Amazon Web Services (AWS).

---

## 1. Executive Overview

BrowserPilot is architected as a Next.js 16 full-stack autonomous discovery and career intelligence engine. While local development uses SQLite/libSQL and process-local sliding-window memory adapters, the core domain layers are strictly decoupled and prepared for horizontally scaled container clusters on AWS.

```
                  +-----------------------------------+
                  |   AWS Application Load Balancer   |
                  |     (TLS Termination & HTTPS)     |
                  +-----------------+-----------------+
                                    |
                    /api/health/*   |   HTTP Traffic
                                    v
                  +-----------------------------------+
                  |      AWS ECS Fargate Cluster      |
                  |   [Task 1]   [Task 2]   [Task 3]  |
                  +-------+----------+---------+------+
                          |          |         |
         +----------------+          |         +----------------+
         v                           v                          v
+-------------------+      +-------------------+      +-------------------+
|  AWS RDS Postgres |      |  AWS ElastiCache  |      |   AWS S3 Bucket   |
| (Aurora Serverless|      |   (Redis Cluster  |      | (Screenshots and  |
|  v2 / Postgres 16)|      |  Rate Limiting)   |      | Job Artifacts)    |
+-------------------+      +-------------------+      +-------------------+
```

---

## 2. Environment Variable Contract

The application categorizes all configuration into strict security and operational boundaries:

| Variable Name | Category | Secret | Description |
| :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_APP_URL` | Public Browser | No | Web application canonical URL |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Public Browser | No | Razorpay Public Key ID |
| `NEXTAUTH_SECRET` | Server Secret | **Yes** | Cryptographic signing secret for JWT tokens |
| `ADMIN_SECRET_KEY` | Server Secret | **Yes** | Bearer secret for headless admin control plane |
| `SCHEDULER_CRON_SECRET` | Server Secret | **Yes** | Authentication secret for discovery cron triggers |
| `DATABASE_URL` | Database | **Yes** | Connection string for PostgreSQL / LibSQL |
| `NODE_ENV` | Infrastructure | No | `development` / `test` / `production` |
| `AWS_REGION` | Infrastructure | No | Target AWS region (e.g. `us-east-1`, `ap-south-1`) |
| `RAZORPAY_KEY_SECRET` | Payment | **Yes** | Private HMAC signing secret for payments |
| `RAZORPAY_WEBHOOK_SECRET` | Payment | **Yes** | Webhook verification secret |
| `GEMINI_API_KEY` | AI Provider | **Yes** | Fallback server-managed AI Studio API Key |
| `REDIS_URL` | Infrastructure | **Yes** | Connection string for ElastiCache Redis cluster |
| `BLOB_READ_WRITE_TOKEN` | Storage | **Yes** | S3 / Object Storage connection token |

---

## 3. Production Health & Readiness Boundaries

BrowserPilot implements dedicated health check endpoints for container orchestrators:

- **Liveness Probe**: `GET /api/health/liveness`
  - High-speed event-loop check.
  - Returns HTTP 200 `{ status: "LIVE", uptimeSeconds, version }`.
  - Zero external dependency queries; safe for 5-second interval ALB health checks.
- **Readiness Probe**: `GET /api/health/readiness`
  - Backing dependency validation (`SELECT 1` against the database).
  - Returns HTTP 200 `{ status: "READY", database: "HEALTHY" }` or HTTP 503 `{ status: "NOT_READY" }`.
- **System Health**: `GET /api/health`
  - General operational dashboard probe covering database, AI configuration, and storage mode.

---

## 4. Multi-Instance & Distributed State Boundaries

| Component | Local / Dev Mode | Production AWS Target | Distributed Boundary Pattern |
| :--- | :--- | :--- | :--- |
| **Sessions** | JWT in Cookie | JWT in Cookie | **Stateless**: Verified with `NEXTAUTH_SECRET`. |
| **Rate Limiter** | `MemoryRateLimiter` | AWS ElastiCache | Implements `RateLimiterAdapter` interface in `lib/security/rateLimiter.ts`. |
| **Scheduler** | In-Process Watchdog | Database Row Lock & CloudWatch Events | `lockedAt` / `lockOwner` database fields prevent duplicate worker execution. |
| **Artifact Storage**| Local disk `/tmp/` | AWS S3 / CloudFront | Decoupled behind `lib/storage/artifact-storage.ts`. |
| **Billing & Payments**| SQLite / Memory | RDS PostgreSQL / Razorpay | Strictly server-authoritative state via `PaymentGatewayAdapter`. |
| **Audit Logs** | In-memory buffer | CloudWatch Logs | Structured JSON logging in `lib/infra/logger.ts` with automated secret redaction. |

---

## 5. Database Migration Considerations

1. **Schema DDL**:
   - `prisma/schema.prisma` is compatible with PostgreSQL and SQLite.
   - For PostgreSQL production on AWS RDS, standard Prisma migration (`npx prisma migrate deploy`) will initialize relational tables with existing foreign keys and indexes.
2. **Connection Pooling**:
   - Production PostgreSQL deployments should connect through **AWS RDS Proxy** or Prisma Accelerated connection strings (`pgbouncer=true`).
3. **Locking & Concurrency**:
   - `DiscoveryWatch` scheduling uses explicit `lockedAt` and `lockOwner` columns to guarantee mutual exclusion across multiple container tasks.

---

## 6. AWS Deployment Prerequisites

1. **Networking**: VPC with at least 2 public subnets (for ALB) and 2 private isolated subnets (for ECS tasks and RDS/ElastiCache).
2. **Compute**: AWS ECS Cluster using AWS Fargate task definitions (0.5 vCPU / 1 GB memory per task).
3. **Database**: Amazon RDS for PostgreSQL (Multi-AZ in production).
4. **Secrets Management**: AWS Secrets Manager storing database credentials and API secrets, injected as container environment variables via ECS Task Execution Role.
5. **DNS & SSL**: AWS Route 53 with ACM (AWS Certificate Manager) SSL/TLS certificates attached to the ALB.

---

## 7. Status of Deployment Lock

- **AWS DEPLOYMENT LOCK**: **STRICTLY ACTIVE**
- No cloud resources have been created, modified, or provisioned during this task.
