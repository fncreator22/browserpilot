import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("Stage 6: Theme Changer Restoration and Dead Code Verification", () => {
  const rootDir = process.cwd();

  test("1. Verifying ThemeToggle import and mount in SettingsModal", () => {
    const settingsPath = path.join(rootDir, "components", "settings", "settings-modal.tsx");
    const content = fs.readFileSync(settingsPath, "utf-8");

    assert.ok(
      content.includes('import { ThemeToggle } from "@/components/theme-toggle"'),
      "settings-modal.tsx must import ThemeToggle"
    );
    assert.ok(
      content.includes("Interface Appearance"),
      "settings-modal.tsx must contain 'Interface Appearance' section label"
    );
    assert.ok(
      content.includes("<ThemeToggle />"),
      "settings-modal.tsx must render <ThemeToggle /> inside the Account settings tab"
    );
    console.log("  [PASS] SettingsModal cleanly mounts ThemeToggle in Account tab");
  });

  test("2. Verifying ThemeToggle import and mount in AppSidebar", () => {
    const sidebarPath = path.join(rootDir, "components", "navigation", "app-sidebar.tsx");
    const content = fs.readFileSync(sidebarPath, "utf-8");

    assert.ok(
      content.includes('import { ThemeToggle } from "@/components/theme-toggle"'),
      "app-sidebar.tsx must import ThemeToggle"
    );
    assert.ok(
      content.includes('<ThemeToggle className="w-8 h-8 mx-auto" />'),
      "app-sidebar.tsx must render ThemeToggle in collapsed sidebar profile view"
    );
    assert.ok(
      content.includes('<ThemeToggle className="shrink-0" />'),
      "app-sidebar.tsx must render ThemeToggle in expanded sidebar profile view"
    );
    console.log("  [PASS] AppSidebar cleanly mounts ThemeToggle in collapsed and expanded footers");
  });

  test("3. Verifying Zero Em-dash (\\u2014), En-dash (\\u2013), and Emoji directives", () => {
    const targetFiles = [
      path.join(rootDir, "components", "settings", "settings-modal.tsx"),
      path.join(rootDir, "components", "navigation", "app-sidebar.tsx"),
      path.join(rootDir, "components", "theme-toggle.tsx"),
      path.join(rootDir, "lib", "verification", "midwayVerifier.ts")
    ];

    const emDashRegex = /\u2014/;
    const enDashRegex = /\u2013/;
    const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF]/;

    for (const filePath of targetFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      assert.strictEqual(
        emDashRegex.test(content),
        false,
        `File ${path.basename(filePath)} contains forbidden em dash (\\u2014)`
      );
      assert.strictEqual(
        enDashRegex.test(content),
        false,
        `File ${path.basename(filePath)} contains forbidden en dash (\\u2013)`
      );
      assert.strictEqual(
        emojiRegex.test(content),
        false,
        `File ${path.basename(filePath)} contains forbidden unicode emoji`
      );
    }
    console.log("  [PASS] Zero em-dashes, en-dashes, and emojis strictly verified across all Stage 6 targets");
  });

  test("4. Verifying elimination of speculative raw SMTP socket connections", () => {
    const midwayPath = path.join(rootDir, "lib", "verification", "midwayVerifier.ts");
    const content = fs.readFileSync(midwayPath, "utf-8");

    assert.strictEqual(
      content.includes("RCPT TO"),
      false,
      "midwayVerifier.ts must not contain speculative raw socket 'RCPT TO' commands"
    );
    assert.ok(
      content.includes("resolveMx"),
      "midwayVerifier.ts must utilize authentic DNS resolveMx"
    );
    console.log("  [PASS] Dead SMTP socket connections eliminated in favor of verified DNS MX resolution");
  });
});
