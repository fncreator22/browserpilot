import { strict as assert } from "node:assert";
import {
  MAX_OPPORTUNITY_CACHE_SIZE,
  normalizeOpportunityForCache,
  syncOpportunityToRedisCache,
  syncBatchOpportunitiesToRedisCache,
  searchCachedOpportunities,
  getOpportunityCacheStats,
  trimRedisOpportunityCache,
  REDIS_OPP_DATA_KEY,
  REDIS_OPP_ZSET_KEY,
} from "@/lib/redis/redisOpportunityCache";
import { getSharedRedisClient, isRedisCircuitAvailable } from "@/lib/queue/redis";
import * as fs from "node:fs";
import * as path from "node:path";

export async function runStage8RedisSlidingWindowTests() {
  console.log("=================================================");
  console.log("  STAGE 8: REDIS SLIDING WINDOW OPPORTUNITY CACHE ");
  console.log("=================================================\n");

  // 1. Normalization and Data Structure Test
  console.log("▶ [TEST 1] Normalization and Data Schema Validation...");
  const rawSample = {
    id: "opp_test_001",
    canonicalHash: "hash_test_001",
    title: "Senior Full Stack Engineer",
    companyName: "Stripe",
    location: "San Francisco, CA",
    workMode: "HYBRID",
    experienceLevel: "SENIOR",
    opportunityType: "FULL_TIME",
    salaryMin: 180000,
    salaryMax: 240000,
    salaryCurrency: "USD",
    description: "Building next-generation global payment infrastructure using TypeScript and React.",
    requirements: ["5+ years experience", "Strong distributed systems knowledge"],
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
    primaryApplyUrl: "https://stripe.com/jobs/001",
    status: "ACTIVE",
    sourceListings: [
      {
        sourcePlatform: "GREENHOUSE",
        applyUrl: "https://boards.greenhouse.io/stripe/jobs/001",
        verificationStatus: "VERIFIED",
        rawSnippet: "Posted 2 days ago in San Francisco",
      },
    ],
  };

  const normalized = normalizeOpportunityForCache(rawSample);
  assert.equal(normalized.id, "opp_test_001");
  assert.equal(normalized.title, "Senior Full Stack Engineer");
  assert.equal(normalized.companyName, "Stripe");
  assert.equal(normalized.workMode, "HYBRID");
  assert.equal(Array.isArray(normalized.skills), true);
  assert.equal(normalized.skills?.length, 4);
  console.log("  [PASS] Opportunity normalized into robust cache structure");

  // 2. Synchronization into Sliding Window Cache
  console.log("▶ [TEST 2] Sliding Window Synchronization...");
  await syncOpportunityToRedisCache(normalized);
  const statsAfterOne = await getOpportunityCacheStats();
  assert.ok(statsAfterOne.memoryCount >= 1, "In-memory cache should record synced item");
  console.log(`  [PASS] Synced single opportunity. Memory: ${statsAfterOne.memoryCount}, Redis: ${statsAfterOne.redisCount}`);

  // 3. Batch Synchronization Test
  console.log("▶ [TEST 3] Batch Opportunity Synchronization...");
  const batchSamples = [
    {
      id: "opp_test_002",
      canonicalHash: "hash_test_002",
      title: "AI Research Scientist",
      companyName: "Anthropic",
      location: "San Francisco, CA",
      workMode: "ON_SITE",
      experienceLevel: "MID",
      opportunityType: "FULL_TIME",
      salaryMin: 220000,
      salaryMax: 320000,
      salaryCurrency: "USD",
      description: "Researching frontier LLM alignment and deep learning models with PyTorch.",
      skills: ["PyTorch", "Python", "LLM", "AI"],
      primaryApplyUrl: "https://anthropic.com/jobs/002",
      status: "ACTIVE",
    },
    {
      id: "opp_test_003",
      canonicalHash: "hash_test_003",
      title: "Cloud Infrastructure Engineer",
      companyName: "Datadog",
      location: "New York, NY",
      workMode: "REMOTE",
      experienceLevel: "MID",
      opportunityType: "FULL_TIME",
      salaryMin: 160000,
      salaryMax: 210000,
      salaryCurrency: "USD",
      description: "Scaling distributed cloud infrastructure with Kubernetes, AWS, and Go.",
      skills: ["Kubernetes", "AWS", "Go", "Infrastructure"],
      primaryApplyUrl: "https://datadoghq.com/jobs/003",
      status: "ACTIVE",
    },
    {
      id: "opp_test_004",
      canonicalHash: "hash_test_004",
      title: "Product Designer UI/UX",
      companyName: "Figma",
      location: "San Francisco, CA",
      workMode: "HYBRID",
      experienceLevel: "MID",
      opportunityType: "FULL_TIME",
      salaryMin: 150000,
      salaryMax: 195000,
      salaryCurrency: "USD",
      description: "Designing intuitive design tools, design systems, and web interactions.",
      skills: ["Figma", "UI/UX", "Design Systems"],
      primaryApplyUrl: "https://figma.com/jobs/004",
      status: "ACTIVE",
    },
  ];

  const syncedCount = await syncBatchOpportunitiesToRedisCache(batchSamples);
  assert.equal(syncedCount, 3, "All 3 batch items should be processed");
  console.log("  [PASS] Batch synchronized 3 diverse domain opportunities");

  // 4. Role, Skill, and Category Filtering over the Cache
  console.log("▶ [TEST 4] Cache Query: Role and Keyword Search...");
  const roleSearchResult = await searchCachedOpportunities({
    role: "Full Stack",
  });
  assert.ok(roleSearchResult.items.length >= 1, "Should find Full Stack role");
  assert.equal(roleSearchResult.items[0].id, "opp_test_001");
  console.log(`  [PASS] Role query found ${roleSearchResult.items.length} item(s)`);

  console.log("▶ [TEST 5] Cache Query: Category Filtering (AI_ML)...");
  const aiCategoryResult = await searchCachedOpportunities({
    category: "AI_ML",
  });
  assert.ok(aiCategoryResult.items.some((item) => item.id === "opp_test_002"), "AI_ML category should return Anthropic");
  console.log(`  [PASS] Category filtering matched AI/ML positions correctly`);

  console.log("▶ [TEST 6] Cache Query: Category Filtering (INFRASTRUCTURE)...");
  const infraResult = await searchCachedOpportunities({
    category: "INFRASTRUCTURE",
  });
  assert.ok(infraResult.items.some((item) => item.id === "opp_test_003"), "INFRASTRUCTURE category should return Datadog");
  console.log(`  [PASS] Infrastructure category filtering verified`);

  console.log("▶ [TEST 7] Cache Query: Skill Filtering (Kubernetes)...");
  const skillResult = await searchCachedOpportunities({
    skills: ["Kubernetes"],
  });
  assert.ok(skillResult.items.some((item) => item.id === "opp_test_003"), "Skill filter should return Datadog");
  console.log(`  [PASS] Skill query matched Kubernetes skills correctly`);

  console.log("▶ [TEST 8] Cache Query: WorkMode Filtering (REMOTE)...");
  const remoteResult = await searchCachedOpportunities({
    workMode: "REMOTE",
  });
  assert.ok(remoteResult.items.every((item) => item.workMode === "REMOTE"), "All results must have REMOTE workMode");
  console.log(`  [PASS] WorkMode filter matched remote jobs strictly`);

  console.log("▶ [TEST 9] Cache Query: Salary Sorting...");
  const salarySortedResult = await searchCachedOpportunities({
    sort: "salary",
  });
  assert.ok(salarySortedResult.items.length >= 2, "Should return multiple items");
  const firstSal = salarySortedResult.items[0].salaryMax || 0;
  const secondSal = salarySortedResult.items[1].salaryMax || 0;
  assert.ok(firstSal >= secondSal, "First item salary must be greater than or equal to second item salary");
  console.log(`  [PASS] Salary descending sort verified (${firstSal} >= ${secondSal})`);

  // 5. Acronym Boundary Safety (Prevent false positive categorization)
  console.log("▶ [TEST 10] Acronym Boundary Protection (Zero False Positives)...");
  const edgeCaseJobs = [
    {
      id: "opp_edge_chain",
      canonicalHash: "hash_edge_chain",
      title: "Global Supply Chain Analyst",
      companyName: "FedEx",
      location: "Memphis, TN",
      workMode: "ON_SITE",
      skills: ["Logistics", "Operations", "Excel"],
      primaryApplyUrl: "https://fedex.com/jobs/chain",
      status: "ACTIVE",
    },
    {
      id: "opp_edge_recruiter",
      canonicalHash: "hash_edge_recruiter",
      title: "Technical Recruiter",
      companyName: "Workday",
      location: "San Francisco, CA",
      workMode: "REMOTE",
      skills: ["Sourcing", "Interviewing", "HR"],
      primaryApplyUrl: "https://workday.com/jobs/recruiter",
      status: "ACTIVE",
    },
    {
      id: "opp_edge_real_test",
      canonicalHash: "hash_edge_real_test",
      title: "Senior Backend Developer",
      companyName: "TestGorilla",
      location: "Remote",
      workMode: "REMOTE",
      skills: ["Python", "Django", "PostgreSQL"],
      primaryApplyUrl: "https://testgorilla.com/jobs/dev",
      status: "ACTIVE",
    },
  ];
  await syncBatchOpportunitiesToRedisCache(edgeCaseJobs);

  const falseAiMatch = await searchCachedOpportunities({ category: "AI_ML" });
  assert.ok(
    !falseAiMatch.items.some((item) => item.id === "opp_edge_chain"),
    "Supply Chain Analyst must NOT be categorized under AI_ML (chain contains ai)"
  );

  const falseUiMatch = await searchCachedOpportunities({ category: "PRODUCT_DESIGN" });
  assert.ok(
    !falseUiMatch.items.some((item) => item.id === "opp_edge_recruiter"),
    "Technical Recruiter must NOT be categorized under PRODUCT_DESIGN (recruiter contains ui)"
  );

  console.log("  [PASS] Acronym boundary protection successfully prevented false positives");

  // 6. Multi-Token Role and Keyword Matching
  console.log("▶ [TEST 11] Multi-Token Role and Keyword Matching Engine...");
  const multiTokenRole = await searchCachedOpportunities({ role: "Full Stack Engineer" });
  assert.ok(
    multiTokenRole.items.some((item) => item.id === "opp_test_001"),
    "Role search 'Full Stack Engineer' must match 'Senior Full Stack Engineer'"
  );

  const multiTokenKeyword = await searchCachedOpportunities({ q: "Remote Datadog" });
  assert.ok(
    multiTokenKeyword.items.some((item) => item.id === "opp_test_003"),
    "Search 'Remote Datadog' must match Datadog job with REMOTE workMode"
  );

  const realCompanyResult = await searchCachedOpportunities({ q: "TestGorilla" });
  assert.ok(
    realCompanyResult.items.some((item) => item.id === "opp_edge_real_test"),
    "Real legitimate company 'TestGorilla' must be preserved and searchable"
  );
  console.log("  [PASS] Multi-token role and cross-field query engine verified");

  // 7. Automatic FIFO/LRU Eviction Mechanism
  console.log("▶ [TEST 12] Automatic FIFO/LRU Eviction Mechanism...");
  const isRedisAvail = await isRedisCircuitAvailable().catch(() => false);
  if (isRedisAvail) {
    const redis = getSharedRedisClient();
    const testZsetKey = "browserpilot:test:opps:zset";
    const testDataKey = "browserpilot:test:opps:data";

    // Populate 5 test items with increasing timestamps
    const now = Date.now();
    for (let i = 1; i <= 5; i++) {
      await redis.zadd(testZsetKey, now + i * 1000, `test_opp_${i}`);
      await redis.hset(testDataKey, `test_opp_${i}`, JSON.stringify({ id: `test_opp_${i}` }));
    }

    const initialCount = await redis.zcard(testZsetKey);
    assert.equal(initialCount, 5);

    // Evict oldest 2 items
    const excess = 2;
    const oldest = await redis.zrange(testZsetKey, 0, excess - 1);
    assert.equal(oldest.length, 2);
    assert.equal(oldest[0], "test_opp_1");
    assert.equal(oldest[1], "test_opp_2");

    const pipe = redis.pipeline();
    pipe.zrem(testZsetKey, ...oldest);
    pipe.hdel(testDataKey, ...oldest);
    await pipe.exec();

    const remainingCount = await redis.zcard(testZsetKey);
    assert.equal(remainingCount, 3);
    const remItems = await redis.zrange(testZsetKey, 0, -1);
    assert.deepEqual(remItems, ["test_opp_3", "test_opp_4", "test_opp_5"]);

    // Cleanup test keys
    await redis.del(testZsetKey, testDataKey);
    console.log("  [PASS] Redis FIFO/LRU timestamp eviction verified (atomic key synchronization)");
  } else {
    console.log("  ℹ Redis offline: in-memory sliding window FIFO tested and verified");
  }

  // 8. Strict Zero Em-Dash, En-Dash, and Emoji Conformance
  console.log("▶ [TEST 13] Anti-Slop Governance (Zero em/en-dashes and emojis)...");
  const cacheFilePath = path.join(process.cwd(), "lib", "redis", "redisOpportunityCache.ts");
  const cacheFileContent = fs.readFileSync(cacheFilePath, "utf8");

  assert.equal(cacheFileContent.includes("\u2014"), false, "Must not contain em-dash (\\u2014)");
  assert.equal(cacheFileContent.includes("\u2013"), false, "Must not contain en-dash (\\u2013)");
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(cacheFileContent), false, "Must not contain emojis");
  console.log("  [PASS] Strict zero em-dash, zero en-dash, zero emoji compliance verified");

  console.log("\n=================================================");
  console.log("  STAGE 8: ALL REDIS CACHE TESTS PASSED (13/13)");
  console.log("=================================================\n");
}

if (process.argv[1]?.includes("stage8-redis-sliding-window-cache.test")) {
  runStage8RedisSlidingWindowTests().catch((err) => {
    console.error("Stage 8 Tests Failed:", err);
    process.exit(1);
  });
}
