import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("v3.1 UI Alignment, Card Overflow & Hardening Suite", () => {
  const rootDir = process.cwd();

  it("1. Marketplace Header: should use solid opaque backdrop (no scroll bleed-through)", () => {
    const marketplacePage = fs.readFileSync(
      path.join(rootDir, "app/app/marketplace/page.tsx"),
      "utf-8"
    );
    assert.ok(
      marketplacePage.includes("bg-background/98"),
      "Marketplace header must use opaque background bg-background/98"
    );
    assert.ok(
      !marketplacePage.includes("bg-card/40"),
      "Marketplace header must NOT use semi-transparent bg-card/40"
    );
    assert.ok(
      marketplacePage.includes("sticky top-0 z-30"),
      "Marketplace header must retain sticky positioning at top-0"
    );
  });

  it("2. TaskInput AI Textbox: should be locked and uneditable during active search", () => {
    const taskInput = fs.readFileSync(
      path.join(rootDir, "components/agent/task-input.tsx"),
      "utf-8"
    );
    assert.ok(
      taskInput.includes("disabled={isBusy}"),
      "Textarea must have disabled={isBusy}"
    );
    assert.ok(
      taskInput.includes("readOnly={isListening || isBusy}"),
      "Textarea must have readOnly={isListening || isBusy}"
    );
    assert.ok(
      taskInput.includes("disabled:cursor-not-allowed"),
      "Textarea must render disabled:cursor-not-allowed styling"
    );
  });

  it("3. Discovery Page: should NOT render New Discovery or Watch trailing buttons", () => {
    const discoveryPage = fs.readFileSync(
      path.join(rootDir, "app/app/page.tsx"),
      "utf-8"
    );
    assert.ok(
      !discoveryPage.includes("trailingActions="),
      "Discovery page TaskInput must NOT pass trailingActions"
    );
    assert.ok(
      !discoveryPage.includes('<RotateCw className="h-3 w-3" />'),
      "New Discovery button must be purged from TaskInput tray"
    );
  });

  it("4. Top Navigation: should NOT include Plugins in NAV_ITEMS", () => {
    const topNav = fs.readFileSync(
      path.join(rootDir, "components/navigation/top-nav-island.tsx"),
      "utf-8"
    );
    assert.ok(
      !topNav.includes('{ label: "Plugins", href: "/app/plugins"'),
      "TopNavIsland must NOT contain Plugins route in main navigation bar"
    );
    assert.ok(
      topNav.includes('{ label: "Discover", href: "/app"'),
      "TopNavIsland must preserve Discover route"
    );
    assert.ok(
      topNav.includes('{ label: "Job Market", href: "/app/marketplace"'),
      "TopNavIsland must preserve Job Market route"
    );
  });

  it("5. Opportunity Cards: recruiter button and social snippet must be strictly constrained inside cards", () => {
    const deck = fs.readFileSync(
      path.join(rootDir, "components/result/job-dossier-deck.tsx"),
      "utf-8"
    );
    assert.ok(
      deck.includes("w-full max-w-full overflow-hidden"),
      "Recruiter chip must use w-full max-w-full overflow-hidden instead of overflowing w-fit"
    );
    assert.ok(
      deck.includes("max-w-[120px]") && deck.includes("max-w-[100px]"),
      "Recruiter full name and role title must have width truncation limits"
    );
    assert.ok(
      deck.includes("min-w-0 break-words overflow-hidden"),
      "Social snippet description must prevent word overflow"
    );
    assert.ok(
      deck.includes("text-sm sm:text-base font-bold text-foreground"),
      "Job title font size should use text-sm sm:text-base to save vertical card area"
    );
  });

  it("6. DeepReach v3.1: drawer and slideover must feature DeepReach v3.1 Verified Intelligence", () => {
    const drawer = fs.readFileSync(
      path.join(rootDir, "components/result/personnel-connect-drawer.tsx"),
      "utf-8"
    );
    assert.ok(
      drawer.includes("DeepReach v3.1"),
      "Personnel connect drawer must render DeepReach v3.1 badge"
    );
    assert.ok(
      !drawer.includes('<PrototypeBadge label="Prototype"'),
      "Personnel connect drawer must NOT render Prototype badge"
    );
    assert.ok(
      drawer.includes("cleanCompanyName"),
      "Personnel connect drawer must clean timestamp suffixes from company names"
    );

    const slideover = fs.readFileSync(
      path.join(rootDir, "components/result/job-detail-slideover.tsx"),
      "utf-8"
    );
    assert.ok(
      slideover.includes("DeepReach v3.1"),
      "Job detail slideover must render DeepReach v3.1 badge"
    );
    assert.ok(
      !slideover.includes('<PrototypeBadge label="Prototype"'),
      "Job detail slideover must NOT render Prototype badge"
    );
  });
});
