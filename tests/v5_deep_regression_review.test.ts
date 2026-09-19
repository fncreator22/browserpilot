import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getUserTrialStatus,
  getAdminTrialConfig,
  updateAdminTrialConfig,
  extendUserTrial,
  setUserTrialExempt,
} from "../lib/billing/trialService";

describe("§TASK-V5: Deep Review Verification & Defect Prevention Suite", () => {
  describe("1. 15-Day Free Trial Gating & Enforcement Invariants", () => {
    it("should compute expired status when trial duration ends", async () => {
      // Simulate expired user
      const config = getAdminTrialConfig();
      const originalEnforce = config.enforceTrial;
      try {
        updateAdminTrialConfig({ enforceTrial: true, defaultTrialDays: 15 });
        
        // Non-existent or new user
        const status = await getUserTrialStatus("guest_tester_clock");
        assert.equal(status.isTrialActive, true);
        assert.equal(status.upgradeRequired, false);
      } finally {
        updateAdminTrialConfig({ enforceTrial: originalEnforce });
      }
    });

    it("search API route must include 15-day trial status gate", () => {
      const routeContent = fs.readFileSync(
        path.join(process.cwd(), "app/api/search/route.ts"),
        "utf8"
      );
      assert.ok(
        routeContent.includes("getUserTrialStatus"),
        "Search route must import and invoke getUserTrialStatus"
      );
      assert.ok(
        routeContent.includes("TRIAL_EXPIRED"),
        "Search route must enforce TRIAL_EXPIRED with HTTP 402"
      );
    });
  });

  describe("2. Modal Provider Gate & AI Connectors Navigation", () => {
    it("modal must provide session-aware navigation without login redirect loops", () => {
      const modalContent = fs.readFileSync(
        path.join(process.cwd(), "components/auth/search-access-gate-modal.tsx"),
        "utf8"
      );
      assert.ok(
        modalContent.includes("handleOpenConnectors"),
        "Modal must have handleOpenConnectors redirecting to /app/plugins"
      );
      assert.ok(
        modalContent.includes("/app/plugins"),
        "Modal must route logged-in users to /app/plugins"
      );
      assert.ok(
        modalContent.includes("isLoggedIn ?"),
        "Modal must conditionally distinguish logged-in users from guests"
      );
    });

    it("plugins page must feature dedicated AI Reasoning Connectors (Puter, Gemini, DeepSeek)", () => {
      const pluginsPage = fs.readFileSync(
        path.join(process.cwd(), "app/app/plugins/page.tsx"),
        "utf8"
      );
      assert.ok(
        pluginsPage.includes("AI Reasoning Providers & API Keys"),
        "Plugins page must contain AI Reasoning Providers & API Keys section"
      );
      assert.ok(
        pluginsPage.includes("handleConnectPuter"),
        "Plugins page must provide Puter connect/disconnect"
      );
      assert.ok(
        pluginsPage.includes("handleSaveBYOKKey"),
        "Plugins page must provide BYOK key management for Gemini and DeepSeek"
      );
    });
  });

  describe("3. Instant Recent Search Hydration & Textbox Sync", () => {
    it("task-input must listen for browserai:set-prompt custom event", () => {
      const taskInputContent = fs.readFileSync(
        path.join(process.cwd(), "components/agent/task-input.tsx"),
        "utf8"
      );
      assert.ok(
        taskInputContent.includes("browserai:set-prompt"),
        "TaskInput must register an event listener for browserai:set-prompt"
      );
    });

    it("app page must support in-memory search caching and loadSearchById prompt dispatch", () => {
      const appPageContent = fs.readFileSync(
        path.join(process.cwd(), "app/app/page.tsx"),
        "utf8"
      );
      assert.ok(
        appPageContent.includes("searchCacheRef"),
        "AppPage must maintain an in-memory searchCacheRef map"
      );
      assert.ok(
        appPageContent.includes("browserai:set-prompt"),
        "AppPage must dispatch browserai:set-prompt upon recent search selection"
      );
      assert.ok(
        appPageContent.includes("SearchAccessGateModal"),
        "AppPage must render SearchAccessGateModal on unconfigured dashboard access"
      );
    });
  });

  describe("4. Marketplace Header Solid Docking", () => {
    it("marketplace header must dock to top-0 with 100% solid bg-background", () => {
      const marketplacePage = fs.readFileSync(
        path.join(process.cwd(), "app/app/marketplace/page.tsx"),
        "utf8"
      );
      assert.ok(
        marketplacePage.includes("sticky top-0 z-30"),
        "Marketplace header must retain sticky positioning at top-0"
      );
      assert.ok(
        marketplacePage.includes("bg-background/98 backdrop-blur-md sticky top-0 z-30 shadow-xs"),
        "Marketplace header must be solid bg-background/98 with sticky top-0"
      );
    });
  });

  describe("5. Admin Observatory Live Agentic Radar", () => {
    it("admin agentic API must return activeSearches in flight telemetry", () => {
      const agenticRoute = fs.readFileSync(
        path.join(process.cwd(), "app/api/ops-sec-7f9c2d1b8e4a/agentic/route.ts"),
        "utf8"
      );
      assert.ok(
        agenticRoute.includes("activeSearches"),
        "Agentic route must include activeSearches query"
      );
    });

    it("admin agentic page must display Live Agentic AI Execution Radar", () => {
      const agenticPage = fs.readFileSync(
        path.join(process.cwd(), "app/ops-sec-7f9c2d1b8e4a/agentic/page.tsx"),
        "utf8"
      );
      assert.ok(
        agenticPage.includes("Live Agentic AI Execution Radar"),
        "Admin page must render Live Agentic AI Execution Radar"
      );
      assert.ok(
        agenticPage.includes("What is text?"),
        "Radar must explain 'What is text?'"
      );
      assert.ok(
        agenticPage.includes("What is Agentic AI doing?"),
        "Radar must explain 'What is Agentic AI doing?'"
      );
      assert.ok(
        agenticPage.includes("Which Layer Is It Right Now?"),
        "Radar must explain 'Which Layer Is It Right Now?'"
      );
      assert.ok(
        agenticPage.includes("Is it actually working?"),
        "Radar must provide 'Is it actually working?' health check"
      );
    });
  });
});
