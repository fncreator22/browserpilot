import { extractHeuristicCareerIntent } from "@/lib/ai/multimodalParser";
import { 
  verifyJobCandidatesMidway, 
  verifyRecruiterContactsMidway, 
  checkUrlLiveness,
  type VerifiableJobCandidate,
  type VerifiableRecruiterContact
} from "@/lib/verification/midwayVerifier";

async function runDeepReachTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING DEEP-REACH & MIDWAY VERIFIER TESTS");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Multimodal / Text Career Intent Parser
  try {
    console.log("Test 1: Multimodal Heuristic Intent Parsing");
    const sampleText = `
      Stripe is hiring a Remote Staff Frontend Engineer!
      Must have strong experience with TypeScript, React, and Next.js.
      Recruiter: Sarah Jenkins
      Apply here: https://stripe.com/jobs/12345
    `;
    const parsed = extractHeuristicCareerIntent(sampleText);

    if (
      parsed.workMode === "REMOTE" &&
      parsed.skills.includes("TypeScript") &&
      parsed.skills.includes("Next.js") &&
      parsed.extractedUrls.length === 1 &&
      parsed.hiringTeamMentions.length > 0
    ) {
      console.log("  ✅ Test 1 Passed: Intent correctly parsed from career flyer text.");
      passed++;
    } else {
      console.error("  ❌ Test 1 Failed:", parsed);
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 1 Errored:", err);
    failed++;
  }

  // Test 2: Midway Verifier - Deduplication and Validation Gate
  try {
    console.log("\nTest 2: Midway Job Verification Gate (Deduplication & Malformed URL Filter)");
    const candidates: VerifiableJobCandidate[] = [
      {
        title: "Frontend Engineer",
        companyName: "Stripe",
        applyUrl: "https://stripe.com/jobs/1",
        sourcePlatform: "LINKEDIN",
      },
      {
        // Duplicate title + company
        title: "Frontend Engineer",
        companyName: "Stripe",
        applyUrl: "https://stripe.com/jobs/1-dup",
        sourcePlatform: "REDDIT",
      },
      {
        // Malformed URL
        title: "Backend Engineer",
        companyName: "Stripe",
        applyUrl: "invalid-url",
        sourcePlatform: "X",
      },
      {
        title: "Data Scientist",
        companyName: "Stripe",
        applyUrl: "https://stripe.com/jobs/2",
        sourcePlatform: "ATS",
      },
    ];

    // Run midway verification with liveness disabled for speed / offline test
    const report = await verifyJobCandidatesMidway(candidates, { checkLiveness: false });

    if (report.verified.length === 2 && report.rejectedCount === 2) {
      console.log("  ✅ Test 2 Passed: Deduplicated duplicate listing and rejected invalid URL.");
      passed++;
    } else {
      console.error("  ❌ Test 2 Failed:", report);
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 2 Errored:", err);
    failed++;
  }

  // Test 3: Recruiter Contacts Anti-Hallucination Gate
  try {
    console.log("\nTest 3: Recruiter Contacts Anti-Hallucination Gate");
    const contacts: VerifiableRecruiterContact[] = [
      {
        fullName: "Sarah Jenkins",
        roleTitle: "Lead Technical Recruiter",
        companyName: "Stripe",
        profileUrl: "https://linkedin.com/in/sarah-jenkins-talent",
        sourcePlatform: "LINKEDIN",
      },
      {
        // Hallucinated placeholder name
        fullName: "Recruiter Team",
        roleTitle: "Recruiter",
        companyName: "Stripe",
        profileUrl: "https://linkedin.com/in/recruiter-team",
        sourcePlatform: "LINKEDIN",
      },
      {
        // Single word or anonymous
        fullName: "Unknown",
        roleTitle: "HR",
        companyName: "Stripe",
        profileUrl: "https://x.com/unknown",
        sourcePlatform: "X",
      },
      {
        // Valid recruiter
        fullName: "Alex Rivera",
        roleTitle: "Head of Talent Acquisition",
        companyName: "Stripe",
        profileUrl: "https://linkedin.com/in/alexrivera-talent",
        sourcePlatform: "LINKEDIN",
      },
    ];

    const report = await verifyRecruiterContactsMidway(contacts, { checkLiveness: false });

    if (
      report.verified.length === 2 &&
      report.verified[0].fullName === "Sarah Jenkins" &&
      report.verified[1].fullName === "Alex Rivera" &&
      report.rejectedCount === 2
    ) {
      console.log("  ✅ Test 3 Passed: Successfully purged placeholder/hallucinated recruiter names.");
      passed++;
    } else {
      console.error("  ❌ Test 3 Failed:", report);
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 3 Errored:", err);
    failed++;
  }

  // Test 4: URL Liveness checker with dummy URL
  try {
    console.log("\nTest 4: URL Liveness Ping Gate");
    const deadResult = await checkUrlLiveness("not-a-url");
    if (!deadResult.live) {
      console.log("  ✅ Test 4 Passed: Handled malformed URL gracefully.");
      passed++;
    } else {
      console.error("  ❌ Test 4 Failed:", deadResult);
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 4 Errored:", err);
    failed++;
  }

  // Test 5: Dual Provider Multimodal Parser with OCR Text
  try {
    console.log("\nTest 5: Dual Provider Multimodal Parser with OCR text");
    const { parseMultimodalCareerInput } = await import("@/lib/ai/multimodalParser");
    const ocrResult = await parseMultimodalCareerInput({
      textContent: "check the image and find me the JD",
      ocrText: "We are hiring at Stripe! Senior Backend Engineer (Go, distributed systems). Apply at https://stripe.com/jobs/backend",
    });

    if (
      ocrResult.extractedUrls.length === 1 &&
      ocrResult.skills.includes("Go")
    ) {
      console.log("  ✅ Test 5 Passed: Dual provider multimodal parser successfully parsed OCR text without locking on Gemini.");
      passed++;
    } else {
      console.error("  ❌ Test 5 Failed:", ocrResult);
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 5 Errored:", err);
    failed++;
  }

  // Test 6: Heuristic Company and Role Extraction from Hiring Post (e.g. HCLTech)
  try {
    console.log("\nTest 6: Heuristic Company and Role Extraction from Hiring Post (HCLTech)");
    const hclSample = `
      HCLTech IS HIRING!
      Software Engineer - Graduate Engineer Trainee
      Package: 24.7 LPA CTC
      Skills: Java, Python, SQL, Cloud
      Apply now: https://hcltech.com/careers/job123
    `;
    const parsedHcl = extractHeuristicCareerIntent(hclSample);

    if (
      parsedHcl.companyName === "HCLTech" &&
      parsedHcl.jobTitle?.toLowerCase().includes("software engineer")
    ) {
      console.log(`  ✅ Test 6 Passed: Extracted company (${parsedHcl.companyName}) and role (${parsedHcl.jobTitle}) accurately.`);
      passed++;
    } else {
      console.error("  ❌ Test 6 Failed: Company or role not extracted properly:", parsedHcl);
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 6 Errored:", err);
    failed++;
  }

  // Test 7: Reflexive Conversational Stop-Word Rejection ("details" rejection)
  try {
    console.log("\nTest 7: Reflexive Conversational Stop-Word Rejection ('details' rejection)");
    const conversationalPrompt = "find me the details of this post";
    const parsedGeneric = extractHeuristicCareerIntent(conversationalPrompt);

    if (parsedGeneric.companyName !== "details" && parsedGeneric.companyName === undefined) {
      console.log("  ✅ Test 7 Passed: 'details' strictly rejected from company extraction.");
      passed++;
    } else {
      console.error("  ❌ Test 7 Failed: Hallucinated stop-word as company name:", parsedGeneric.companyName);
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 7 Errored:", err);
    failed++;
  }

  // Test 8: LinkedIn Channel Direct Guest Discovery & CAPTCHA Wall Decoupling
  try {
    console.log("\nTest 8: LinkedIn Channel Direct Guest Discovery & CAPTCHA Decoupling");
    const { scanLinkedInChannel } = await import("@/lib/discovery/deepreach/channels/linkedInChannel");
    const channelResult = await scanLinkedInChannel({
      companyName: "HCLTech",
      roleTitle: "Software Engineer",
      maxResults: 5,
      timeoutMs: 8000,
    });

    // Verify no CAPTCHA challenge in sourceUrls or error
    const hasCaptchaError = channelResult.error?.includes("duck") || channelResult.error?.includes("CAPTCHA");
    if (!hasCaptchaError && Array.isArray(channelResult.jobs) && Array.isArray(channelResult.recruiters)) {
      console.log(`  ✅ Test 8 Passed: Successfully executed LinkedIn channel without DuckDuckGo CAPTCHA blocking. Discovered ${channelResult.jobs.length} jobs.`);
      passed++;
    } else {
      console.error("  ❌ Test 8 Failed:", channelResult);
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 8 Errored:", err);
    failed++;
  }

  console.log("\n=================================================");
  console.log(`📊 RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runDeepReachTests().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});
