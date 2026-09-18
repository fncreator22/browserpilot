# Contributing to BrowserPilot

Thank you for your interest in contributing to BrowserPilot. This document outlines the contribution workflow, governance model, coding standards, and verification requirements for submitting code or documentation to this repository.

---

## Governance and Merge Restrictions

BrowserPilot maintains strict repository governance to protect production stability and enterprise security:

1. **Direct Pushes Prohibited**:
   - Pushes directly to the `main` branch are strictly prohibited and blocked by repository branch protection rules.
   - All code must enter the repository through Pull Requests (PRs).

2. **Admin-Only Merge Authority**:
   - Only repository administrators and core maintainers possess permissions to approve and merge Pull Requests.
   - External contributors cannot merge their own PRs. Even after all automated CI checks pass, a Pull Request cannot be merged without explicit administrator sign-off.

3. **Mandatory CI Checks**:
   - Every Pull Request must pass the automated CI pipeline (`npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`) before it is eligible for administrative review.

---

## Contribution Workflow

### Step 1: Fork and Clone
1. Fork the official repository [fncreator22/browserpilot](https://github.com/fncreator22/browserpilot) to your personal GitHub account.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/browserpilot.git
   cd browserpilot
   ```
3. Set the upstream remote:
   ```bash
   git remote add upstream https://github.com/fncreator22/browserpilot.git
   ```

### Step 2: Create a Feature Branch
Create a descriptive branch off `main`:
```bash
git checkout -b feat/your-feature-name
```

Follow standardized branch naming conventions:
- `feat/<scope>`: New feature or capability
- `fix/<scope>`: Bug fix or corrective patch
- `docs/<scope>`: Documentation updates or corrections
- `perf/<scope>`: Performance optimization
- `refactor/<scope>`: Code restructuring without functional behavior change
- `test/<scope>`: New tests or test fixture improvements

### Step 3: Local Environment Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure local environment variables:
   ```bash
   cp .env.example .env.local
   ```
3. Initialize the Prisma schema:
   ```bash
   npx prisma generate
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

### Step 4: Make Changes and Adhere to Standards
- Write clean, modular TypeScript with strict type checking enabled.
- Avoid loose `any` types; define explicit interfaces or schemas using Zod.
- Follow Next.js 16 App Router best practices, preserving server component boundaries and avoiding unnecessary client component directives.
- When creating UI components, ensure full keyboard accessibility and compatibility with reduced motion preferences.
- Do not introduce emojis in code comments, commit messages, or documentation.

### Step 5: Run Verification Gates
Before committing your work, run all quality gates locally:

```bash
# 1. TypeScript Static Analysis (must pass with 0 errors)
npm run typecheck

# 2. ESLint Validation (must pass with 0 errors)
npm run lint

# 3. Test Suite Execution (all unit and integration tests must pass)
npm test

# 4. Next.js Production Build (must compile cleanly)
npm run build
```

### Step 6: Commit Guidelines
BrowserPilot adheres to the Conventional Commits specification:

Format:
```text
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

Examples:
- `feat(discovery): add Ashby rate limit backoff handler`
- `fix(motion): prevent layout shift on command palette exit`
- `docs(readme): update deployment endpoints and architecture diagram`

Do not include emojis in commit messages.

### Step 7: Submit Pull Request
1. Push your branch to your personal fork:
   ```bash
   git push origin feat/your-feature-name
   ```
2. Open a Pull Request against `main` on the upstream repository.
3. Complete all sections of the [Pull Request Template](.github/pull_request_template.md).
4. Monitor the CI checks. If any check fails, address the issue promptly by pushing new commits to your branch.

---

## Review and Merge Lifecycle

1. **Automated Validation**: CI triggers upon PR submission. All automated tests and builds must be green.
2. **Peer and Maintainer Review**: An administrator will inspect the code for architectural alignment, security implications, and test coverage.
3. **Revisions**: If changes are requested, push additional commits to your branch.
4. **Administrative Merge**: Once approved, an administrator will squash and merge the PR into `main`.

---

## Reporting Security Vulnerabilities

Please do not disclose security vulnerabilities through public GitHub issues.

If you believe you have discovered a security flaw, send an email to the repository maintainers with:
- Detailed description of the vulnerability
- Steps or proof of concept to reproduce the issue
- Affected components or endpoints
- Potential impact assessment

The security team will acknowledge receipt within 48 hours and work with you to remediate the issue prior to public release.

---

## Code of Conduct

All contributors and maintainers are expected to maintain professional, constructive, and respectful collaboration across all project interactions, including issue discussions, code reviews, and communications.

---

## License

By contributing to BrowserPilot, you agree that your contributions will be licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.
