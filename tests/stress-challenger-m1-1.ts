/**
 * Adversarial Stress & Fuzz Test Suite for Milestone 1
 * Targets:
 * 1. parseAllowedDomains (Fuzzing, injection, circular objects, malformed JSON, unicode, memory & timing)
 * 2. @libsql/client + @prisma/adapter-libsql (Concurrent instantiation, schema bootstrap, lifecycle teardown, live queries)
 */

import { parseAllowedDomains, CreateJobRequestSchema } from "@/schemas/jobs";
import { createPrismaClient, ensureDatabaseSchema, getTursoConfig } from "@/lib/db/prisma";
import { PrismaClient } from "@prisma/client";

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function recordPass(category: string, name: string, durationMs: number, details?: string) {
  results.push({ category, name, passed: true, durationMs, details });
  console.log(`  ✅ [PASS] ${name} (${durationMs.toFixed(1)}ms)${details ? ` - ${details}` : ""}`);
}

function recordFail(category: string, name: string, durationMs: number, error: unknown) {
  const errMsg = error instanceof Error ? error.message : String(error);
  results.push({ category, name, passed: false, durationMs, details: errMsg });
  console.error(`  ❌ [FAIL] ${name} (${durationMs.toFixed(1)}ms): ${errMsg}`);
}

async function runSection(category: string, name: string, fn: () => void | Promise<void>) {
  const start = performance.now();
  try {
    await fn();
    const duration = performance.now() - start;
    recordPass(category, name, duration);
  } catch (err) {
    const duration = performance.now() - start;
    recordFail(category, name, duration, err);
  }
}

// ============================================================================
// PART 1: parseAllowedDomains Stress & Fuzz Testing
// ============================================================================

async function testParseAllowedDomains() {
  console.log("\n=================================================");
  console.log("  PART 1: parseAllowedDomains ADVERSARIAL STRESS ");
  console.log("=================================================");

  // 1. Primitive & Non-String Fuzzing
  await runSection("parseAllowedDomains", "Primitives & Nullish Fuzzing", () => {
    const falsyInputs = [null, undefined, false, 0, -0, NaN, ""];
    for (const input of falsyInputs) {
      const res = parseAllowedDomains(input);
      assert(Array.isArray(res) && res.length === 0, `Expected [] for ${String(input)}, got ${JSON.stringify(res)}`);
    }

    const truthyNonStrings = [
      true,
      123,
      -456.78,
      Infinity,
      -Infinity,
      BigInt(9007199254740991),
      Symbol("domain"),
      () => "example.com",
      async () => "example.com",
      class Domain {},
      new Date(),
      /example\.com/,
      new Set(["a.com"]),
      new Map([["a", "b"]]),
      Buffer.from("example.com"),
      new Uint8Array([101, 120, 97, 109, 112, 108, 101]),
    ];

    for (const input of truthyNonStrings) {
      const res = parseAllowedDomains(input);
      assert(Array.isArray(res) && res.length === 0, `Expected [] for non-string truthy ${typeof input}, got ${JSON.stringify(res)}`);
    }
  });

  // 2. Hostile Objects & Circular References
  await runSection("parseAllowedDomains", "Circular & Throwing Objects", () => {
    // Circular object
    const circularObj: any = { domain: "example.com" };
    circularObj.self = circularObj;
    const res1 = parseAllowedDomains(circularObj);
    assert(Array.isArray(res1) && res1.length === 0, "Circular object must safely return []");

    // Object with throwing property / getters
    const evilObj = {
      get length() {
        throw new Error("Trap: length accessed");
      },
      toString() {
        throw new Error("Trap: toString called");
      },
      valueOf() {
        throw new Error("Trap: valueOf called");
      },
      [Symbol.toPrimitive]() {
        throw new Error("Trap: toPrimitive called");
      },
    };
    const res2 = parseAllowedDomains(evilObj);
    assert(Array.isArray(res2) && res2.length === 0, "Hostile getter object must safely return []");

    // Object disguised as array
    const fakeArray = { 0: "example.com", 1: "github.com", length: 2 };
    const res3 = parseAllowedDomains(fakeArray);
    assert(Array.isArray(res3) && res3.length === 0, "Array-like object must safely return []");
  });

  // 3. Array Edge Cases & Circular Arrays
  await runSection("parseAllowedDomains", "Array Edge Cases & Sparse / Circular Arrays", () => {
    // Empty array
    assert(parseAllowedDomains([]).length === 0, "[] -> []");

    // Array with hostile / mixed non-strings
    const mixedArray = [
      null,
      undefined,
      123,
      true,
      false,
      {},
      { domain: "evil.com" },
      Symbol("sym"),
      () => {},
      "  EXAMPLE.COM  ",
      "",
      "   ",
      "\t\n",
      "example.com",
      "GITHUB.COM",
      "github.com",
    ];
    const resMixed = parseAllowedDomains(mixedArray);
    assert(
      JSON.stringify(resMixed) === JSON.stringify(["example.com", "github.com"]),
      `Expected ['example.com', 'github.com'], got ${JSON.stringify(resMixed)}`
    );

    // Circular array
    const circularArr: any[] = ["domain1.com", "DOMAIN2.COM"];
    circularArr.push(circularArr);
    circularArr.push("domain1.com");
    const resCirc = parseAllowedDomains(circularArr);
    assert(
      JSON.stringify(resCirc) === JSON.stringify(["domain1.com", "domain2.com"]),
      `Expected ['domain1.com', 'domain2.com'], got ${JSON.stringify(resCirc)}`
    );

    // Sparse array
    const sparse = new Array(500);
    sparse[10] = "sparse.org";
    sparse[400] = "SPARSE.ORG";
    sparse[200] = "  ANOTHER.NET  ";
    const resSparse = parseAllowedDomains(sparse);
    assert(
      resSparse.length === 2 && resSparse.includes("sparse.org") && resSparse.includes("another.net"),
      `Sparse array failed: ${JSON.stringify(resSparse)}`
    );

    // Deeply nested array
    const nested = [["nested1.com"], [["nested2.com"]], "root.com"];
    const resNested = parseAllowedDomains(nested);
    assert(
      JSON.stringify(resNested) === JSON.stringify(["root.com"]),
      `Nested array should filter out sub-arrays, got ${JSON.stringify(resNested)}`
    );
  });

  // 4. JSON String Attack Payloads
  await runSection("parseAllowedDomains", "JSON String Attacks & Malformed Payloads", () => {
    // Valid JSON string
    const validJson = '["news.ycombinator.com", "GITHUB.COM", "  vercel.com  ", ""]';
    const resValid = parseAllowedDomains(validJson);
    assert(
      JSON.stringify(resValid) === JSON.stringify(["news.ycombinator.com", "github.com", "vercel.com"]),
      `Valid JSON parse failed: ${JSON.stringify(resValid)}`
    );

    // JSON array with mixed types
    const mixedJson = '[123, true, null, false, {"domain":"x.com"}, ["sub"], "  OK.COM  ", "ok.com"]';
    const resMixedJson = parseAllowedDomains(mixedJson);
    assert(
      JSON.stringify(resMixedJson) === JSON.stringify(["ok.com"]),
      `Mixed JSON parse failed: ${JSON.stringify(resMixedJson)}`
    );

    // Empty JSON structures
    assert(parseAllowedDomains("[]").length === 0, "[] string -> []");
    assert(parseAllowedDomains("[   ]").length === 0, "[   ] string -> []");
    assert(parseAllowedDomains("[\n\t\r]").length === 0, "whitespace bracket -> []");
    assert(parseAllowedDomains("[null, false, 123]").length === 0, "valid JSON [null, false, 123] -> []");

    // Malformed JSON brackets - should gracefully fallback without throwing
    const malformedCases = [
      "[",
      "]",
      "[unquoted-domain.com]",
      '["unterminated string',
      '{"key": "value"}',
      '[{"nested": 1}, {"nested": 2}]',
      "[1, 2, 3]",
      "[{}]",
      "[[[]]]",
      "[null, undefined, false]",
    ];

    for (const malformed of malformedCases) {
      const res = parseAllowedDomains(malformed);
      assert(Array.isArray(res), `Malformed case ${malformed} did not return an array`);
    }

    // Unicode in JSON
    const unicodeJson = '["\\u0061\\u0070\\u0069.github.com", "m\\u00fcnchen.de"]';
    const resUnicode = parseAllowedDomains(unicodeJson);
    assert(
      resUnicode.includes("api.github.com") && resUnicode.includes("münchen.de"),
      `Unicode JSON failed: ${JSON.stringify(resUnicode)}`
    );

    // Prototype pollution payload in JSON
    const protoPayload = '["__proto__", "constructor", "prototype", "normal.com"]';
    const resProto = parseAllowedDomains(protoPayload);
    assert(
      resProto.includes("__proto__") && resProto.includes("normal.com"),
      `Prototype string handling failed: ${JSON.stringify(resProto)}`
    );
    assert(({} as any).polluted === undefined, "Object prototype was polluted!");
  });

  // 5. Comma-Separated & Whitespace Attacks
  await runSection("parseAllowedDomains", "Comma-Separated, Whitespace & Special Payloads", () => {
    // Excessive and consecutive commas
    const commaSpam = ",,,,news.ycombinator.com,,,  ,  ,GITHUB.COM,,,,,,,";
    const resComma = parseAllowedDomains(commaSpam);
    assert(
      JSON.stringify(resComma) === JSON.stringify(["news.ycombinator.com", "github.com"]),
      `Comma spam failed: ${JSON.stringify(resComma)}`
    );

    // Whitespace only
    assert(parseAllowedDomains("    \t\r\n    ").length === 0, "Whitespace string -> []");
    assert(parseAllowedDomains(",  ,  , \t , \n ,").length === 0, "Commas and whitespace -> []");

    // Line breaks and tab delimiters
    const multiline = "domain-one.com,\n\tDOMAIN-TWO.COM,\r\n  domain-three.org  ";
    const resMulti = parseAllowedDomains(multiline);
    assert(
      JSON.stringify(resMulti) === JSON.stringify(["domain-one.com", "domain-two.com", "domain-three.org"]),
      `Multiline comma split failed: ${JSON.stringify(resMulti)}`
    );

    // URLs with schemes and paths passed instead of bare domains
    const urlPayload = "https://news.ycombinator.com/item?id=123, HTTP://GITHUB.COM/fncreator22";
    const resUrl = parseAllowedDomains(urlPayload);
    assert(
      resUrl.length === 2 &&
      resUrl[0] === "https://news.ycombinator.com/item?id=123" &&
      resUrl[1] === "http://github.com/fncreator22",
      `URL payload failed: ${JSON.stringify(resUrl)}`
    );

    // IPv4 and IPv6 addresses
    const ipPayload = "127.0.0.1, 192.168.1.1:8080, [::1], 2001:0db8:85a3:0000:0000:8a2e:0370:7334";
    const resIp = parseAllowedDomains(ipPayload);
    assert(
      resIp.length === 4 && resIp.includes("127.0.0.1") && resIp.includes("[::1]"),
      `IP addresses parsing failed: ${JSON.stringify(resIp)}`
    );

    // Internationalized Domain Names (IDN) & Emojis
    const idnPayload = "münchen.de, 例子.中国, 🚀.com, café.fr";
    const resIdn = parseAllowedDomains(idnPayload);
    assert(
      resIdn.length === 4 && resIdn.includes("münchen.de") && resIdn.includes("🚀.com"),
      `IDN parsing failed: ${JSON.stringify(resIdn)}`
    );

    // Security attack strings (SQL injection, XSS, Path Traversal)
    const attackStrings = [
      "example.com'; DROP TABLE users; --",
      "<script>alert('xss')</script>",
      "../../../../etc/passwd",
      "..\\..\\windows\\system32",
      "'; EXEC xp_cmdshell('dir');--",
    ];
    for (const attack of attackStrings) {
      const res = parseAllowedDomains(attack);
      assert(Array.isArray(res) && res.length === 1, `Attack string ${attack} should parse safely into array`);
    }
  });

  // 6. High-Volume / Scale & Timing Stress (Fuzzing 50,000 items)
  await runSection("parseAllowedDomains", "Scale & Timing Stress (50,000 items)", () => {
    const largeArray: string[] = [];
    for (let i = 0; i < 50000; i++) {
      const domainNum = i % 500; // 500 unique domains repeated 100 times
      if (i % 5 === 0) {
        largeArray.push(`   DOMAIN-${domainNum}.COM   `);
      } else if (i % 7 === 0) {
        largeArray.push("");
      } else if (i % 11 === 0) {
        largeArray.push("   ");
      } else {
        largeArray.push(`domain-${domainNum}.com`);
      }
    }

    const t0 = performance.now();
    const result = parseAllowedDomains(largeArray);
    const elapsed = performance.now() - t0;

    assert(result.length === 500, `Expected exactly 500 deduplicated domains, got ${result.length}`);
    assert(elapsed < 200, `Processing 50,000 items took ${elapsed}ms (expected < 200ms)`);
  });

  // 7. Pseudo-Random Generative Fuzzing (1,000 iterations)
  await runSection("parseAllowedDomains", "Generative Random Fuzzing (1,000 iterations)", () => {
    const characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.,[]{}()\"'\\/:\t\n\r\0!@#$%^&*+=~`<>?";
    
    for (let i = 0; i < 1000; i++) {
      // Generate random string
      const len = Math.floor(Math.random() * 50);
      let randStr = "";
      for (let j = 0; j < len; j++) {
        randStr += characters.charAt(Math.floor(Math.random() * characters.length));
      }

      // Should never throw unhandled exception
      const res1 = parseAllowedDomains(randStr);
      assert(Array.isArray(res1), `Random fuzz string failed: ${randStr}`);

      // Generate random array
      const arrLen = Math.floor(Math.random() * 20);
      const randArr: any[] = [];
      for (let k = 0; k < arrLen; k++) {
        const type = Math.floor(Math.random() * 6);
        if (type === 0) randArr.push(randStr.substring(0, 10));
        else if (type === 1) randArr.push(null);
        else if (type === 2) randArr.push(Math.random() * 1000);
        else if (type === 3) randArr.push({});
        else if (type === 4) randArr.push(type === 4);
        else randArr.push(["sub", "arr"]);
      }

      const res2 = parseAllowedDomains(randArr);
      assert(Array.isArray(res2), `Random fuzz array failed`);
    }
  });

  // 8. Zod Schema Integration with CreateJobRequestSchema
  await runSection("parseAllowedDomains", "CreateJobRequestSchema Zod Integration", () => {
    // Valid comma separated
    const p1 = CreateJobRequestSchema.safeParse({
      prompt: "Extract data",
      allowedDomains: "news.ycombinator.com, GITHUB.COM",
    });
    assert(p1.success, "Schema validation should succeed for comma separated string");
    if (p1.success) {
      assert(
        JSON.stringify(p1.data.allowedDomains) === JSON.stringify(["news.ycombinator.com", "github.com"]),
        `Zod output mismatch: ${JSON.stringify(p1.data.allowedDomains)}`
      );
    }

    // Valid JSON string
    const p2 = CreateJobRequestSchema.safeParse({
      prompt: "Extract data",
      allowedDomains: '["news.ycombinator.com", "vercel.com"]',
    });
    assert(p2.success, "Schema validation should succeed for JSON string");
    if (p2.success) {
      assert(
        JSON.stringify(p2.data.allowedDomains) === JSON.stringify(["news.ycombinator.com", "vercel.com"]),
        `Zod output mismatch: ${JSON.stringify(p2.data.allowedDomains)}`
      );
    }

    // Fuzz inputs in schema
    const hostileInputs = [null, undefined, 123, {}, [null, 123, "site.com"]];
    for (const h of hostileInputs) {
      const p = CreateJobRequestSchema.safeParse({
        prompt: "Extract data",
        allowedDomains: h,
      });
      assert(p.success, `Schema validation should handle hostile input ${JSON.stringify(h)} gracefully`);
      if (p.success) {
        assert(Array.isArray(p.data.allowedDomains), "Resulting allowedDomains must be an array");
      }
    }
  });
}

// ============================================================================
// PART 2: @libsql/client & Prisma libSQL Adapter Stress Testing
// ============================================================================

async function testDatabaseAdapterStress() {
  console.log("\n=================================================");
  console.log("  PART 2: DATABASE ADAPTER CONCURRENCY & STRESS  ");
  console.log("=================================================");

  const turso = getTursoConfig();
  console.log(`[DB Test] Target Environment: ${turso ? `Turso Cloud (${turso.url})` : "Local libSQL SQLite"}`);

  // 1. Concurrent Schema Bootstrap (Idempotence & Race Condition Check)
  await runSection("Prisma/libSQL", "Concurrent Schema DDL Bootstrap (20 Parallel Calls)", async () => {
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 20; i++) {
      promises.push(ensureDatabaseSchema());
    }
    await Promise.all(promises);
  });

  // 2. Rapid Parallel Client Instantiation & Basic Connection Check
  await runSection("Prisma/libSQL", "Concurrent 30 Prisma Client Instantiations & Queries", async () => {
    const clientCount = 30;
    const clients: PrismaClient[] = [];

    try {
      for (let i = 0; i < clientCount; i++) {
        clients.push(createPrismaClient());
      }

      // Execute parallel lightweight queries across all 30 clients simultaneously
      const queryPromises = clients.map(async (client, idx) => {
        const count = await client.user.count();
        assert(typeof count === "number", `Client ${idx} failed to return user count`);
        return count;
      });

      const counts = await Promise.all(queryPromises);
      assert(counts.length === clientCount, `Expected ${clientCount} results, got ${counts.length}`);
      assert(counts.every((c) => c === counts[0]), "All concurrent client counts should match");
    } finally {
      // Disconnect all clients in parallel
      await Promise.all(clients.map((c) => c.$disconnect()));
    }
  });

  // 3. Concurrent Write / Read / Update / Delete Burst Stress
  await runSection("Prisma/libSQL", "Concurrent CRUD Transaction Burst (10 Parallel Workers)", async () => {
    const workerCount = 10;
    const testBatchId = `stress-${Date.now()}`;
    const client = createPrismaClient();

    try {
      // 10 concurrent workers creating jobs with complex/hostile payloads
      const workerPromises = Array.from({ length: workerCount }).map(async (_, idx) => {
        const jobId = `${testBatchId}-worker-${idx}`;
        const hostileDomainList = JSON.stringify([
          `worker-${idx}.example.com`,
          `sub.${idx}.test.org`,
          "unicode-üñíçødé.com",
          "https://complex.domain.com/path",
        ]);

        // Insert
        const created = await client.job.create({
          data: {
            id: jobId,
            prompt: `Stress test job worker #${idx} prompt with special characters: <>&"'\n\t`,
            status: "QUEUED",
            progress: 0,
            allowedDomains: hostileDomainList,
            maxStepsBudget: 15,
            goal: `Goal for worker ${idx}`,
          },
        });
        assert(created.id === jobId, `Created ID mismatch: expected ${jobId}, got ${created.id}`);

        // Insert child step
        const step = await client.jobStep.create({
          data: {
            id: `step-${jobId}-1`,
            jobId: jobId,
            stepNumber: 1,
            tool: "browser.navigate",
            actionPayload: JSON.stringify({ url: `https://worker-${idx}.example.com` }),
            rationale: `Navigate step for worker ${idx}`,
            status: "COMPLETED",
          },
        });
        assert(step.jobId === jobId, "JobStep jobId mismatch");

        // Insert observation (model is observationRecord)
        const obs = await client.observationRecord.create({
          data: {
            id: `obs-${jobId}-1`,
            jobId: jobId,
            stepIndex: 1,
            tool: "browser.navigate",
            status: "SUCCESS",
            currentUrl: `https://worker-${idx}.example.com`,
            title: `Worker ${idx} Title`,
            pageSummary: `Summary for worker ${idx}`,
            elapsedMs: 150 + idx * 10,
          },
        });
        assert(obs.jobId === jobId, "ObservationRecord jobId mismatch");

        // Insert artifact (model is artifactRecord)
        const art = await client.artifactRecord.create({
          data: {
            id: `art-${jobId}-1`,
            jobId: jobId,
            filename: `worker_${idx}_screenshot.png`,
            storageKey: `storage/artifacts/${jobId}/worker_${idx}_screenshot.png`,
            mimeType: "image/png",
            sizeBytes: 45000 + idx * 500,
          },
        });
        assert(art.jobId === jobId, "ArtifactRecord jobId mismatch");

        // Update Job
        const updated = await client.job.update({
          where: { id: jobId },
          data: {
            status: "COMPLETED",
            progress: 100,
            summary: `Successfully completed stress job for worker ${idx}`,
            result: JSON.stringify({ extracted: true, workerIndex: idx }),
            totalDurationMs: 1200 + idx * 50,
          },
        });
        assert(updated.status === "COMPLETED", `Update failed for ${jobId}`);

        // Read back full graph with relations
        const readBack = await client.job.findUnique({
          where: { id: jobId },
          include: {
            steps: true,
            observations: true,
            artifacts: true,
          },
        });

        assert(readBack !== null, `Job ${jobId} not found on read-back`);
        assert(readBack!.steps.length === 1, `Expected 1 step, got ${readBack!.steps.length}`);
        assert(readBack!.observations.length === 1, `Expected 1 observation, got ${readBack!.observations.length}`);
        assert(readBack!.artifacts.length === 1, `Expected 1 artifact, got ${readBack!.artifacts.length}`);

        // Verify parseAllowedDomains on stored allowedDomains
        const parsedStoredDomains = parseAllowedDomains(readBack!.allowedDomains);
        assert(
          parsedStoredDomains.includes(`worker-${idx}.example.com`) &&
          parsedStoredDomains.includes("unicode-üñíçødé.com"),
          `Stored domains parsing failed for worker ${idx}`
        );

        // Delete Job (cascades to steps, observations, artifacts)
        await client.job.delete({
          where: { id: jobId },
        });

        // Verify deletion cascade
        const afterDelete = await client.job.findUnique({ where: { id: jobId } });
        assert(afterDelete === null, `Job ${jobId} should be deleted`);

        const remainingSteps = await client.jobStep.findMany({ where: { jobId } });
        assert(remainingSteps.length === 0, `Cascade failed: steps remain for ${jobId}`);
      });

      await Promise.all(workerPromises);
    } finally {
      await client.$disconnect();
    }
  });

  // 4. Connection Teardown & Reconnect Lifecycle
  await runSection("Prisma/libSQL", "Connection Lifecycle & Clean Teardown", async () => {
    const client = createPrismaClient();

    // 1. Initial query
    const count1 = await client.user.count();
    assert(typeof count1 === "number", "Initial query succeeded");

    // 2. Explicit disconnect
    await client.$disconnect();

    // 3. Reconnect & query
    await client.$connect();
    const count2 = await client.user.count();
    assert(count2 === count1, "Reconnected query succeeded with matching count");

    // 4. Final disconnect
    await client.$disconnect();
  });

  // 5. High-Load Batch Read & Relation Traversal
  await runSection("Prisma/libSQL", "High-Volume Batch Read & Relation Traversal", async () => {
    const client = createPrismaClient();
    try {
      const jobs = await client.job.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          steps: { take: 5 },
          observations: { take: 5 },
          artifacts: { take: 5 },
        },
      });
      assert(Array.isArray(jobs), "Batch query must return an array");
    } finally {
      await client.$disconnect();
    }
  });
}

// ============================================================================
// MAIN RUNNER & REPORT GENERATOR
// ============================================================================

async function main() {
  console.log("================================================================================");
  console.log("   CHALLENGER M1_1: EMPIRICAL ADVERSARIAL & DATABASE STRESS TEST SUITE           ");
  console.log("================================================================================");

  const startTime = Date.now();

  await testParseAllowedDomains();
  await testDatabaseAdapterStress();

  const totalDuration = Date.now() - startTime;
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.filter((r) => !r.passed).length;
  const allPassed = failedTests === 0;

  console.log("\n================================================================================");
  console.log("   FINAL STRESS TEST EXECUTION SUMMARY MATRIX                                   ");
  console.log("================================================================================");
  
  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    const status = r.passed ? "PASS" : "FAIL";
    console.log(`${icon} [${status.padEnd(4)}] [${r.category.padEnd(19)}] ${r.name.padEnd(52)} (${r.durationMs.toFixed(1)}ms)`);
    if (r.details && !r.passed) {
      console.log(`       ↳ Error: ${r.details}`);
    }
  }

  console.log("================================================================================");
  console.log(`Total Suites: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests} | Elapsed: ${totalDuration}ms`);
  console.log(`Verdict: ${allPassed ? "VERIFIED ROBUST & SECURE ✅" : "VULNERABILITIES DETECTED ❌"}`);
  console.log("================================================================================\n");

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL TEST HARNESS CRASH:", err);
  process.exit(1);
});
