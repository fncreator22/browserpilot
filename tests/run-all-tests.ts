process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

import { browserPool } from "@/worker/browser";
import { runPlanValidatorTests } from "./unit/planValidator.test";
import { runCapabilityGuardTests } from "./unit/capabilityGuard.test";
import { runResultVerifierTests } from "./unit/resultVerifier.test";
import { runErrorMapperUnitTests } from "./unit/errorMapper.test";
import { runGeminiGuardTests } from "./unit/geminiGuard.test";
import { runAuthTests } from "./unit/auth.test";
import { runCleanupUnitTests } from "./unit/cleanup.test";
import { runTimeBudgetUnitTests } from "./unit/timeBudget.test";
import { runExecutorIntegrationTests } from "./integration/executor.test";
import { runMultiUserIntegrationTests } from "./integration/multiUser.test";
import { runConcurrentUserIsolationTests } from "./integration/concurrentUserIsolation.test";
import { runWorkerConcurrencyLimitTest } from "./integration/workerConcurrencyLimit.test";
import { runTimeBudgetWatchdogIntegrationTest } from "./integration/timeBudgetWatchdog.test";
import { runImmediateFailurePropagationTest } from "./integration/immediateFailurePropagation.test";
import { runJobCancellationIntegrationTest } from "./integration/jobCancellation.test";
import { runOpportunityDbIntegrationTests } from "./integration/opportunityDb.test";
import { runMultiSearchIntegrationTests } from "./integration/multiSearch.test";
import { runDeduplicationUnitTests } from "./unit/deduplication.test";
import { runRankerUnitTests } from "./unit/ranker.test";
import { runNaturalLanguageIntentTests } from "./unit/naturalLanguageIntent.test";
import { runUnifiedNaturalLanguageRoutingTests } from "./unit/unifiedNaturalLanguageRouting.test";
import { runOutboundEmailDeliveryTests } from "./unit/outboundEmailDelivery.test";
import { runSearchIntegrationTests } from "./integration/searchIntegration.test";
import { runEvidenceVerifierUnitTests } from "./unit/evidenceVerifier.test";
import { runEvidenceVerificationIntegrationTests } from "./integration/evidenceVerification.test";
import { runOpportunityDetailIntegrationTests } from "./integration/opportunityDetail.test";
import { runSearchHistoryIntegrationTests } from "./integration/searchHistory.test";
import { runOpportunityFreshnessIntegrationTests } from "./integration/opportunityFreshness.test";
import { runSavedOpportunityMonitoringIntegrationTests } from "./integration/savedOpportunityMonitoring.test";
import { runResultPresentationIntegrationTests } from "./integration/resultPresentation.test";
import { runStructuredOpportunityExtractionIntegrationTests } from "./integration/structuredOpportunityExtraction.test";
import { runPersonalizedSwarmDiscoveryIntegrationTests } from "./integration/personalizedSwarmDiscovery.test";
import { runAutonomousDiscoveryIntegrationTests } from "./integration/autonomousDiscovery.test";
import { runDiscoverySchedulerIntegrationTests } from "./integration/discoveryScheduler.test";
import { runProductionSchedulerIntegrationTests } from "./integration/productionScheduler.test";
import { runPostgresProductionSchedulerTests } from "./integration/postgresProductionScheduler.test";
import { runSwarmConfigurationWatchTests } from "./integration/swarmConfigurationWatch.test";
import { runAdminControlPlaneHardeningTests } from "./integration/adminControlPlaneHardening.test";
import { runSwarmRuntimeVerificationTests } from "./integration/swarmRuntimeVerification.test";
import { runAdminControlPlaneUITests } from "./integration/adminControlPlaneUI.test";
import { runDiscoveryExecutionIntegrityTests } from "./integration/discoveryExecutionIntegrity.test";
import { runDiscoveryFreshnessIntegrityTests } from "./integration/discoveryFreshnessIntegrity.test";
import { runWorkspaceIATests } from "./integration/workspaceInformationArchitecture.test";
import { runDiscoveryExperienceHardeningTests } from "./integration/discoveryExperienceHardening.test";
import { runUIFoundationDesignSystemTests } from "./integration/uiFoundationDesignSystem.test";
import { runAccountOnboardingProfileTests } from "./integration/accountOnboardingProfile.test";
import { runProviderUsageGovernanceTests } from "./integration/providerUsageGovernance.test";
import { runMonetizationEntitlementTests } from "./integration/monetizationEntitlement.test";
import { runProductionSecurityHardeningTests } from "./integration/productionSecurityHardening.test";
import { runProductionInfrastructureReadinessTests } from "./integration/productionInfrastructureReadiness.test";
import { runDistributedRuntimeReliabilityTests } from "./integration/distributedRuntimeReliability.test";
import { runPersonalizedDiscoveryConfigurationTests } from "./integration/personalizedDiscoveryConfiguration.test";
import { runMultiSourceDiscoveryIntelligenceTests } from "./integration/multiSourceDiscoveryIntelligence.test";
import { runAuthenticatedBrowserDiscoveryTests } from "./integration/authenticatedBrowserDiscovery.test";
import { runDiscoveryIntelligenceLearningTests } from "./integration/discoveryIntelligenceLearning.test";
import { runProductionDiscoveryExecutionTests } from "./integration/productionDiscoveryExecution.test";
import { runOpportunityLifecycleIntelligenceTests } from "./integration/opportunityLifecycleIntelligence.test";
import { runNaturalLanguageDateAccuracyTests } from "./integration/naturalLanguageDateAccuracy.test";
import { runSearchAccuracyAndMetadataTests } from "./integration/searchAccuracyAndMetadata.test";
import { runRealWorldSearchExecutionValidationTests } from "./integration/realWorldSearchExecutionValidation.test";
import { runSearchReliabilityAndRecoveryTests } from "./integration/searchReliabilityAndRecovery.test";
import { runMemoryVaultFoundationTests } from "./integration/memoryVaultFoundation.test";
import { runIntelligenceHarnessCoreTests } from "./integration/intelligenceHarnessCore.test";
import { runIntelligenceBrainCoreTests } from "./integration/intelligenceBrainCore.test";
import { runIntelligentToolOrchestrationTests } from "./integration/intelligentToolOrchestration.test";
import { runEvidenceBasedVerificationTests } from "./integration/evidenceBasedVerification.test";
import { runAutonomousSearchCorrectionTests } from "./integration/autonomousSearchCorrection.test";
import { runProductionSearchIntegrationTests } from "./integration/productionSearchIntegration.test";
import { runProductionUIFoundationTests } from "./integration/productionUIFoundation.test";
import { runSearchResultsExperienceTests } from "./integration/searchResultsExperience.test";
import { runUserMemoryAndPersonalizationTests } from "./integration/userMemoryAndPersonalization.test";
import { runProductionReliabilityAndObservabilityTests } from "./integration/productionReliabilityAndObservability.test";
import { runFinalSecurityAndAbuseGateTests } from "./integration/finalSecurityAndAbuseGate.test";
import { runNaturalLanguageWorkflowAcceptanceTest } from "./integration/naturalLanguageWorkflowAcceptance.test";
import { runAutonomousJobMonitoringSimulation } from "./integration/autonomousJobMonitoringSimulation.test";
import { runEndToEndPipelineTest } from "./e2e/autonomousPipeline.test";

async function runMasterTestSuite() {
  console.log("=================================================");
  console.log("  BROWSERPILOT MASTER TEST SUITE & §36 VALIDATION");
  console.log("=================================================\n");

  const startTime = Date.now();
  const summary: Array<{ suite: string; status: "PASS" | "FAIL"; durationMs: number; error?: string }> = [];

  const suites = [
    { name: "Unit: Plan Validator", fn: runPlanValidatorTests },
    { name: "Unit: Capability Guard", fn: runCapabilityGuardTests },
    { name: "Unit: Result Verifier", fn: runResultVerifierTests },
    { name: "Unit: Error Mapper (§26)", fn: runErrorMapperUnitTests },
    { name: "Unit: Gemini Key Fallback Guard", fn: runGeminiGuardTests },
    { name: "Unit: Email/Password Auth & Minimal Schema", fn: runAuthTests },
    { name: "Unit: 24-Hour Auto-Purge & Retention", fn: runCleanupUnitTests },
    { name: "Unit: Fast-Calculated Time Budget (Prompt C2)", fn: runTimeBudgetUnitTests },
    { name: "Unit: Normalization & 3-Tier Deduplication (TASK-004)", fn: runDeduplicationUnitTests },
    { name: "Unit: 100-Point Student Relevance Ranker (TASK-004)", fn: runRankerUnitTests },
    { name: "Unit: Natural-Language Intent Interpretation (TASK-018)", fn: runNaturalLanguageIntentTests },
    { name: "Unit: Unified Natural-Language Routing (TASK-019)", fn: runUnifiedNaturalLanguageRoutingTests },
    { name: "Unit: Outbound LifecycleAlert Email Delivery (TASK-020)", fn: runOutboundEmailDeliveryTests },
    { name: "Unit: Evidence Verifier & Content Validation (TASK-006)", fn: runEvidenceVerifierUnitTests },
    { name: "Integration: Opportunity Database & Domain Schema (TASK-001 & 002)", fn: runOpportunityDbIntegrationTests },
    { name: "Integration: Pluggable Multi-Source Search Adapters (TASK-003)", fn: runMultiSearchIntegrationTests },
    { name: "Integration: Production Search & Opportunity Integration (TASK-005)", fn: runSearchIntegrationTests },
    { name: "Integration: Playwright Evidence Verification & Proofs (TASK-006)", fn: runEvidenceVerificationIntegrationTests },
    { name: "Integration: Opportunity Detail & Evidence Workspace (TASK-007)", fn: runOpportunityDetailIntegrationTests },
    { name: "Integration: Search History & Re-runable Sessions (TASK-008)", fn: runSearchHistoryIntegrationTests },
    { name: "Integration: Opportunity Freshness & Lifecycle Revalidation (TASK-009)", fn: runOpportunityFreshnessIntegrationTests },
    { name: "Integration: Saved Opportunity Monitoring & Alerts (TASK-010)", fn: runSavedOpportunityMonitoringIntegrationTests },
    { name: "Integration: Result Presentation & Structured Dossier (TASK-011)", fn: runResultPresentationIntegrationTests },
    { name: "Integration: Structured Opportunity Extraction Contract (TASK-012)", fn: runStructuredOpportunityExtractionIntegrationTests },
    { name: "Integration: Personalized Swarm Discovery & Freshness (TASK-013)", fn: runPersonalizedSwarmDiscoveryIntegrationTests },
    { name: "Integration: Autonomous Discovery & Novelty Intelligence (TASK-014)", fn: runAutonomousDiscoveryIntegrationTests },
    { name: "Integration: Autonomous Watch Scheduler & Orchestration (TASK-015)", fn: runDiscoverySchedulerIntegrationTests },
    { name: "Integration: Production Scheduler & Proactive Alerts (TASK-016)", fn: runProductionSchedulerIntegrationTests },
    { name: "Integration: PostgreSQL Production Database & CloudWatch Scheduler (TASK-021)", fn: runPostgresProductionSchedulerTests },
    { name: "Integration: Swarm Configuration, Company Targeting & Intervals (TASK-022)", fn: runSwarmConfigurationWatchTests },
    { name: "Integration: Production Hardening & Admin Control Plane (TASK-023)", fn: runAdminControlPlaneHardeningTests },
    { name: "Integration: Swarm Runtime Verification & Company Targeting (TASK-024)", fn: runSwarmRuntimeVerificationTests },
    { name: "Integration: Admin Control Plane UI & API Integration (TASK-025)", fn: runAdminControlPlaneUITests },
    { name: "Integration: Discovery Execution Integrity & Score Transparency (TASK-026)", fn: runDiscoveryExecutionIntegrityTests },
    { name: "Integration: Discovery Freshness & Time-Bound Search Integrity (TASK-027)", fn: runDiscoveryFreshnessIntegrityTests },
    { name: "Integration: Workspace Information Architecture & Discovery UX (TASK-028)", fn: runWorkspaceIATests },
    { name: "Integration: Discovery Experience Hardening & Intent Transparency (TASK-029)", fn: runDiscoveryExperienceHardeningTests },
    { name: "Integration: UI Foundation, Responsive Design System & Consistency (TASK-030)", fn: runUIFoundationDesignSystemTests },
    { name: "Integration: Account Onboarding, User Profile & Personalization (TASK-031)", fn: runAccountOnboardingProfileTests },
    { name: "Integration: Provider Connections & AI Usage Governance (TASK-032)", fn: runProviderUsageGovernanceTests },
    { name: "Integration: Monetization, Plans, Usage Limits & Coupons (TASK-033)", fn: runMonetizationEntitlementTests },
    { name: "Integration: Production Security, Privacy & Tenant Isolation (TASK-034)", fn: runProductionSecurityHardeningTests },
    { name: "Integration: Production Infrastructure & AWS Readiness (TASK-035)", fn: runProductionInfrastructureReadinessTests },
    { name: "Integration: Distributed Runtime & Scheduler Reliability (TASK-036)", fn: runDistributedRuntimeReliabilityTests },
    { name: "Integration: Personalized Discovery & Swarm Configuration (TASK-037)", fn: runPersonalizedDiscoveryConfigurationTests },
    { name: "Integration: Multi-Source Discovery Intelligence (TASK-038)", fn: runMultiSourceDiscoveryIntelligenceTests },
    { name: "Integration: Authenticated Browser Discovery & Sessions (TASK-039)", fn: runAuthenticatedBrowserDiscoveryTests },
    { name: "Integration: Discovery Intelligence & Source Learning (TASK-040)", fn: runDiscoveryIntelligenceLearningTests },
    { name: "Integration: Production Discovery Execution & Browser Reliability (TASK-041)", fn: runProductionDiscoveryExecutionTests },
    { name: "Integration: Opportunity Lifecycle & Search Memory (TASK-042)", fn: runOpportunityLifecycleIntelligenceTests },
    { name: "Integration: Natural-Language Intent & Date Accuracy (TASK-043)", fn: runNaturalLanguageDateAccuracyTests },
    { name: "Integration: Search Result Accuracy & Verified Metadata (TASK-044)", fn: runSearchAccuracyAndMetadataTests },
    { name: "Integration: Real-World Search Execution & Quality Hardening (TASK-045)", fn: runRealWorldSearchExecutionValidationTests },
    { name: "Integration: Production Search Reliability & Source Recovery (TASK-046)", fn: runSearchReliabilityAndRecoveryTests },
    { name: "Integration: Memory Vault Foundation & Isolation (TASK-047)", fn: runMemoryVaultFoundationTests },
    { name: "Integration: Canonical Intelligence Harness Core (TASK-048)", fn: runIntelligenceHarnessCoreTests },
    { name: "Integration: Intelligence Brain & RAG Context (TASK-049)", fn: runIntelligenceBrainCoreTests },
    { name: "Integration: Intelligent Search Planning & Tool Orchestration (TASK-050)", fn: runIntelligentToolOrchestrationTests },
    { name: "Integration: Evidence-Based Result Verification & Semantic Judge (TASK-051)", fn: runEvidenceBasedVerificationTests },
    { name: "Integration: Autonomous Search Correction Loop (TASK-052)", fn: runAutonomousSearchCorrectionTests },
    { name: "Integration: BrowserPilot Production Search Integration (TASK-053)", fn: runProductionSearchIntegrationTests },
    { name: "Integration: BrowserPilot Production UI Foundation (TASK-054)", fn: runProductionUIFoundationTests },
    { name: "Integration: BrowserPilot Search Results Experience (TASK-055)", fn: runSearchResultsExperienceTests },
    { name: "Integration: BrowserPilot User Memory & Personalization (TASK-056)", fn: runUserMemoryAndPersonalizationTests },
    { name: "Integration: Production Reliability, Observability & Failure Recovery (TASK-057)", fn: runProductionReliabilityAndObservabilityTests },
    { name: "Integration: Final Security, Abuse & Data-Isolation Gate (TASK-058)", fn: runFinalSecurityAndAbuseGateTests },
    { name: "Integration: End-to-End Natural-Language Workflow Acceptance", fn: runNaturalLanguageWorkflowAcceptanceTest },
    { name: "Integration: Autonomous Job Monitoring Lifecycle Simulation", fn: runAutonomousJobMonitoringSimulation },
    { name: "Integration: Playwright Executor & Fixture", fn: runExecutorIntegrationTests },
    { name: "Integration: Multi-User Isolation & Limits (§36 Test 6)", fn: runMultiUserIntegrationTests },
    { name: "Integration: Real Concurrent User Isolation (Prompt C1)", fn: runConcurrentUserIsolationTests },
    { name: "Integration: Worker Concurrency Limit & Throttling", fn: runWorkerConcurrencyLimitTest },
    { name: "Integration: Time Budget Watchdog & Timeout (Prompt C2)", fn: runTimeBudgetWatchdogIntegrationTest },
    { name: "Integration: Immediate Real Failure Propagation (Prompt C3)", fn: runImmediateFailurePropagationTest },
    { name: "Integration: Real Job Cancellation & Orphan Checks (Prompt C4)", fn: runJobCancellationIntegrationTest },
    { name: "E2E: Full Autonomous Agent Pipeline", fn: runEndToEndPipelineTest },
  ];

  for (const suite of suites) {
    const t0 = Date.now();
    try {
      await suite.fn();
      summary.push({ suite: suite.name, status: "PASS", durationMs: Date.now() - t0 });
    } catch (err: unknown) {
      summary.push({
        suite: suite.name,
        status: "FAIL",
        durationMs: Date.now() - t0,
        error: (err as Error).message,
      });
      console.error(`❌ Suite Failed: ${suite.name}\n`, err);
    }
  }

  await browserPool.closeAll();

  console.log("=================================================");
  console.log("  TEST EXECUTION SUMMARY MATRIX                  ");
  console.log("=================================================");
  summary.forEach((s) => {
    const icon = s.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} [${s.status}] ${s.suite.padEnd(54)} (${s.durationMs}ms)`);
    if (s.error) console.log(`   Error: ${s.error}`);
  });

  const totalElapsed = Date.now() - startTime;
  const allPassed = summary.every((s) => s.status === "PASS");

  console.log("=================================================");
  console.log(`Total Duration: ${totalElapsed}ms`);
  console.log(`Final Result: ${allPassed ? "ALL TEST SUITES GREEN! ✅" : "SOME SUITES FAILED ❌"}`);
  console.log("=================================================\n");

  if (!allPassed) {
    process.exit(1);
  }
}

runMasterTestSuite().catch((err) => {
  console.error("Fatal Test Suite Error:", err);
  process.exit(1);
});
