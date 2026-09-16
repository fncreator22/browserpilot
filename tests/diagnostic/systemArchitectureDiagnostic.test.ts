/**
 * Comprehensive System Architecture & Infrastructure Diagnostic Suite
 * 
 * Verifies:
 * 1. Millisecond FIFO Queue with 1,000 prompt items batching & windowed dispatch
 * 2. Microservice domain rate limiting gateway (auth, payments, search, swarm)
 * 3. Scalable Database Router (Vertical Read/Write splitting & Horizontal Tenant Partitioning)
 * 4. Real-time Admin Observability & Latency Engine (p50/p90/p99, status codes 200/304/400/402/429/500, spike alerts)
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as any).NODE_ENV = "test";

import assert from "assert";
import { MillisecondFifoQueue } from "@/lib/queue/millisecondFifoQueue";
import {
  checkMicroserviceRateLimit,
  resetMicroserviceRateLimit,
  MICROSERVICE_POLICIES,
} from "@/lib/security/microserviceRateLimiter";
import { ScalableDatabaseRouter } from "@/lib/db/scalableDatabaseRouter";
import { TelemetryEngine } from "@/lib/observability/telemetryEngine";

export async function runSystemArchitectureDiagnosticTests() {
  console.log("\n=======================================================================");
  console.log("   SYSTEM ARCHITECTURE & INFRASTRUCTURE DIAGNOSTIC BENCHMARK SUITE    ");
  console.log("=======================================================================\n");

  // -------------------------------------------------------------
  // Test 1: Millisecond FIFO Queue with 1,000 Items & Batching
  // -------------------------------------------------------------
  console.log("▶ [TEST 1] Testing Millisecond FIFO Queue with 1,000 Simultaneous Items...");
  const queue = new MillisecondFifoQueue<number, number>("PROMPT", {
    batchSize: 10,
    tickIntervalMs: 0,
  });

  const processedOrder: number[] = [];
  queue.registerProcessor(async (batch) => {
    return batch.map((item) => {
      processedOrder.push(item.payload);
      return {
        itemId: item.id,
        success: true,
        result: item.payload * 2,
        durationMs: 1,
      };
    });
  });

  const totalItems = 1000;
  const payloads = Array.from({ length: totalItems }, (_, i) => i + 1);
  const startEnqueue = performance.now();
  const itemIds = queue.enqueueBatch(payloads);
  const enqueueDuration = performance.now() - startEnqueue;

  assert.strictEqual(itemIds.length, totalItems, "All 1,000 items must be enqueued");
  assert.strictEqual(queue.getMetrics().queuedCount, totalItems, "Backlog must reflect 1,000 items");
  console.log(`  ✓ Enqueued ${totalItems} items in ${enqueueDuration.toFixed(2)}ms (${(totalItems / enqueueDuration * 1000).toFixed(0)} ops/sec)`);

  // First tick: must dispatch exactly 10 items
  const firstTick = await queue.tick();
  assert.strictEqual(firstTick.length, 10, "First tick must dispatch exactly batchSize (10) items");
  assert.strictEqual(queue.getMetrics().queuedCount, 990, "Remaining backlog must be 990");
  assert.strictEqual(queue.getMetrics().processedCount, 10, "Processed count must be 10");
  console.log("  ✓ First millisecond window tick processed exactly 10 items in FIFO order");

  // Drain remaining 990 items
  const drainStart = performance.now();
  const remaining = await queue.drainAll();
  const drainDuration = performance.now() - drainStart;

  assert.strictEqual(remaining.length, 990, "Remaining 990 items must be drained");
  assert.strictEqual(queue.getMetrics().queuedCount, 0, "Queue backlog must be fully empty");
  assert.strictEqual(queue.getMetrics().processedCount, totalItems, "Total processed must be 1,000");

  // Verify strict FIFO order preservation
  assert.strictEqual(processedOrder.length, totalItems, "All 1,000 items must have processed");
  assert.strictEqual(processedOrder[0], 1, "First item processed must be 1");
  assert.strictEqual(processedOrder[9], 10, "10th item processed must be 10");
  assert.strictEqual(processedOrder[999], 1000, "1,000th item processed must be 1000");
  for (let i = 0; i < totalItems; i++) {
    assert.strictEqual(processedOrder[i], i + 1, `Index ${i} must preserve exact FIFO order`);
  }
  console.log(`  ✓ Drained 990 items across 99 batch ticks in ${drainDuration.toFixed(2)}ms (0 drops, strict FIFO)`);

  // Priority test
  console.log("\n▶ [TEST 2] Testing Priority Queue Channel Dispatching...");
  const priorityQueue = new MillisecondFifoQueue<string, string>("PAYMENT", {
    batchSize: 5,
    tickIntervalMs: 0,
  });

  const priorityProcessed: string[] = [];
  priorityQueue.registerProcessor(async (batch) => {
    return batch.map((item) => {
      priorityProcessed.push(item.payload);
      return { itemId: item.id, success: true, durationMs: 1 };
    });
  });

  priorityQueue.enqueue("normal-1", 10);
  priorityQueue.enqueue("normal-2", 10);
  priorityQueue.enqueue("priority-urgent-1", 1); // Arrived later but higher priority

  await priorityQueue.drainAll();
  assert.strictEqual(priorityProcessed[0], "priority-urgent-1", "High-priority item must be dispatched first");
  assert.strictEqual(priorityProcessed[1], "normal-1", "Normal items follow high-priority items");
  console.log("  ✓ High-priority lane successfully prioritized ahead of standard FIFO queue");

  // -------------------------------------------------------------
  // Test 3: Microservice Rate Limiter Gateway
  // -------------------------------------------------------------
  console.log("\n▶ [TEST 3] Testing Microservice Domain Rate Limiter Gateway...");
  const testIp = `test-ip-${Date.now()}`;
  await resetMicroserviceRateLimit("auth", testIp);

  const authLimit = MICROSERVICE_POLICIES.auth.limit; // 5
  for (let i = 0; i < authLimit; i++) {
    const check = await checkMicroserviceRateLimit("auth", testIp);
    assert.strictEqual(check.allowed, true, `Request #${i + 1} must be allowed within limit`);
    assert.strictEqual(check.remaining, authLimit - (i + 1), `Remaining must decrement to ${authLimit - (i + 1)}`);
  }
  console.log(`  ✓ Successfully allowed first ${authLimit} auth requests for ${testIp}`);

  // 6th request must be rejected with 429
  const rejected = await checkMicroserviceRateLimit("auth", testIp);
  assert.strictEqual(rejected.allowed, false, "6th request must be denied");
  assert.strictEqual(rejected.remaining, 0, "Remaining must be 0");
  assert.strictEqual(rejected.errorResponse?.status, 429, "Error response status must be HTTP 429");
  assert.ok(rejected.headers["Retry-After"], "Retry-After header must be set");
  console.log("  ✓ 6th request correctly blocked with HTTP 429 (Too Many Requests) & Retry-After header");

  // Tiered priority rate limit on search
  const proUser = `pro-user-${Date.now()}`;
  const freeUser = `free-user-${Date.now()}`;
  const freeCheck = await checkMicroserviceRateLimit("search", freeUser, false);
  const proCheck = await checkMicroserviceRateLimit("search", proUser, true);
  assert.strictEqual(freeCheck.limit, 20, "Free search limit is 20 req/min");
  assert.strictEqual(proCheck.limit, 120, "Pro search limit is 120 req/min");
  console.log("  ✓ Microservice rate limiter enforces 20 req/min for free and 120 req/min for Pro users");

  // -------------------------------------------------------------
  // Test 4: Scalable Database Router
  // -------------------------------------------------------------
  console.log("\n▶ [TEST 4] Testing Scalable Database Router (Vertical & Horizontal Sharding)...");
  const router = new ScalableDatabaseRouter();

  // Vertical Read/Write splitting
  router.setScalingMode("VERTICAL_PRIMARY_WITH_REPLICAS");
  const writeDec = router.routeOperation({ requiresWrite: true, queryType: "TRANSACTION" });
  assert.strictEqual(writeDec.targetRole, "PRIMARY", "Write queries must route to Primary Leader");
  assert.strictEqual(writeDec.shardId, "primary-0");

  const readDec = router.routeOperation({ requiresWrite: false, queryType: "SEARCH" });
  assert.strictEqual(readDec.targetRole, "READ_REPLICA", "Read queries must route to Read Replicas");
  assert.strictEqual(readDec.shardId, "replica-0");
  console.log("  ✓ Vertical Scaling: Writes -> Primary Leader, Reads -> Read-Replica Pool");

  // Horizontal Tenant Sharding
  router.setScalingMode("HORIZONTAL_TENANT_SHARDED");
  const tenantA1 = router.routeOperation({ requiresWrite: false, tenantId: "tenant_acme" });
  const tenantA2 = router.routeOperation({ requiresWrite: true, tenantId: "tenant_acme" });
  assert.strictEqual(tenantA1.shardId, tenantA2.shardId, "Same tenant must route consistently to the same shard");

  const clusterStatus = router.getClusterStatus();
  assert.ok(clusterStatus.totalNodes >= 2, "Cluster must register at least 2 database nodes");
  assert.strictEqual(clusterStatus.isOverloaded, false, "Cluster should not be in overloaded state");
  console.log(`  ✓ Horizontal Sharding: Tenant hashed across ${clusterStatus.virtualShardsAllocated} virtual buckets (Saturation: ${clusterStatus.connectionSaturationPercent}%)`);

  // -------------------------------------------------------------
  // Test 5: Admin Observability Telemetry Engine
  // -------------------------------------------------------------
  console.log("\n▶ [TEST 5] Testing Admin Observability Telemetry Engine & Latency Alerts...");
  const telemetry = new TelemetryEngine();
  telemetry.clear();

  // Ingest varied HTTP responses
  telemetry.recordRequest({ method: "GET", path: "/api/search", statusCode: 200, latencyMs: 25 });
  telemetry.recordRequest({ method: "GET", path: "/api/account/profile", statusCode: 304, latencyMs: 12 });
  telemetry.recordRequest({ method: "POST", path: "/api/auth/login", statusCode: 400, latencyMs: 35 });
  telemetry.recordRequest({ method: "POST", path: "/api/billing/checkout", statusCode: 402, latencyMs: 85 });
  telemetry.recordRequest({ method: "GET", path: "/api/search", statusCode: 429, latencyMs: 8 });
  telemetry.recordRequest({ method: "POST", path: "/api/search", statusCode: 500, latencyMs: 140 });

  const codeMetrics = telemetry.getStatusCodeMetrics();
  assert.strictEqual(codeMetrics.total, 6, "Total recorded requests must be 6");
  assert.strictEqual(codeMetrics.c200, 1, "Status 200 count must be 1");
  assert.strictEqual(codeMetrics.c304, 1, "Status 304 count must be 1");
  assert.strictEqual(codeMetrics.c400, 1, "Status 400 count must be 1");
  assert.strictEqual(codeMetrics.c402, 1, "Status 402 count must be 1");
  assert.strictEqual(codeMetrics.c429, 1, "Status 429 count must be 1");
  assert.strictEqual(codeMetrics.c500, 1, "Status 500 count must be 1");
  console.log("  ✓ Status code matrix accurate: 200 (1), 304 (1), 400 (1), 402 (1), 429 (1), 500 (1)");

  // Percentiles
  const percentiles = telemetry.getLatencyPercentiles();
  assert.strictEqual(percentiles.max, 140, "Max latency must match 140ms");
  assert.ok(percentiles.p50 >= 25, "Median latency must be calculated");
  console.log(`  ✓ Latency distribution calculated: p50=${percentiles.p50}ms, p90=${percentiles.p90}ms, max=${percentiles.max}ms`);

  // Latency alerts
  telemetry.recordRequest({ method: "POST", path: "/api/search", statusCode: 200, latencyMs: 450 }); // Warning spike
  telemetry.recordRequest({ method: "POST", path: "/api/search", statusCode: 500, latencyMs: 920 }); // Critical spike

  const snapshot = telemetry.getSnapshot();
  assert.strictEqual(snapshot.recentAlerts.length, 2, "Must capture 2 alerts");
  assert.strictEqual(snapshot.recentAlerts[0].level, "CRITICAL", "Latest alert must be CRITICAL");
  assert.strictEqual(snapshot.recentAlerts[1].level, "WARNING", "First alert must be WARNING");
  console.log(`  ✓ Latency spike alerts triggered: WARNING (450ms) and CRITICAL (920ms)`);

  const services = telemetry.getMicroserviceHealth();
  assert.ok(services.length >= 5, "Microservice health matrix tracks at least 5 core services");
  console.log(`  ✓ Health check matrix online for ${services.length} services (Auth, Payments, Search, Swarm, DB, Cache)`);

  console.log("\n=======================================================================");
  console.log("  ALL SYSTEM ARCHITECTURE & INFRASTRUCTURE TESTS PASSED (100% SUCCESS) ");
  console.log("=======================================================================\n");
}

// Run standalone if executed directly
if (require.main === module || process.argv[1]?.includes("systemArchitectureDiagnostic")) {
  runSystemArchitectureDiagnosticTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ System Architecture Diagnostic Suite Failed:\n", err);
      process.exit(1);
    });
}
