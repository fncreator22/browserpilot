import assert from "node:assert";
import { MockRedisBroker } from "../fixtures/mockRedisBroker";
import { ExecutionLifecycleManager } from "@/lib/discovery/execution/executionLifecycleManager";
import { UserMemoryVault } from "@/lib/ai/memory/userMemoryVault";
import { RedisRateLimiter } from "@/lib/security/rateLimiter";
import { prisma } from "@/lib/db/prisma";

export async function runDistributedStateSyncTests(): Promise<void> {
  console.log("\n==================================================================");
  console.log("  TASK: DISTRIBUTED REDIS STATE SYNC & MULTI-INSTANCE VALIDATION  ");
  console.log("==================================================================");

  const broker = new MockRedisBroker();

  // Setup simulated Instance A
  const redisClientA = broker.createClient("instance-A-client");
  const redisSubscriberA = broker.createClient("instance-A-sub");
  const lifecycleManagerA = new ExecutionLifecycleManager({
    redisClient: redisClientA,
    redisSubscriber: redisSubscriberA,
  });
  const rateLimiterA = new RedisRateLimiter({ redisClient: redisClientA });
  const memoryVaultA = new UserMemoryVault({ redisClient: redisClientA });

  // Setup simulated Instance B
  const redisClientB = broker.createClient("instance-B-client");
  const redisSubscriberB = broker.createClient("instance-B-sub");
  const lifecycleManagerB = new ExecutionLifecycleManager({
    redisClient: redisClientB,
    redisSubscriber: redisSubscriberB,
  });
  const rateLimiterB = new RedisRateLimiter({ redisClient: redisClientB });
  const memoryVaultB = new UserMemoryVault({ redisClient: redisClientB });

  // --------------------------------------------------------------------------
  // TEST 1: Cross-Instance Search Cancellation
  // --------------------------------------------------------------------------
  console.log("\n[Test 1] Verifying Cross-Instance Search Cancellation via Redis Pub/Sub...");

  // Create a test user & search in database
  const testUser = await prisma.user.create({
    data: {
      email: `dist_test_${Date.now()}@browserpilot.test`,
      name: "Distributed Test User",
      passwordHash: "mock_hash_for_tests",
    },
  });


  const testSearch = await prisma.search.create({
    data: {
      user: { connect: { id: testUser.id } },
      rawQuery: "Distributed Engineer",
      status: "RUNNING",
    },
  });




  const abortControllerA = new AbortController();
  let searchWorkAborted = false;

  abortControllerA.signal.addEventListener("abort", () => {
    searchWorkAborted = true;
  });

  // 1. Instance A registers the execution in its local process memory
  lifecycleManagerA.registerExecution(
    testSearch.id,
    testUser.id,
    "canonical_hash_distributed_123",
    abortControllerA
  );

  assert.strictEqual(
    lifecycleManagerA.getExecutionHandle(testSearch.id) !== undefined,
    true,
    "Instance A must have the active execution handle in its local process"
  );
  assert.strictEqual(
    lifecycleManagerB.getExecutionHandle(testSearch.id),
    undefined,
    "Instance B must NOT have the execution handle in its process memory (separate server replica)"
  );
  assert.strictEqual(abortControllerA.signal.aborted, false, "Execution should not be aborted initially");

  // 2. User cancellation request hits Instance B (via load balancer)
  console.log("  -> Sending cancellation request to Instance B...");
  const cancelResult = await lifecycleManagerB.cancelExecution(testSearch.id, testUser.id, "USER_CANCELLED_ON_NODE_B");

  assert.strictEqual(cancelResult.success, true, "Instance B cancellation call must succeed");
  assert.strictEqual(cancelResult.status, "STOPPED", "Database status must transition to STOPPED");

  // Allow pub/sub event loop tick
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 3. Verify Instance A received the pub/sub event and aborted execution
  assert.strictEqual(
    abortControllerA.signal.aborted,
    true,
    "Instance A AbortController must be aborted by the Redis Pub/Sub message from Instance B"
  );
  assert.strictEqual(searchWorkAborted, true, "Abort event listener on Instance A must have fired");
  assert.strictEqual(
    abortControllerA.signal.reason,
    "USER_CANCELLED_ON_NODE_B",
    "Abort reason must match reason broadcast by Instance B"
  );
  assert.strictEqual(
    lifecycleManagerA.getExecutionHandle(testSearch.id),
    undefined,
    "Instance A must have unregistered the execution upon receiving the cancellation event"
  );

  // 4. Verify distributed cancellation query
  const isCancelled = await lifecycleManagerB.isExecutionCancelled(testSearch.id);
  assert.strictEqual(isCancelled, true, "isExecutionCancelled must confirm search is cancelled in Redis");

  console.log("  ✓ Cross-Instance Cancellation successfully propagated from Instance B -> Instance A via Redis Pub/Sub!");

  // --------------------------------------------------------------------------
  // TEST 2: Cross-Instance Globally Enforced Rate Limiting
  // --------------------------------------------------------------------------
  console.log("\n[Test 2] Verifying Global Rate Limiting Across Multiple Instances...");

  const rateLimitKey = `user_rate_test_${Date.now()}`;
  const maxLimit = 5;
  const windowSec = 10;

  // Instance A receives 3 requests
  console.log("  -> Instance A receiving 3 requests (limit: 5)...");
  const r1 = await rateLimiterA.check(rateLimitKey, maxLimit, windowSec);
  assert.strictEqual(r1.success, true, "Req 1 on Instance A must pass");
  assert.strictEqual(r1.remaining, 4, "Remaining after req 1 must be 4");

  const r2 = await rateLimiterA.check(rateLimitKey, maxLimit, windowSec);
  assert.strictEqual(r2.success, true, "Req 2 on Instance A must pass");
  assert.strictEqual(r2.remaining, 3, "Remaining after req 2 must be 3");

  const r3 = await rateLimiterA.check(rateLimitKey, maxLimit, windowSec);
  assert.strictEqual(r3.success, true, "Req 3 on Instance A must pass");
  assert.strictEqual(r3.remaining, 2, "Remaining after req 3 must be 2");

  // Instance B receives 2 requests (reaching the limit of 5 across both instances)
  console.log("  -> Instance B receiving 2 requests (reaching total 5 across cluster)...");
  const r4 = await rateLimiterB.check(rateLimitKey, maxLimit, windowSec);
  assert.strictEqual(r4.success, true, "Req 4 on Instance B must pass");
  assert.strictEqual(r4.remaining, 1, "Remaining after req 4 must be 1");

  const r5 = await rateLimiterB.check(rateLimitKey, maxLimit, windowSec);
  assert.strictEqual(r5.success, true, "Req 5 on Instance B must pass");
  assert.strictEqual(r5.remaining, 0, "Remaining after req 5 must be 0");

  // 6th request hitting Instance A must be BLOCKED
  console.log("  -> Sending 6th request to Instance A (must be rejected)...");
  const r6 = await rateLimiterA.check(rateLimitKey, maxLimit, windowSec);
  assert.strictEqual(r6.success, false, "Req 6 on Instance A must be rejected by global limit");
  assert.strictEqual(r6.remaining, 0, "Remaining must be 0");

  // 7th request hitting Instance B must also be BLOCKED
  console.log("  -> Sending 7th request to Instance B (must also be rejected)...");
  const r7 = await rateLimiterB.check(rateLimitKey, maxLimit, windowSec);
  assert.strictEqual(r7.success, false, "Req 7 on Instance B must be rejected by global limit");
  assert.strictEqual(r7.remaining, 0, "Remaining must be 0");

  // Reset rate limit from Instance A
  console.log("  -> Resetting rate limit from Instance A...");
  await rateLimiterA.reset(rateLimitKey);

  // Subsequent request on Instance B must now succeed
  const r8 = await rateLimiterB.check(rateLimitKey, maxLimit, windowSec);
  assert.strictEqual(r8.success, true, "Req on Instance B after Instance A reset must succeed");
  assert.strictEqual(r8.remaining, 4, "Remaining after reset must be 4");

  console.log("  ✓ Rate limits are strictly unified across instances (not doubled or bypassed)!");

  // --------------------------------------------------------------------------
  // TEST 3: Cross-Instance User Career Memory Synchronization
  // --------------------------------------------------------------------------
  console.log("\n[Test 3] Verifying User Career Memory Cache Across Instances...");

  const memUser = `mem_user_${Date.now()}`;

  // Instance A stores memory
  console.log("  -> Instance A storing user career memory...");
  const storeRes = await memoryVaultA.storeMemory({
    userId: memUser,
    category: "CAREER_PREFERENCE",
    key: "primary_role",
    value: "Principal Systems Architect",
    confidence: "EXPLICIT",
    importance: 0.95,
  });


  assert.strictEqual(storeRes.success, true, "storeMemory on Instance A must succeed");

  // Instance B queries memories for this user
  console.log("  -> Instance B querying memories for user...");
  const retrievedB = await memoryVaultB.getMemories({ userId: memUser });

  assert.strictEqual(retrievedB.totalRetrieved, 1, "Instance B must retrieve the memory stored by Instance A");
  assert.strictEqual(retrievedB.memories[0].value, "Principal Systems Architect", "Memory value must match");
  assert.strictEqual(retrievedB.memories[0].key, "primary_role", "Memory key must match");

  // Instance B deletes the memory
  console.log("  -> Instance B deleting the memory...");
  const deleteRes = await memoryVaultB.deleteMemory(memUser, "primary_role");
  assert.strictEqual(deleteRes, true, "deleteMemory on Instance B must succeed");

  // Instance A queries memories; verify it is no longer retrieved
  console.log("  -> Instance A querying memories after Instance B deletion...");
  const retrievedA = await memoryVaultA.getMemories({ userId: memUser });
  assert.strictEqual(retrievedA.totalRetrieved, 0, "Instance A must no longer return the deleted memory");

  console.log("  ✓ User memory operations on Instance A are immediately consistent on Instance B!");

  // Cleanup test search and user
  await prisma.search.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: testUser.id } }).catch(() => {});

  console.log("\n==================================================================");
  console.log("  ✅ ALL DISTRIBUTED STATE SYNC TESTS PASSED SUCCESSFULLY!        ");
  console.log("==================================================================\n");
}

if (process.argv[1]?.includes("distributedStateSync.test.ts")) {
  runDistributedStateSyncTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ DISTRIBUTED STATE SYNC TEST FAILED:", err);
      process.exit(1);
    });
}
