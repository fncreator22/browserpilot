# BrowserPilot — PostgreSQL & AWS EventBridge / CloudWatch Scheduler Runbook (TASK-021)

This guide documents the production deployment architecture for BrowserPilot's PostgreSQL persistence layer and AWS EventBridge / CloudWatch scheduled discovery triggers.

---

## 1. Environment Variable Configuration

| Variable Name | Environment | Description | Required | Example |
| :--- | :---: | :--- | :---: | :--- |
| `DATABASE_URL` | Production / Staging | Connection URI for AWS RDS PostgreSQL / Aurora Serverless v2 | **YES** | `postgresql://bp_user:StrongPass123@db.prod.internal:5432/browserpilot?schema=public&sslmode=require` |
| `CRON_SECRET` | Production / Staging | 256-bit cryptographically secure secret authenticating external scheduler invocations | **YES** | `bp_cron_live_8f3a9e2c4d1b7e5f...` |
| `NEXTAUTH_URL` | Production / Staging | Canonical application base URL for alert deep links | **YES** | `https://browserpilot.ai` |
| `NEXTAUTH_SECRET` | Production / Staging | JWT and session signing secret | **YES** | `bp_auth_secret_...` |
| `APP_ENV` | Production / Staging | Deployment environment identifier | **YES** | `production` |

---

## 2. Database Migration Strategy

### Step 1: Provision Managed PostgreSQL (AWS RDS / Aurora)
* Target Engine: **PostgreSQL 15+** or **Aurora PostgreSQL Serverless v2**
* Parameter Group: Enable connection pooling (`pg_stat_statements`, `max_connections >= 100`).

### Step 2: Apply Production DDL
Apply the verified PostgreSQL DDL schema:
```bash
# Option A: Direct DBA Migration Execution
psql "$DATABASE_URL" -f infra/postgres-migration.sql

# Option B: Prisma Schema Deployment
npx prisma db push --skip-generate
```

---

## 3. AWS EventBridge / CloudWatch Scheduler Integration

### Architecture
```
AWS EventBridge Scheduler (cron: 0/15 * * * ? *)
   │
   ├──> HTTPS POST https://api.browserpilot.ai/api/discovery/scheduler
   │    ├── Header: Authorization: Bearer <CRON_SECRET>
   │    └── Body: { "maxWatches": 20, "concurrencyLimit": 4 }
   │
   └──> Failure Fallback: AWS SQS Dead-Letter Queue (DLQ)
```

### AWS CLI Creation Command
```bash
aws scheduler create-schedule \
  --name "browserpilot-discovery-scheduler" \
  --group-name "default" \
  --schedule-expression "cron(0/15 * * * ? *)" \
  --flexible-time-window '{"Mode": "FLEXIBLE", "MaximumWindowInMinutes": 5}' \
  --state "ENABLED" \
  --target '{
    "Arn": "arn:aws:scheduler:::aws-sdk:apigateway:post",
    "RoleArn": "arn:aws:iam::123456789012:role/BrowserPilotSchedulerRole",
    "Input": "{\"endpoint\": \"https://api.browserpilot.ai/api/discovery/scheduler\", \"headers\": {\"Authorization\": \"Bearer <CRON_SECRET>\", \"Content-Type\": \"application/json\"}, \"body\": {\"maxWatches\": 20, \"concurrencyLimit\": 4}}",
    "RetryPolicy": {
      "MaximumRetryAttempts": 2,
      "MaximumEventAgeInSeconds": 300
    },
    "DeadLetterConfig": {
      "Arn": "arn:aws:sqs:us-east-1:123456789012:browserpilot-scheduler-dlq"
    }
  }'
```

---

## 4. Multi-Worker Lease Locking & Distributed Mutual Exclusion

1. **Atomic Lease Claim**:
   `claimDiscoveryWatch` executes an atomic SQL `UPDATE discovery_watches SET lockedAt = now(), lockOwner = $1 WHERE userId = $2 AND enabled = true AND (lockedAt IS NULL OR lockedAt <= $staleCutoff)`.
2. **ACID Transaction Isolation**:
   Concurrent requests targeting the same user watch will have exactly one worker obtain `res.count === 1`; subsequent concurrent workers obtain `res.count === 0` and skip cleanly without blocking.
3. **Stale Lease Recovery**:
   If a worker crashes mid-run, any lease older than `maxLeaseAgeMs` (default 120 seconds) is automatically reclaimed by the next scheduler cycle.
4. **Idempotent Invocations**:
   Duplicate cron triggers from EventBridge will find zero due watches and exit in `<50ms` with status `"EMPTY"`.
