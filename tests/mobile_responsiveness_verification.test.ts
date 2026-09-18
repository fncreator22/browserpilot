import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Mobile Responsiveness & Viewport Optimization Suite", () => {
  const rootDir = process.cwd();

  it("1. Opportunity Cards: should be fully responsive for mobile screens (390px)", () => {
    const deck = fs.readFileSync(
      path.join(rootDir, "components/result/job-dossier-deck.tsx"),
      "utf-8"
    );

    // Responsive grid
    assert.ok(
      deck.includes("grid grid-cols-1") || deck.includes("grid-cols-1 md:grid-cols-2"),
      "Dossier deck must render 1 column on mobile screens"
    );

    // Responsive padding and title sizing
    assert.ok(
      deck.includes("p-3.5 sm:p-4"),
      "Dossier deck must use compact mobile padding"
    );
    assert.ok(
      deck.includes("text-sm sm:text-base"),
      "Dossier deck job title must scale between text-sm on mobile and text-base on desktop"
    );

    // Recruiter role truncation on small screens
    assert.ok(
      deck.includes("hidden sm:inline"),
      "Long recruiter role title must be hidden on mobile to prevent chip horizontal overflow"
    );
  });

  it("2. Personnel Connect Drawer: should render bottom sheet with grab handle on mobile", () => {
    const drawer = fs.readFileSync(
      path.join(rootDir, "components/result/personnel-connect-drawer.tsx"),
      "utf-8"
    );

    // Mobile grab handle
    assert.ok(
      drawer.includes("md:hidden flex justify-center"),
      "Personnel connect drawer must include mobile grab handle for bottom sheet"
    );

    // Slide-over on desktop, bottom sheet on mobile
    assert.ok(
      drawer.includes("slide-in-from-bottom"),
      "Personnel connect drawer must animate from bottom on mobile"
    );

    // Responsive contact detail columns
    assert.ok(
      drawer.includes("grid-cols-1 sm:grid-cols-2"),
      "Contact details must stack in single column on mobile"
    );
  });

  it("3. Job Marketplace: should provide responsive search input and horizontal scroll categories", () => {
    const marketplace = fs.readFileSync(
      path.join(rootDir, "app/app/marketplace/page.tsx"),
      "utf-8"
    );

    // Mobile full-width search bar
    assert.ok(
      marketplace.includes("w-full sm:w-96"),
      "Marketplace search input must be full width on mobile"
    );

    // Horizontal category scroll
    assert.ok(
      marketplace.includes("overflow-x-auto") && marketplace.includes("scrollbar-none"),
      "Marketplace categories must allow smooth horizontal scrolling on mobile"
    );

    // Responsive utility strip
    assert.ok(
      marketplace.includes("flex flex-col sm:flex-row"),
      "Utility header actions must stack vertically on mobile"
    );
  });

  it("4. Task Input AI Box: should adapt height and controls for mobile viewports", () => {
    const taskInput = fs.readFileSync(
      path.join(rootDir, "components/agent/task-input.tsx"),
      "utf-8"
    );

    // Responsive textarea height bounds
    assert.ok(
      taskInput.includes("max-h-[160px] sm:max-h-[180px]"),
      "Textarea must cap max height on mobile to keep keyboard visible"
    );

    // Compact button labels for mobile
    assert.ok(
      taskInput.includes("hidden sm:inline"),
      "Longer action button labels must collapse on mobile"
    );
  });

  it("5. Mobile Navigation Dock: should render floating dock on mobile with profile modal link", () => {
    const mobileNav = fs.readFileSync(
      path.join(rootDir, "components/navigation/mobile-nav-pill.tsx"),
      "utf-8"
    );

    // Only shown on mobile/tablet viewports (<lg)
    assert.ok(
      mobileNav.includes("lg:hidden"),
      "Mobile nav pill must only be visible on mobile screens below lg breakpoint"
    );

    // Profile modal trigger
    assert.ok(
      mobileNav.includes("openProfileModal"),
      "Mobile nav pill must allow users to access profile modal and plugins on mobile"
    );
  });
});
