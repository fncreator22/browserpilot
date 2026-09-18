import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Landing Page Architecture & Navy Ink on Cool Marble Verification", () => {
  const landingDir = path.join(process.cwd(), "components", "landing");
  const pageFile = path.join(process.cwd(), "app", "page.tsx");
  const globalsCssFile = path.join(process.cwd(), "app", "globals.css");

  it("should have all required landing page component files", () => {
    const requiredFiles = [
      "landing-navbar.tsx",
      "hero-section.tsx",
      "hero-auth-form.tsx",
      "cave-stage.tsx",
      "trust-logo-strip.tsx",
      "solutions-carousel.tsx",
      "interactive-capabilities-section.tsx",
      "solutions-showcase.tsx",
      "testimonial-stage.tsx",
      "integrations-grid.tsx",
      "pricing-overview-section.tsx",
      "bottom-signup-stage.tsx",
      "dark-footer.tsx",
      "index.ts",
    ];

    for (const file of requiredFiles) {
      const fullPath = path.join(landingDir, file);
      assert.ok(fs.existsSync(fullPath), `Component ${file} should exist`);
    }
  });

  it("should verify app/page.tsx renders the 3D landing components and exports metadata", () => {
    assert.ok(fs.existsSync(pageFile), "app/page.tsx must exist");
    const content = fs.readFileSync(pageFile, "utf-8");
    assert.ok(content.includes("LandingNavbar"), "Must include LandingNavbar");
    assert.ok(content.includes("HeroSection"), "Must include HeroSection");
    assert.ok(content.includes("CaveStage"), "Must include CaveStage");
    assert.ok(content.includes("TrustLogoStrip"), "Must include TrustLogoStrip");
    assert.ok(content.includes("SolutionsCarousel"), "Must include SolutionsCarousel");
    assert.ok(content.includes("InteractiveCapabilitiesSection"), "Must include InteractiveCapabilitiesSection");
    assert.ok(content.includes("SolutionsShowcase"), "Must include SolutionsShowcase");
    assert.ok(content.includes("TestimonialStage"), "Must include TestimonialStage");
    assert.ok(content.includes("IntegrationsGrid"), "Must include IntegrationsGrid");
    assert.ok(content.includes("PricingOverviewSection"), "Must include PricingOverviewSection");
    assert.ok(content.includes("BottomSignupStage"), "Must include BottomSignupStage");
    assert.ok(content.includes("DarkFooter"), "Must include DarkFooter");
    assert.ok(content.includes("BrowserPilot: Autonomous Opportunity Discovery Platform"), "Must export title with colon instead of em-dash");
  });

  it("should verify core landing page design tokens in app/globals.css", () => {
    assert.ok(fs.existsSync(globalsCssFile), "globals.css must exist");
    const css = fs.readFileSync(globalsCssFile, "utf-8");
    assert.ok(css.includes("--color-ink-navy: #0b3558"), "Must contain Ink Navy token");
    assert.ok(css.includes("--color-signal-blue: #006bff"), "Must contain Signal Blue token");
    assert.ok(css.includes("--color-slate-gray: #476788"), "Must contain Slate Gray token");
    assert.ok(css.includes("--color-mist-gray: #a6bbd1"), "Must contain Mist Gray token");
    assert.ok(css.includes("--color-sky-cyan: #0099ff"), "Must contain Sky Cyan token");
    assert.ok(css.includes("--color-carbon: #0a0a0a"), "Must contain Carbon token");
    assert.ok(!css.includes("--color-coral-magenta: #e55cff"), "Must NOT contain purple/coral-magenta token");
  });

  it("should enforce zero em-dashes or en-dashes across all landing components and page", () => {
    const landingFiles = fs.readdirSync(landingDir).filter((f) => f.endsWith(".tsx"));
    const allFiles = [...landingFiles.map((f) => path.join(landingDir, f)), pageFile];

    for (const filePath of allFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      const base = path.basename(filePath);
      assert.ok(!content.includes("—"), `File ${base} must not contain em-dashes (—)`);
      assert.ok(!content.includes("–"), `File ${base} must not contain en-dashes (–)`);
    }
  });

  it("should enforce zero purple/magenta/fuchsia styling in landing components", () => {
    const landingFiles = fs.readdirSync(landingDir).filter((f) => f.endsWith(".tsx"));

    for (const file of landingFiles) {
      const content = fs.readFileSync(path.join(landingDir, file), "utf-8");
      assert.ok(!content.toLowerCase().includes("#e55cff"), `File ${file} must not contain #e55cff`);
      assert.ok(!content.includes("fuchsia"), `File ${file} must not contain fuchsia classes`);
      assert.ok(!content.includes("purple"), `File ${file} must not contain purple classes`);
      assert.ok(!content.includes("coral-magenta"), `File ${file} must not contain coral-magenta`);
    }
  });

  it("should enforce removal of all legacy AI eyebrow pill badges", () => {
    const landingFiles = fs.readdirSync(landingDir).filter((f) => f.endsWith(".tsx"));
    const legacyBadges = [
      "Autonomous Career Discovery",
      "Tailored Intelligence",
      "Autonomous Architecture",
      "First-Wave Advantage",
      "Zero-Ghost Guarantee",
      "DeepReach Intelligence",
      "Proven Candidate Outcomes",
      "Ecosystem & Connectivity",
      "Transparent Pricing",
      "Start Autonomous Discovery Today",
    ];

    for (const file of landingFiles) {
      const content = fs.readFileSync(path.join(landingDir, file), "utf-8");
      for (const badge of legacyBadges) {
        assert.ok(
          !content.includes(badge),
          `File ${file} should not contain eyebrow pill badge: "${badge}"`
        );
      }
    }
  });

  it("should enforce zero emojis across all landing components", () => {
    const landingFiles = fs.readdirSync(landingDir).filter((f) => f.endsWith(".tsx"));
    // Regex matching standard emoji ranges
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    for (const file of landingFiles) {
      const content = fs.readFileSync(path.join(landingDir, file), "utf-8");
      assert.ok(
        !emojiRegex.test(content),
        `File ${file} should contain zero emojis (must use Lucide SVG icons)`
      );
    }
  });

  it("should enforce zero pure #000000 or text-black styling in landing components", () => {
    const landingFiles = fs.readdirSync(landingDir).filter((f) => f.endsWith(".tsx"));

    for (const file of landingFiles) {
      const content = fs.readFileSync(path.join(landingDir, file), "utf-8");
      assert.ok(!content.includes("text-[#000000]"), `${file} should not have text-[#000000]`);
      assert.ok(!content.includes("text-black"), `${file} should not have text-black`);
    }
  });
});
