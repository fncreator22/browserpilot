/**
 * §MULTI-INSTANCE & HORIZONTAL SCALABILITY READINESS AUDIT (TASK-035)
 * 
 * Maps process-local state vs distributed requirements for horizontal
 * cluster scaling across AWS ECS Fargate tasks.
 */

export interface ComponentScalabilityStatus {
  component: string;
  currentMode: "PROCESS_LOCAL" | "STATELESS" | "DISTRIBUTED" | "DATABASE_BACKED";
  horizontalScalingSafe: boolean;
  productionAwsRequirement: string;
  notes: string;
}

export interface MultiInstanceReadinessReport {
  overallReadiness: "READY_FOR_SINGLE_INSTANCE_CONTAINER" | "REQUIRES_DISTRIBUTED_SERVICES_FOR_CLUSTER";
  components: ComponentScalabilityStatus[];
}

export function getMultiInstanceReadinessReport(): MultiInstanceReadinessReport {
  const components: ComponentScalabilityStatus[] = [
    {
      component: "Authentication & Sessions",
      currentMode: "STATELESS",
      horizontalScalingSafe: true,
      productionAwsRequirement: "NEXTAUTH_SECRET configured on all container tasks",
      notes: "NextAuth JWT session tokens are cryptographically signed and stateless across instances.",
    },
    {
      component: "Rate Limiter & Abuse Resistance",
      currentMode: process.env.REDIS_URL ? "DISTRIBUTED" : "PROCESS_LOCAL",
      horizontalScalingSafe: !!process.env.REDIS_URL,
      productionAwsRequirement: "AWS ElastiCache (Redis) or standalone Redis cluster",
      notes: process.env.REDIS_URL
        ? "Connected to Redis distributed rate limiter."
        : "Using in-memory sliding window rate limiter. Safe for single container or per-instance throttles.",
    },
    {
      component: "Autonomous Watch Scheduler",
      currentMode: "DATABASE_BACKED",
      horizontalScalingSafe: true,
      productionAwsRequirement: "Database row locking or AWS EventBridge / CloudWatch scheduled rules",
      notes: "Scheduler relies on lockedAt / lockOwner row level locks in DiscoveryWatch database model.",
    },
    {
      component: "Artifact & Screenshot Storage",
      currentMode: process.env.BLOB_READ_WRITE_TOKEN ? "DISTRIBUTED" : "PROCESS_LOCAL",
      horizontalScalingSafe: !!process.env.BLOB_READ_WRITE_TOKEN,
      productionAwsRequirement: "AWS S3 Bucket or Vercel Blob CDN",
      notes: process.env.BLOB_READ_WRITE_TOKEN
        ? "Using Vercel Blob object store."
        : "Using local filesystem storage. Requires S3 adapter for multi-instance cluster.",
    },
    {
      component: "Payment Gateway Adapter",
      currentMode: "STATELESS",
      horizontalScalingSafe: true,
      productionAwsRequirement: "Razorpay webhook secret configured",
      notes: "Payment processing and signature validation are stateless and transaction-persisted.",
    },
    {
      component: "AI Usage Governance",
      currentMode: "DATABASE_BACKED",
      horizontalScalingSafe: true,
      productionAwsRequirement: "Managed relational database (RDS PostgreSQL / Aurora)",
      notes: "AI usage events and entitlement limits are resolved and persisted directly in the relational database.",
    },
  ];

  const hasLocalOnlyBlockers = components.some((c) => !c.horizontalScalingSafe);

  return {
    overallReadiness: hasLocalOnlyBlockers
      ? "REQUIRES_DISTRIBUTED_SERVICES_FOR_CLUSTER"
      : "READY_FOR_SINGLE_INSTANCE_CONTAINER",
    components,
  };
}
