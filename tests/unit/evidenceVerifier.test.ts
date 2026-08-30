import assert from "assert";
import { validateJobPageContent } from "@/lib/scraper/evidenceVerifier";
import { isSafePublicUrl } from "@/lib/scraper/providers/baseProvider";

export async function runEvidenceVerifierUnitTests(): Promise<void> {
  console.log("▶ [UNIT] Running Evidence Verifier & Job Content Validation Tests (TASK-006)...");

  // 1. Valid genuine job posting
  const validText = `
    Acme AI - Senior Machine Learning Engineer
    About the role:
    We are looking for a Senior Machine Learning Engineer to join our core AI agent team.
    Responsibilities:
    - Design and scale distributed LLM pipelines
    - Optimize inference latency using PyTorch and TensorRT
    Qualifications:
    - 5+ years of experience with Python and Deep Learning frameworks
    - Strong background in transformer architectures
    Salary: $160,000 - $210,000 per year
    Apply now before the deadline.
  `;
  const validRes = validateJobPageContent(validText, "Senior ML Engineer - Acme AI Careers");
  assert.strictEqual(validRes.isValid, true, "Genuine job page must be validated as true");
  assert.strictEqual(validRes.reason, "GENUINE_JOB_CONTENT_VERIFIED");
  console.log("  ✓ Verified genuine job content validation");

  // 2. White-screen / Insufficient body content rejection
  const blankText = "   ";
  const blankRes = validateJobPageContent(blankText, "Blank Page");
  assert.strictEqual(blankRes.isValid, false, "Blank page must be rejected");
  assert.strictEqual(blankRes.reason, "BLANK_OR_INSUFFICIENT_BODY_CONTENT");

  const tinyText = "Hello world short page";
  const tinyRes = validateJobPageContent(tinyText, "Short Page");
  assert.strictEqual(tinyRes.isValid, false, "Page under 150 chars must be rejected");
  console.log("  ✓ Verified white-screen and insufficient body content rejection");

  // 3. HTTP status code rejection
  const notFoundRes = validateJobPageContent(validText, "404 Not Found", 404);
  assert.strictEqual(notFoundRes.isValid, false, "404 status code must be rejected");
  assert.strictEqual(notFoundRes.reason, "HTTP_STATUS_404");

  const forbiddenRes = validateJobPageContent(validText, "403 Forbidden", 403);
  assert.strictEqual(forbiddenRes.isValid, false, "403 status code must be rejected");
  console.log("  ✓ Verified HTTP error status code rejection (404/403)");

  // 4. Expired job notice rejection
  const expiredText = `
    Thank you for your interest in Acme Corp.
    Unfortunately, this job has expired and the position has been filled.
    Please check our careers page for other active openings.
    We are no longer accepting applications for this listing.
  `;
  const expiredRes = validateJobPageContent(expiredText, "Acme Careers");
  assert.strictEqual(expiredRes.isValid, false, "Expired job notice must be rejected");
  assert.strictEqual(expiredRes.reason, "JOB_EXPIRED_OR_NOT_FOUND");
  console.log("  ✓ Verified expired job and closed listing rejection");

  // 5. Bot Challenge / CAPTCHA / Cloudflare WAF rejection
  const captchaText = `
    Please verify you are human to continue.
    Checking your browser before accessing the website.
    Cloudflare Ray ID: 8934759283749283
    Security check to continue to the application.
  `;
  const captchaRes = validateJobPageContent(captchaText, "Just a moment...");
  assert.strictEqual(captchaRes.isValid, false, "Bot challenge / CAPTCHA page must be rejected");
  assert.strictEqual(captchaRes.reason, "BOT_CHALLENGE_OR_CAPTCHA_INTERSTITIAL");
  console.log("  ✓ Verified CAPTCHA and Cloudflare interstitial rejection");

  // 6. Hard Login Wall blocking job content
  const loginWallText = `
    Welcome to Private Job Portal.
    Sign in to see more opportunities.
    Please enter your username and password to continue.
    Forgot password? Create an account now.
  `;
  const loginRes = validateJobPageContent(loginWallText, "Sign In - Enterprise Portal");
  assert.strictEqual(loginRes.isValid, false, "Login wall with no job content must be rejected");
  assert.strictEqual(loginRes.reason, "AUTH_LOGIN_WALL_BLOCKING_CONTENT");
  console.log("  ✓ Verified login wall blocking content rejection");

  // 7. SSRF Protection validation
  assert.strictEqual(isSafePublicUrl("https://linkedin.com/jobs/view/12345"), true);
  assert.strictEqual(isSafePublicUrl("https://workatastartup.com/jobs/67890"), true);
  assert.strictEqual(isSafePublicUrl("http://localhost:3000/api/secret"), false);
  assert.strictEqual(isSafePublicUrl("http://127.0.0.1:8000"), false);
  assert.strictEqual(isSafePublicUrl("http://169.254.169.254/latest/meta-data"), false);
  assert.strictEqual(isSafePublicUrl("http://192.168.1.1/admin"), false);
  assert.strictEqual(isSafePublicUrl("http://10.0.0.1/private"), false);
  assert.strictEqual(isSafePublicUrl("ftp://files.com/job.pdf"), false);
  console.log("  ✓ Verified SSRF guard security boundaries");

  console.log("✓ [UNIT] Evidence Verifier Unit Tests Passed!\n");
}
