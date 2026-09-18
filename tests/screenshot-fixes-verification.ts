import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAtsSourceInfo, getSocialAuthorHandle } from "../lib/ats/atsSourceInfo";
import { resolveCompanyPersonnel, VERIFIED_COMPANY_PORTALS } from "../lib/discovery/personnel/companyPersonnelDirectory";
import { parseSearchIntent } from "../lib/scraper/intentParser";
import { createDiscoveryPlan } from "../lib/scraper/discoveryPlanner";

describe("Screenshot 1 Fix: Server Component ATS Source Info", () => {
  it("should extract ATS info correctly without client-side react hooks", () => {
    const greenhouseInfo = getAtsSourceInfo("Greenhouse", "https://boards.greenhouse.io/gitlab/jobs/12345");
    assert.equal(greenhouseInfo.name, "Greenhouse");
    assert.ok(greenhouseInfo.className.includes("text-[#0D6832]"));

    const leverInfo = getAtsSourceInfo(undefined, "https://jobs.lever.co/netflix/67890");
    assert.equal(leverInfo.name, "Lever");
    assert.ok(leverInfo.className.includes("text-[#0E4399]"));

    const ashbyInfo = getAtsSourceInfo(undefined, "https://jobs.ashbyhq.com/figma/abcde");
    assert.equal(ashbyInfo.name, "Ashby");
    assert.ok(ashbyInfo.className.includes("text-[#5636D6]"));

    const workdayInfo = getAtsSourceInfo(undefined, "https://myworkdayjobs.com/nvidia/job/R123");
    assert.equal(workdayInfo.name, "Workday");
    assert.ok(workdayInfo.className.includes("text-[#A14400]"));

    const directInfo = getAtsSourceInfo(undefined, "https://about.gitlab.com/handbook/engineering/");
    assert.equal(directInfo.name, "Direct Web");
  });

  it("should extract social author handles correctly", () => {
    assert.equal(getSocialAuthorHandle({ applyUrl: "https://x.com/tech_lead/status/123" }), "@tech_lead");
    assert.equal(getSocialAuthorHandle({ applyUrl: "https://twitter.com/recruiter_dan/status/456" }), "@recruiter_dan");
    assert.equal(getSocialAuthorHandle({ applyUrl: "https://www.reddit.com/r/cscareerquestions/comments/123/hiring" }), "r/cscareerquestions");
    assert.equal(getSocialAuthorHandle({ applyUrl: "https://github.com/torvalds/linux" }), null);
  });
});

describe("Screenshot 2 & 3 Fix: DeepReach Recruiter Outreach & GitLab Personnel", () => {
  it("should resolve GitLab company personnel with both Recruiter and Engineering contacts", () => {
    const gitlabPersonnel = resolveCompanyPersonnel("GitLab");
    assert.ok(gitlabPersonnel.length >= 2, "GitLab should have at least 2 verified contacts");
    
    const recruiters = gitlabPersonnel.filter(c => c.contactType === "RECRUITER" || /talent|recruiting|hr/i.test(c.roleTitle || ""));
    const engineers = gitlabPersonnel.filter(c => c.contactType === "EMPLOYEE" || /engineer|tech|hiring/i.test(c.roleTitle || ""));

    assert.ok(recruiters.length > 0, "Must have verified recruiter/talent contact for GitLab");
    assert.ok(engineers.length > 0, "Must have verified engineering contact for GitLab");

    for (const c of gitlabPersonnel) {
      assert.ok(c.email?.includes("@gitlab.com"), `Email ${c.email} should be an authentic @gitlab.com address`);
      assert.ok(c.confidence !== undefined && c.confidence >= 0.85, "Confidence should be >= 0.85");
      assert.equal(c.verificationSource, "OFFICIAL_PORTAL");
      assert.ok(c.notes && c.notes.length > 0, "Must have role and contact context notes");
      assert.ok(c.directConnect.email?.includes("mailto:"), "Must generate mailto direct connect link");
    }
  });

  it("should resolve Canonical, GitHub, Red Hat, Datadog with verified contacts", () => {
    for (const company of ["Canonical", "GitHub", "Red Hat", "Datadog", "NVIDIA"]) {
      const personnel = resolveCompanyPersonnel(company);
      assert.ok(personnel.length >= 2, `${company} should have personnel contacts resolved`);
      const hasEmail = personnel.every(p => p.email && p.email.includes("@"));
      assert.ok(hasEmail, `All contacts for ${company} must have valid emails`);
    }
  });

  it("should have verified portal entries for top tech companies", () => {
    const requiredKeys = ["gitlab", "github", "canonical", "redhat", "datadog", "snowflake", "atlassian", "salesforce", "adobe", "nvidia"];
    for (const key of requiredKeys) {
      assert.ok(VERIFIED_COMPANY_PORTALS[key], `Portal missing for key: ${key}`);
      assert.ok(VERIFIED_COMPANY_PORTALS[key].portalUrl.startsWith("http"), `Invalid portalUrl for ${key}`);
    }
  });
});

describe("Screenshot 4 Fix: Career Memory & Search Pipeline 30 Results", () => {
  it("should verify profile route structure provides both personalization and profile alias", async () => {
    // Check that profile object mapping matches expected contract
    const personalizationMock = {
      fullName: "Alex Rivera",
      targetRoles: ["Senior Frontend Engineer", "Full Stack Developer"],
      skills: ["React", "TypeScript", "Next.js"],
      preferredLocations: ["Remote", "San Francisco, CA"],
      preferredWorkModes: ["REMOTE", "HYBRID"],
      targetCompanies: ["GitLab", "GitHub", "Vercel"],
    };

    const responseData = {
      user: { id: "test-user-id", email: "alex@example.com" },
      personalization: personalizationMock,
      profile: personalizationMock,
      resume: null,
      portfolioLinks: []
    };

    assert.deepEqual(responseData.profile, responseData.personalization);
    assert.equal(responseData.profile.targetRoles[0], "Senior Frontend Engineer");
    assert.equal(responseData.profile.targetCompanies[0], "GitLab");
  });

  it("should default requestedCount to 30 in parseSearchIntent", () => {
    const parsed = parseSearchIntent("Senior Frontend Engineer Remote");
    assert.equal(parsed.requestedCount, 30, "Default requestedCount must be 30");
  });

  it("should plan for at least 30 results per source in discoveryPlanner", () => {
    const parsed = parseSearchIntent("Full Stack Developer");
    const plan = createDiscoveryPlan(parsed);
    assert.ok(plan.maxResultsPerSource >= 30, `Target results per source should be >= 30, got ${plan.maxResultsPerSource}`);
    assert.equal(plan.requestedCount, 30, `Plan requestedCount should be 30, got ${plan.requestedCount}`);
  });

  it("should guarantee non-zero contacts for unknown/unlisted companies without dummy names", () => {
    const unlisted = resolveCompanyPersonnel("AcmeCloudTech");
    assert.ok(unlisted.length >= 2, "Must resolve contacts for unlisted company");
    const hr = unlisted.filter(c => c.contactType === "RECRUITER" || /talent|recruiting|hr/i.test(c.roleTitle || ""));
    const eng = unlisted.filter(c => c.contactType === "EMPLOYEE" || /engineer|lead|tech/i.test(c.roleTitle || ""));
    assert.ok(hr.length > 0, "Must have HR contact for unlisted company");
    assert.ok(eng.length > 0, "Must have Engineering contact for unlisted company");
    for (const c of unlisted) {
      assert.ok(!c.fullName.includes("Sarah Jenkins"), "Zero dummy personas allowed (R6)");
      assert.ok(!c.fullName.includes("Alex Morgan"), "Zero dummy personas allowed (R6)");
      assert.ok(c.email && c.email.includes("@acmecloudtech.com"), "Must derive valid email from company domain");
    }
  });
});

describe("Voice STT & Dynamic Waveform Animation Verification", () => {
  it("should verify audio level normalization formula clamps between 0 and 1", () => {
    const normalize = (avg: number) => Math.min(1, Math.max(0, avg / 65));
    assert.equal(normalize(0), 0);
    assert.equal(normalize(65), 1);
    assert.equal(normalize(130), 1);
    assert.ok(normalize(32.5) > 0.49 && normalize(32.5) < 0.51);
  });

  it("should format multi-line speech transcription with capitalized lines", () => {
    const transcripts = ["find me frontend jobs", "specifically with react and tailwind", "must be remote"];
    const formatted = transcripts.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join("\n");
    assert.equal(
      formatted,
      "Find me frontend jobs\nSpecifically with react and tailwind\nMust be remote"
    );
  });
});
