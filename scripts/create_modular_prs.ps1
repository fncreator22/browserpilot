# PowerShell script to execute modular PRs sequentially
$ErrorActionPreference = "Stop"

$prs = @(
    @{
        Branch = "feat/v3-ui-prototype-badge"
        Files = @("components/ui/prototype-badge.tsx")
        Message = "feat(ui): add prototype badge component for preview indicators"
        Title = "feat(ui): add prototype badge component for preview indicators"
        Body = "Introduces reusable PrototypeBadge indicator component with subtle Navy Ink border styling."
    },
    @{
        Branch = "feat/v3-ui-company-avatar"
        Files = @("components/ui/company-avatar.tsx", "lib/companies/companyLogo.ts")
        Message = "feat(ui): add company avatar with Google favicon and initials fallback"
        Title = "feat(ui): add company avatar with Google favicon and initials fallback"
        Body = "Renders circular company avatar with Google Favicon resolution and dynamic uppercase initials fallback."
    },
    @{
        Branch = "feat/v3-utils-toast-debounce"
        Files = @("lib/utils/toastDebounce.ts")
        Message = "feat(utils): add deduplicated singleton toast helper with debounce"
        Title = "feat(utils): add deduplicated singleton toast helper with debounce"
        Body = "Adds showDeduplicatedCancelToast with singleton toast ID and 2500ms debounce gate to eliminate spam."
    },
    @{
        Branch = "feat/v3-billing-currency-formatter"
        Files = @("lib/billing/currency.ts")
        Message = "feat(billing): add multi-currency exchange rate and price formatting utility"
        Title = "feat(billing): add multi-currency exchange rate and price formatting utility"
        Body = "Implements formatCurrency and getPlanPrice supporting USD and INR currency conversions."
    },
    @{
        Branch = "feat/v3-scraper-ats-directory"
        Files = @("lib/scraper/providers/atsCompanyDirectory.ts")
        Message = "feat(scraper): add comprehensive tech company ATS directory and resolvers"
        Title = "feat(scraper): add comprehensive tech company ATS directory and resolvers"
        Body = "Provides verified directory of hundreds of ATS targets with fuzzy company name resolution."
    },
    @{
        Branch = "feat/v3-scraper-intent-distiller"
        Files = @("lib/scraper/intentDistiller.ts")
        Message = "feat(scraper): add intent distillation and PII sanitization engine"
        Title = "feat(scraper): add intent distillation and PII sanitization engine"
        Body = "Strips PII (emails, phone numbers, SSNs, personal notes) from search queries and normalizes criteria."
    },
    @{
        Branch = "feat/v3-discovery-ephemeral-context"
        Files = @("lib/discovery/browser/ephemeralBrowserContext.ts")
        Message = "feat(discovery): add ephemeral Playwright browser context runner"
        Title = "feat(discovery): add ephemeral Playwright browser context runner"
        Body = "Executes sandboxed browser sessions with cookie injection and deterministic lifecycle cleanup."
    },
    @{
        Branch = "feat/v3-discovery-high-yield-search"
        Files = @("lib/discovery/search/highYieldSearchAugmentor.ts")
        Message = "feat(discovery): add high-yield search augmentor and recommendation fallback"
        Title = "feat(discovery): add high-yield search augmentor and recommendation fallback"
        Body = "Augments sparse search result sets with verified recommendations to prevent zero-result states."
    },
    @{
        Branch = "feat/v3-discovery-engine-core"
        Files = @("lib/discovery/search/discoveryEngine.ts")
        Message = "feat(discovery): add unified discovery engine with capability gating"
        Title = "feat(discovery): add unified discovery engine with capability gating"
        Body = "Integrates search planning, capability verification, and intent distillation across search providers."
    },
    @{
        Branch = "feat/v3-plugins-types"
        Files = @("lib/plugins/pluginTypes.ts")
        Message = "feat(plugins): add plugin types and direct ATS and prototype definitions"
        Title = "feat(plugins): add plugin types and direct ATS and prototype definitions"
        Body = "Defines PluginAuthType, PluginType, and metadata shapes for authenticated and 1-click ATS connectors."
    },
    @{
        Branch = "feat/v3-plugins-marketplace-service"
        Files = @("lib/plugins/pluginMarketplaceService.ts")
        Message = "feat(plugins): add multi-alias plugin marketplace service and connection lifecycle"
        Title = "feat(plugins): add multi-alias plugin marketplace service and connection lifecycle"
        Body = "Manages plugin catalog with multi-alias lookup, direct ATS connection, and session revocation."
    },
    @{
        Branch = "feat/v3-billing-plan-service"
        Files = @("lib/billing/planService.ts")
        Message = "feat(billing): add plan capability definitions and subscription service updates"
        Title = "feat(billing): add plan capability definitions and subscription service updates"
        Body = "Updates plan tiers with explicit capability mappings, quota definitions, and feature entitlement metadata."
    },
    @{
        Branch = "feat/v3-billing-entitlement-service"
        Files = @("lib/billing/entitlementService.ts")
        Message = "feat(billing): integrate capability gating into entitlement service"
        Title = "feat(billing): integrate capability gating into entitlement service"
        Body = "Adds canPerformAction checks for company targeting, high-frequency scans, and DeepReach intelligence."
    },
    @{
        Branch = "fix/v3-scheduler-next-scan-base-time"
        Files = @("lib/scraper/discoveryScheduler.ts")
        Message = "fix(scheduler): prevent drift-free nextScanAt baseTime from picking future timestamps"
        Title = "fix(scheduler): prevent drift-free nextScanAt baseTime from picking future timestamps"
        Body = "Ensures baseTime only references past due timestamps so interval calculations maintain exact cadences."
    },
    @{
        Branch = "fix/v3-discovery-watch-interval-recalc"
        Files = @("lib/scraper/autonomousDiscovery.ts", "lib/db/opportunities.ts")
        Message = "fix(discovery): fix discovery watch interval and nextScanAt recalculation"
        Title = "fix(discovery): fix discovery watch interval and nextScanAt recalculation"
        Body = "Guards explicit nextScanAt overrides during interval edits and prevents future timestamp drift."
    },
    @{
        Branch = "feat/v3-scraper-intent-parser"
        Files = @("lib/scraper/intentParser.ts")
        Message = "feat(scraper): enhance intent parser with colloquial word numerals and temporal rules"
        Title = "feat(scraper): enhance intent parser with colloquial word numerals and temporal rules"
        Body = "Supports natural language word numerals ('two or three days') and relaxes zero-target company constraints."
    },
    @{
        Branch = "feat/v3-scraper-ats-provider"
        Files = @("lib/scraper/providers/atsProvider.ts")
        Message = "feat(scraper): update direct ATS scraper provider with directory integration"
        Title = "feat(scraper): update direct ATS scraper provider with directory integration"
        Body = "Connects ATS scraper to dynamic directory resolver with company name normalization."
    },
    @{
        Branch = "feat/v3-worker-search-telemetry"
        Files = @("worker/searchWorker.ts")
        Message = "feat(worker): update search worker with token telemetry and PII distillation"
        Title = "feat(worker): update search worker with token telemetry and PII distillation"
        Body = "Records AI usage events in search worker and routes queries through intent distiller."
    },
    @{
        Branch = "feat/v3-api-auth-plugins-login"
        Files = @("app/api/auth/plugins/login/route.ts")
        Message = "feat(api): add authentic plugin popup authentication route"
        Title = "feat(api): add authentic plugin popup authentication route"
        Body = "Provides /api/auth/plugins/[id]/login route for authentic OAuth and session postMessage handshake."
    },
    @{
        Branch = "feat/v3-api-marketplace-route"
        Files = @("app/api/marketplace/route.ts")
        Message = "feat(api): add public job marketplace endpoint with faceted search"
        Title = "feat(api): add public job marketplace endpoint with faceted search"
        Body = "Implements GET /api/marketplace supporting category filtering, snippet date extraction, and pagination."
    },
    @{
        Branch = "feat/v3-api-plugins-routes"
        Files = @("app/api/plugins/route.ts", "app/api/plugins/[id]/route.ts")
        Message = "feat(api): update plugin management and disconnect endpoints"
        Title = "feat(api): update plugin management and disconnect endpoints"
        Body = "Updates plugin listing and status endpoints to return authentic connection status and prototype flags."
    },
    @{
        Branch = "feat/v3-api-account-billing"
        Files = @("app/api/account/billing/route.ts")
        Message = "feat(api): add billing plan capabilities and user quota tracking endpoints"
        Title = "feat(api): add billing plan capabilities and user quota tracking endpoints"
        Body = "Exposes plan capabilities and real-time AI quota tracking in GET /api/account/billing."
    },
    @{
        Branch = "feat/v3-api-account-profile"
        Files = @("app/api/account/profile/route.ts")
        Message = "feat(api): update user profile and career memory preferences endpoint"
        Title = "feat(api): update user profile and career memory preferences endpoint"
        Body = "Supports structured career memory fields (education, passout year, CGPA band) in profile route."
    },
    @{
        Branch = "feat/v3-api-discovery-watch"
        Files = @("app/api/discovery/watch/route.ts")
        Message = "feat(api): update discovery watch settings and company targeting endpoint"
        Title = "feat(api): update discovery watch settings and company targeting endpoint"
        Body = "Enforces subscription capability gating and validates custom company targeting in watch API."
    },
    @{
        Branch = "feat/v3-api-search-route"
        Files = @("app/api/search/route.ts")
        Message = "feat(api): enhance search route with email resolution and AI token telemetry"
        Title = "feat(api): enhance search route with email resolution and AI token telemetry"
        Body = "Resolves user by email when session ID is missing and records AI usage operations."
    },
    @{
        Branch = "feat/v3-profile-career-memory-form"
        Files = @("components/profile/career-memory-form.tsx")
        Message = "feat(profile): add structured career memory form with CGPA percentage calculations"
        Title = "feat(profile): add structured career memory form with CGPA percentage calculations"
        Body = "Builds CareerMemoryForm with target roles, locations, skills, degree, passing year, and CGPA calculations."
    },
    @{
        Branch = "feat/v3-settings-modal-unification"
        Files = @("components/settings/settings-modal.tsx", "components/connectors/connector-preferences-modal.tsx")
        Message = "feat(settings): unify profile and connectors tabs inside centralized settings modal"
        Title = "feat(settings): unify profile and connectors tabs inside centralized settings modal"
        Body = "Integrates CareerMemoryForm, ConnectorPreferencesPanel, billing sync, and currency selector."
    },
    @{
        Branch = "feat/v3-providers-ui-state"
        Files = @("components/providers/ui-state-provider.tsx")
        Message = "feat(providers): update UI state provider with multi-currency and modal tab controls"
        Title = "feat(providers): update UI state provider with multi-currency and modal tab controls"
        Body = "Adds currency switching, active tab persistence, and backward-compatible modal triggers."
    },
    @{
        Branch = "feat/v3-navigation-shell-declutter"
        Files = @("components/navigation/top-nav-island.tsx", "components/navigation/app-sidebar.tsx", "components/navigation/mobile-nav-pill.tsx")
        Message = "feat(navigation): declutter top navigation, app sidebar, and mobile nav dock"
        Title = "feat(navigation): declutter top navigation, app sidebar, and mobile nav dock"
        Body = "Purges redundant nav pills, relocates settings trigger, and standardizes mobile navigation dock."
    },
    @{
        Branch = "feat/v3-agent-task-input-cancel"
        Files = @("components/agent/task-input.tsx", "components/discovery/search-progress.tsx")
        Message = "feat(agent): update task input and search progress with debounce cancel toast"
        Title = "feat(agent): update task input and search progress with debounce cancel toast"
        Body = "Integrates singleton cancel toast debounce and disables input during active searches."
    },
    @{
        Branch = "feat/v3-discovery-bento-deck"
        Files = @("components/discovery/bento-discovery-deck.tsx", "components/discovery/personalization-indicator.tsx")
        Message = "feat(discovery): update bento discovery deck and personalization indicator"
        Title = "feat(discovery): update bento discovery deck and personalization indicator"
        Body = "Declutters discovery workspace headers and adds personalization status indicator."
    },
    @{
        Branch = "feat/v3-result-job-cards-slideover"
        Files = @("components/result/job-dossier-deck.tsx", "components/result/job-detail-slideover.tsx", "components/result/personnel-connect-drawer.tsx")
        Message = "feat(result): enhance job cards with circular avatars, snippet dates, and slide-over details"
        Title = "feat(result): enhance job cards with circular avatars, snippet dates, and slide-over details"
        Body = "Adds CompanyAvatar, clamped snippet descriptions, posting decay display, and details slideover."
    },
    @{
        Branch = "feat/v3-admin-observability"
        Files = @("components/admin/admin-observability-deck.tsx", "app/ops-sec-7f9c2d1b8e4a/connectors/page.tsx", "app/ops-sec-7f9c2d1b8e4a/layout.tsx")
        Message = "feat(admin): update admin observability deck and connectors management page"
        Title = "feat(admin): update admin observability deck and connectors management page"
        Body = "Connects real-time connector metrics and updates admin control plane layout."
    },
    @{
        Branch = "feat/v3-landing-pricing-scroll"
        Files = @("components/landing/pricing-overview-section.tsx", "components/landing/scroll-comparison-section.tsx")
        Message = "feat(landing): update landing pricing overview and scroll comparison sections"
        Title = "feat(landing): update landing pricing overview and scroll comparison sections"
        Body = "Supports multi-currency price rendering and responsive layout on marketing landing page."
    },
    @{
        Branch = "feat/v3-app-pages-workspace"
        Files = @("app/app/marketplace/page.tsx", "app/app/page.tsx", "app/app/history/page.tsx", "app/app/saved/page.tsx", "app/app/plans/page.tsx", "app/app/watch/page.tsx", "app/app/onboarding/page.tsx", "app/app/settings/memory/page.tsx")
        Message = "feat(pages): add marketplace browsing page and update app workspace pages"
        Title = "feat(pages): add marketplace browsing page and update app workspace pages"
        Body = "Adds dedicated /app/marketplace route and updates watch, plans, history, and memory pages."
    },
    @{
        Branch = "feat/v3-data-career-brain"
        Files = @("data/career-brain-taxonomy.json")
        Message = "feat(data): update career brain taxonomy dataset"
        Title = "feat(data): update career brain taxonomy dataset"
        Body = "Expands role taxonomy, core technical skills, and educational qualifications."
    },
    @{
        Branch = "test/v3-verification-suites"
        Files = @("tests/mobile_responsiveness_verification.test.ts", "tests/phase2-marketplace-and-plugins.test.ts", "tests/phase3-sandbox-and-distillation.test.ts", "tests/test_high_yield_search.ts", "tests/test_safe_search_error_and_plugins.ts", "tests/v3_ui_and_card_alignment_verification.ts")
        Message = "test(verification): add automated verification suites for responsiveness, plugins, and sandbox"
        Title = "test(verification): add automated verification suites for responsiveness, plugins, and sandbox"
        Body = "Adds unit and integration test suites covering mobile responsiveness, plugins, and sandbox isolation."
    },
    @{
        Branch = "docs/v3-platform-playbook"
        Files = @("docs/agentic-platform-playbook.md")
        Message = "docs(playbook): record architecture diary, verification record, and resilience plans"
        Title = "docs(playbook): record architecture diary, verification record, and resilience plans"
        Body = "Updates engineering playbook with dead code audit, defect remediations, and multi-PR rollback plans."
    }
)

Write-Host "Total PRs to process: $($prs.Count)"

foreach ($pr in $prs) {
    Write-Host "----------------------------------------------------"
    Write-Host "Processing PR: $($pr.Branch)"
    
    # 1. Checkout main and pull
    git checkout main
    git pull origin main
    
    # 2. Create feature branch
    git checkout -B $pr.Branch
    
    # 3. Checkout specified files from backup-wip-v3
    foreach ($file in $pr.Files) {
        git checkout backup-wip-v3 -- $file
    }
    
    # 4. Add and commit
    git add -A
    git commit -m $pr.Message
    
    # 5. Push to origin
    git push -u origin $pr.Branch -f
    
    # 6. Create PR
    $prUrl = gh pr create --title $pr.Title --body $pr.Body --base main --head $pr.Branch
    Write-Host "Created PR: $prUrl"
    
    # 7. Merge PR
    gh pr merge $pr.Branch --admin --merge --delete-branch
    Write-Host "Merged PR: $($pr.Branch)"
}

# Return to main and pull latest
git checkout main
git pull origin main
Write-Host "ALL $($prs.Count) PRS COMPLETED AND MERGED SUCCESSFULLY!"
