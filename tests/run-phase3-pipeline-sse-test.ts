import { executeJobPipeline } from "@/lib/ai/pipelineEngine";
import { jobEventBus, type JobEventPayload } from "@/lib/events/jobEvents";
import { synthesizeFinalAnswerWithMetadata } from "@/lib/ai/synthesizer";
import type { DeepReachResult } from "@/lib/discovery/deepreach/deepReachService";

async function runPhase3PipelineSSETest() {
  console.log("=================================================");
  console.log("RUNNING PHASE 3 PIPELINE SSE & SYNTHESIZER TESTS");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Synthesizer Incorporates Verified Recruiter Contacts & Cross-Platform Signals
  try {
    console.log("Test 1: Synthesizer DeepReach Section Generation");
    const mockDeepReachResult: DeepReachResult = {
      companyName: "Acme Corp",
      normalizedName: "acme corp",
      sourcesScanned: ["LINKEDIN", "TWITTER", "REDDIT", "YOUTUBE"],
      recruiters: [
        {
          fullName: "Jane Doe",
          roleTitle: "Lead Technical Recruiter",
          companyName: "Acme Corp",
          profileUrl: "https://www.linkedin.com/in/janedoe",
          email: "jane.doe@acme.com",
          sourcePlatform: "LINKEDIN",
        },
      ],
      jobs: [
        {
          title: "Senior Frontend Engineer - Design Systems",
          companyName: "Acme Corp",
          applyUrl: "https://x.com/acmefounder/status/1234567890",
          sourcePlatform: "X",
          description: "Founder tweet looking for founding design systems engineer.",
        },
      ],
      verificationSummary: {
        scannedJobs: 2,
        verifiedJobs: 2,
        scannedRecruiters: 1,
        verifiedRecruiters: 1,
        rejectionReasons: [],
      },
    };

    const synthesized = await synthesizeFinalAnswerWithMetadata({
      goal: "Senior Frontend Engineer at Acme Corp",
      verificationStatus: "VERIFIED",
      observations: [],
      extractedData: JSON.stringify([
        {
          title: "Senior Frontend Engineer",
          company: "Acme Corp",
          url: "https://boards.greenhouse.io/acmecorp/jobs/101",
          source: "Greenhouse",
          score: 0.92,
        },
      ]),
      deepReachResult: mockDeepReachResult,
    });

    const md = synthesized.answer;
    const hasRecruiterSection = md.includes("### Verified Hiring Team & Talent Contacts");
    const hasRecruiterName = md.includes("Jane Doe") && md.includes("https://www.linkedin.com/in/janedoe");
    const hasSignalSection = md.includes("### Multi-Platform Hiring Signals & Discussion Threads");
    const hasXJob = md.includes("Senior Frontend Engineer - Design Systems") && md.includes("https://x.com/acmefounder/status/1234567890");

    if (hasRecruiterSection && hasRecruiterName && hasSignalSection && hasXJob) {
      console.log("  PASS: Synthesizer generated verified recruiter contacts and cross-platform discussion sections.");
      passed++;
    } else {
      console.error("  FAIL: Synthesizer output missing expected DeepReach sections:", {
        hasRecruiterSection,
        hasRecruiterName,
        hasSignalSection,
        hasXJob,
        md,
      });
      failed++;
    }
  } catch (err) {
    console.error("  ERROR in Test 1:", err);
    failed++;
  }

  // Test 2: Event Bus Granular SSE Emission During Pipeline Execution
  try {
    console.log("\nTest 2: Event Bus Granular SSE Emission During Pipeline Execution");

    const emittedEvents: Array<{ type: string; payload: any }> = [];
    const testJobId = `job-test-phase3-${Date.now()}`;

    // Pre-create job in DB
    const { createDbJob } = await import("@/lib/db/jobs");
    await createDbJob({
      id: testJobId,
      prompt: "Senior Frontend Engineer at Acme Corp",
    }).catch(() => {});

    // Subscribe to test job events
    const unsubscribe = jobEventBus.subscribe(testJobId, (eventPayload: JobEventPayload) => {
      emittedEvents.push({ type: eventPayload.event, payload: eventPayload.data });
    });

    // Mock fetcher for DeepReach channels
    const mockFetcher = async (url: string): Promise<string> => {
      if (url.includes("linkedin.com")) {
        return `
# Search Results
[Sarah Jenkins - Technical Recruiter - Acme Corp | LinkedIn](https://www.linkedin.com/in/sarahjenkins)
Technical Recruiter at Acme Corp. We are hiring Frontend and Fullstack Engineers!
        `;
      }
      if (url.includes("twitter.com") || url.includes("x.com")) {
        return `
Founder @ Acme Corp: We are hiring a Senior Frontend Engineer! Apply at https://acmecorp.com/jobs/fe or DM me.
        `;
      }
      return "Mock content for channel";
    };

    // Execute pipeline with DeepReach entitlement and company targeting
    const result = await executeJobPipeline({
      jobId: testJobId,
      userId: "test-user-phase3",
      prompt: "Senior Frontend Engineer at Acme Corp",
      companyName: "Acme Corp",
      hasDeepReachEntitlement: true,
      fetcher: mockFetcher,
    });

    unsubscribe();

    // Verify emitted SSE events
    const harvestDeepReachEvents = emittedEvents.filter(
      (e) =>
        e.type === "deepreach_step" ||
        (e.type === "step" && e.payload?.tool === "DeepReach") ||
        (typeof e.payload?.message === "string" && e.payload.message.includes("DeepReach"))
    );

    const midwayGateEvents = emittedEvents.filter(
      (e) =>
        (typeof e.payload?.message === "string" && e.payload.message.includes("Midway Gate")) ||
        (typeof e.payload?.label === "string" && e.payload.label.includes("Midway Gate"))
    );

    const hasHarvestSignalMsg = emittedEvents.some(
      (e) =>
        e.payload?.message?.includes("Harvesting hiring signals") ||
        e.payload?.message?.includes("Scouting company talent acquisition team")
    );

    const hasMidwayGateMsg = emittedEvents.some(
      (e) => e.payload?.message?.includes("Midway Gate")
    );

    const completeEvent = emittedEvents.find((e) => e.type === "complete");
    const hasDeepReachInComplete = !!completeEvent?.payload?.deepReach;

    console.log(`  Emitted events count: ${emittedEvents.length}`);
    console.log(`  Harvest DeepReach events: ${harvestDeepReachEvents.length}`);
    console.log(`  Midway gate events: ${midwayGateEvents.length}`);
    console.log(`  Has DeepReach in complete event: ${hasDeepReachInComplete}`);
    if (result.error) {
      console.log(`  Pipeline result error:`, result.error);
    }
    if (result.guard) {
      console.log(`  Pipeline guard result:`, result.guard);
    }

    if (hasHarvestSignalMsg && hasMidwayGateMsg && hasDeepReachInComplete) {
      console.log("  PASS: Event bus emitted granular DeepReach SSE steps (Harvest & Midway Gate) and complete payload.");
      passed++;
    } else {
      console.error("  FAIL: Event bus did not emit expected granular steps:", {
        hasHarvestSignalMsg,
        hasMidwayGateMsg,
        hasDeepReachInComplete,
        success: result.success,
        eventSample: emittedEvents.map((e) => ({ type: e.type, msg: e.payload?.message })),
      });
      failed++;
    }
  } catch (err) {
    console.error("  ERROR in Test 2:", err);
    failed++;
  }

  // Summary
  console.log("\n=================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase3PipelineSSETest().catch((err) => {
  console.error("Fatal error running Phase 3 tests:", err);
  process.exit(1);
});
