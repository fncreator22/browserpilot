import { 
  linkedInChannel, 
  parseLinkedInRecruitersFromText, 
  parseLinkedInJobsFromText 
} from "@/lib/discovery/deepreach/channels/linkedInChannel";

import { 
  twitterChannel, 
  parseTwitterHiringPostsFromText 
} from "@/lib/discovery/deepreach/channels/twitterChannel";

import { 
  redditChannel, 
  parseRedditListingJson 
} from "@/lib/discovery/deepreach/channels/redditChannel";

import { 
  youtubeChannel, 
  parseYouTubeVideosFromText 
} from "@/lib/discovery/deepreach/channels/youtubeChannel";

import { 
  ALL_DEEPREACH_CHANNELS, 
  DEEPREACH_CHANNEL_MAP 
} from "@/lib/discovery/deepreach/channels";

import { executeDeepReachScan } from "@/lib/discovery/deepreach/deepReachService";

async function runPhase2ChannelsTestSuite() {
  console.log("=================================================");
  console.log("🧪 RUNNING DEEPREACH PHASE 2 CHANNELS TEST SUITE");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  // -------------------------------------------------------------
  // Test 1: Registry Integrity
  // -------------------------------------------------------------
  try {
    console.log("Test 1: Channels Registry & Adapter Definitions");
    if (
      ALL_DEEPREACH_CHANNELS.length === 4 &&
      DEEPREACH_CHANNEL_MAP["deepreach-linkedin"] &&
      DEEPREACH_CHANNEL_MAP["deepreach-twitter"] &&
      DEEPREACH_CHANNEL_MAP["deepreach-reddit"] &&
      DEEPREACH_CHANNEL_MAP["deepreach-youtube"]
    ) {
      console.log("  ✅ Test 1 Passed: All 4 zero-fee channel adapters registered.");
      passed++;
    } else {
      console.error("  ❌ Test 1 Failed: Registry missing adapters.", ALL_DEEPREACH_CHANNELS.length);
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 1 Errored:", err);
    failed++;
  }

  // -------------------------------------------------------------
  // Test 2: LinkedIn Channel Adapter
  // -------------------------------------------------------------
  try {
    console.log("\nTest 2: LinkedIn Channel Parsing & Extraction");
    const mockLinkedInText = `
### Search Results for Acme Corp Talent
* [Alice Cooper - Head of Talent Acquisition | LinkedIn](https://www.linkedin.com/in/alice-cooper-talent)
  Technical recruiting lead at Acme Corp focusing on distributed systems and AI.
* [Bob Martin - Senior Technical Recruiter - LinkedIn](https://www.linkedin.com/in/bobmartin-recruiter/)
  Talent partner at Acme Corp.
* [Staff Full Stack Engineer - Remote](https://www.linkedin.com/jobs/view/3948572019)
  Acme Corp is hiring a Staff Full Stack Engineer. Remote US/Canada.
* [Senior Backend Engineer](https://www.linkedin.com/jobs/view/3948572020)
  Acme Corp looking for Go/Rust engineers.
    `;

    const recruiters = parseLinkedInRecruitersFromText(mockLinkedInText, "Acme Corp", "acmepay.com");
    const jobs = parseLinkedInJobsFromText(mockLinkedInText, "Acme Corp", "Software Engineer");

    const channelResult = await linkedInChannel.scan({
      companyName: "Acme Corp",
      companyDomain: "acmepay.com",
      fetcher: async () => mockLinkedInText,
    });

    if (
      recruiters.length >= 2 &&
      recruiters[0].fullName === "Alice Cooper" &&
      recruiters[0].email === "alice.cooper@acmepay.com" &&
      jobs.length >= 2 &&
      jobs[0].applyUrl.includes("3948572019") &&
      channelResult.jobs.length >= 2 &&
      channelResult.recruiters.length >= 2
    ) {
      console.log("  ✅ Test 2 Passed: LinkedIn recruiters and jobs accurately parsed.");
      passed++;
    } else {
      console.error("  ❌ Test 2 Failed:", { recruiters, jobs, channelResult });
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 2 Errored:", err);
    failed++;
  }

  // -------------------------------------------------------------
  // Test 3: Twitter/X Hiring Radar
  // -------------------------------------------------------------
  try {
    console.log("\nTest 3: Twitter/X Hiring Radar Parsing & Tech Stack Tagging");
    const mockTwitterText = `
Post by @sarah_cto:
We are hiring a Senior Distributed Systems Engineer at Acme Corp!
Stack: TypeScript, Go, Kubernetes, and LLMs. Apply direct: https://acme.careers/jobs/dist-sys
https://x.com/sarah_cto/status/1789012345678901234

Post by @dave_lead:
Acme Corp is hiring an Infrastructure Engineer.
Check out https://jobs.lever.co/acme/infra
https://twitter.com/dave_lead/status/1789012345678909999
    `;

    const parsed = parseTwitterHiringPostsFromText(mockTwitterText, "Acme Corp", "Engineer");

    const channelResult = await twitterChannel.scan({
      companyName: "Acme Corp",
      fetcher: async () => mockTwitterText,
    });

    if (
      parsed.jobs.length >= 2 &&
      parsed.recruiters.length >= 2 &&
      parsed.recruiters.some((r) => r.fullName === "@sarah_cto") &&
      parsed.jobs.some((j) => j.description?.includes("TypeScript")) &&
      channelResult.jobs.length >= 2
    ) {
      console.log("  ✅ Test 3 Passed: Twitter/X founder posts & hiring tweets extracted with tech stack.");
      passed++;
    } else {
      console.error("  ❌ Test 3 Failed:", { parsed, channelResult });
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 3 Errored:", err);
    failed++;
  }

  // -------------------------------------------------------------
  // Test 4: Reddit Referral Network
  // -------------------------------------------------------------
  try {
    console.log("\nTest 4: Reddit JSON Parsing & Referral Contact Extraction");
    const mockRedditJson = {
      data: {
        children: [
          {
            kind: "t3",
            data: {
              title: "[Hiring] Acme Corp is hiring a Principal Cloud Architect (Remote)",
              selftext: "Our team at Acme Corp is expanding! We have openings for Cloud Architects. Direct apply: https://jobs.ashbyhq.com/acme/cloud-arch",
              author: "acme_talent_lead",
              url: "https://www.reddit.com/r/forhire/comments/123456/hiring_acme/",
              permalink: "/r/forhire/comments/123456/hiring_acme/",
              subreddit: "forhire",
              created_utc: 1710000000,
              is_self: true,
            },
          },
          {
            kind: "t3",
            data: {
              title: "[Hiring] Acme Corp Engineering - Full Stack Dev",
              selftext: "DM me for an employee referral! We need React + Node engineers at Acme Corp.",
              author: "senior_dev_dan",
              url: "https://www.reddit.com/r/cscareerquestions/comments/654321/acme/",
              permalink: "/r/cscareerquestions/comments/654321/acme/",
              subreddit: "cscareerquestions",
              created_utc: 1710000010,
              is_self: true,
            },
          },
          {
            // Should be ignored: job seeker
            kind: "t3",
            data: {
              title: "[For Hire] Software Engineer looking for Acme Corp jobs",
              selftext: "I want to work at Acme Corp please hire me",
              author: "job_seeker_99",
              url: "https://www.reddit.com/r/forhire/comments/999999/",
              permalink: "/r/forhire/comments/999999/",
              subreddit: "forhire",
              created_utc: 1710000020,
              is_self: true,
            },
          },
        ],
      },
    };

    const parsed = parseRedditListingJson(mockRedditJson, "Acme Corp", "Software Engineer");

    const channelResult = await redditChannel.scan({
      companyName: "Acme Corp",
      fetcher: async () => JSON.stringify(mockRedditJson),
    });

    if (
      parsed.jobs.length === 2 &&
      parsed.recruiters.length === 2 &&
      parsed.recruiters.some((r) => r.fullName === "u/acme_talent_lead") &&
      parsed.jobs.some((j) => j.applyUrl.includes("ashbyhq.com")) &&
      channelResult.jobs.length === 2
    ) {
      console.log("  ✅ Test 4 Passed: Reddit unadvertised posts extracted & job-seekers filtered.");
      passed++;
    } else {
      console.error("  ❌ Test 4 Failed:", { parsed, channelResult });
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 4 Errored:", err);
    failed++;
  }

  // -------------------------------------------------------------
  // Test 5: YouTube Tech Talks & Recruiting Channel
  // -------------------------------------------------------------
  try {
    console.log("\nTest 5: YouTube Tech Talks & Featured Speaker Extraction");
    const mockYouTubeText = `
### Engineering Spotlight & Talks
* [Acme Corp Architecture: Scaling Distributed Databases - Speaker: Michael Chang, VP Infrastructure](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
  Deep dive into Acme Corp database storage engine with VP Infrastructure Michael Chang.
  We are hiring Staff Database Engineers! Apply at https://acme.careers/database-lead
* [A Day in the Life of a Frontend Engineer at Acme Corp](https://www.youtube.com/watch?v=9bZkp7q19f0)
  Meet our UI engineers and see how we build with React, Tailwind, and WebAssembly.
    `;

    const parsed = parseYouTubeVideosFromText(mockYouTubeText, "Acme Corp", "Database Engineer");

    const channelResult = await youtubeChannel.scan({
      companyName: "Acme Corp",
      fetcher: async () => mockYouTubeText,
    });

    if (
      parsed.jobs.length >= 2 &&
      parsed.recruiters.length >= 1 &&
      parsed.recruiters[0].fullName === "Michael Chang" &&
      parsed.recruiters[0].sourcePlatform === "YOUTUBE" &&
      channelResult.jobs.length >= 2
    ) {
      console.log("  ✅ Test 5 Passed: YouTube tech talks & speaker contacts correctly parsed.");
      passed++;
    } else {
      console.error("  ❌ Test 5 Failed:", { parsed, channelResult });
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 5 Errored:", err);
    failed++;
  }

  // -------------------------------------------------------------
  // Test 6: Multi-Channel Orchestration & Error Isolation
  // -------------------------------------------------------------
  try {
    console.log("\nTest 6: executeDeepReachScan Concurrency & Error Isolation");

    // Mock fetcher that fails on twitter but succeeds on others
    const customFetcher = async (url: string) => {
      if (url.includes("x.com") || url.includes("twitter")) {
        throw new Error("Simulated Twitter timeout / rate limit");
      }
      if (url.includes("reddit")) {
        return JSON.stringify({
          data: {
            children: [
              {
                kind: "t3",
                data: {
                  title: "[Hiring] Acme Cloud Engineer",
                  selftext: "Apply now at https://acme.com/apply/cloud",
                  author: "recruiter_dan",
                  url: "https://acme.com/apply/cloud",
                  permalink: "/r/forhire/comments/777777/",
                  subreddit: "forhire",
                  created_utc: 1710000000,
                },
              },
            ],
          },
        });
      }
      return `
[Diana Prince - Principal Recruiter | LinkedIn](https://www.linkedin.com/in/diana-prince-recruiting)
[Senior Systems Engineer](https://www.linkedin.com/jobs/view/4455667788)
      `;
    };

    const scanResult = await executeDeepReachScan({
      companyName: "Acme Corp",
      roleTitle: "Cloud Engineer",
      includeRecruiters: true,
      channels: {
        linkedIn: true,
        twitter: true,
        reddit: true,
        youtube: false,
      },
      fetcher: customFetcher,
    });

    if (
      scanResult.jobs.length > 0 &&
      scanResult.recruiters.length > 0 &&
      scanResult.channelErrors?.twitter &&
      scanResult.verificationSummary.verifiedJobs > 0
    ) {
      console.log("  ✅ Test 6 Passed: Error isolation preserved healthy channels despite Twitter error.");
      passed++;
    } else {
      console.error("  ❌ Test 6 Failed:", scanResult);
      failed++;
    }
  } catch (err) {
    console.error("  ❌ Test 6 Errored:", err);
    failed++;
  }

  console.log("\n=================================================");
  console.log(`📊 RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2ChannelsTestSuite().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});
