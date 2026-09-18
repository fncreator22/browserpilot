import test from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, getPlanPrice, SUPPORTED_CURRENCIES } from "../lib/billing/currency";
import { SOURCE_ALIASES } from "../lib/plugins/pluginMarketplaceService";

test("Currency Engine: formatCurrency and getPlanPrice", () => {
  assert.equal(formatCurrency(19, "USD"), "$19");
  assert.equal(formatCurrency(99, "USD"), "$99");
  assert.equal(formatCurrency(0, "USD"), "$0");

  assert.equal(formatCurrency(1499, "INR"), "₹1,499");
  assert.equal(formatCurrency(7999, "INR"), "₹7,999");
  assert.equal(formatCurrency(0, "INR"), "₹0");

  const freeUsd = getPlanPrice("FREE", "MONTHLY", "USD");
  assert.equal(freeUsd.amount, 0);
  assert.equal(freeUsd.formatted, "$0");

  const proUsd = getPlanPrice("PREMIUM", "MONTHLY", "USD");
  assert.equal(proUsd.amount, 19);
  assert.equal(proUsd.formatted, "$19");

  const freeInr = getPlanPrice("FREE", "MONTHLY", "INR");
  assert.equal(freeInr.amount, 0);
  assert.equal(freeInr.formatted, "₹0");

  const proInr = getPlanPrice("PREMIUM", "MONTHLY", "INR");
  assert.equal(proInr.amount, 1499);
  assert.equal(proInr.formatted, "₹1,499");

  const entInr = getPlanPrice("ENTERPRISE", "MONTHLY", "INR");
  assert.equal(entInr.amount, 7999);
  assert.equal(entInr.formatted, "₹7,999");

  assert.deepEqual(Object.keys(SUPPORTED_CURRENCIES), ["USD", "INR"]);
});

test("Plugins Marketplace: Multi-alias Twitter resolution", () => {
  assert.ok(SOURCE_ALIASES.x_twitter.includes("twitter"));
  assert.ok(SOURCE_ALIASES.x_twitter.includes("x"));
  assert.ok(SOURCE_ALIASES.x_twitter.includes("x_twitter"));
  assert.ok(SOURCE_ALIASES.twitter.includes("x_twitter"));
});

test("Client Search Error Sanitization Logic", () => {
  const sanitizeError = (err: Error): string => {
    const rawMsg = err.message || "";
    const isTechnicalError = 
      rawMsg.includes("JSON") || 
      rawMsg.includes("Unexpected end") || 
      rawMsg.includes("Failed to execute 'json'") ||
      rawMsg.includes("fetch failed") ||
      rawMsg.includes("NetworkError") ||
      rawMsg.includes("Load failed");

    return isTechnicalError
      ? "We could not complete your search at this moment. Please check your internet connection or retry shortly."
      : rawMsg || "An unexpected issue occurred during your search. Please try again.";
  };

  const syntaxErr = new Error("Failed to execute 'json' on 'Response': Unexpected end of JSON input");
  const friendly1 = sanitizeError(syntaxErr);
  assert.equal(friendly1, "We could not complete your search at this moment. Please check your internet connection or retry shortly.");
  assert.ok(!friendly1.includes("JSON"));
  assert.ok(!friendly1.includes("Unexpected end"));

  const netErr = new Error("TypeError: fetch failed");
  const friendly2 = sanitizeError(netErr);
  assert.equal(friendly2, "We could not complete your search at this moment. Please check your internet connection or retry shortly.");

  const domainErr = new Error("Please sign in or configure an AI API key to execute discovery searches.");
  const friendly3 = sanitizeError(domainErr);
  assert.equal(friendly3, "Please sign in or configure an AI API key to execute discovery searches.");
});
