import { parseSearchIntent } from "@/lib/scraper/intentParser";
import { buildDiscoveryPlan } from "@/lib/scraper/discoveryPlanner";

console.log("=== QUERY 1: 'AI intern' ===");
const intent1 = parseSearchIntent("AI intern");
const plan1 = buildDiscoveryPlan("AI intern");
console.log("Intent 1:");
console.dir(intent1, { depth: null });
console.log("\nPlan 1:");
console.dir(plan1, { depth: null });

console.log("\n=== QUERY 2: 'find me jobs for Management' ===");
const intent2 = parseSearchIntent("find me jobs for Management");
const plan2 = buildDiscoveryPlan("find me jobs for Management");
console.log("Intent 2:");
console.dir(intent2, { depth: null });
console.log("\nPlan 2:");
console.dir(plan2, { depth: null });
