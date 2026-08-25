# Contributing to BrowserPilot 🚀

Thank you for your interest in contributing to BrowserPilot! We welcome contributions, improvements, bug reports, and ideas from the developer community.

---

## 🌿 Branching Strategy & Contribution Rules

To maintain production stability:

1. **Do NOT push directly to `main`**:
   - The `main` branch is protected and reserved for verified, production releases.
2. **Use the `develop` branch or feature branches for Pull Requests**:
   - Create all pull requests targeting the **`develop`** branch (or designated feature branch).
   - Branch naming convention:
     - `feat/<feature-name>` (e.g. `feat/playwright-stealth-mode`)
     - `fix/<bug-description>` (e.g. `fix/interaction-guard-timeout`)
     - `docs/<documentation-update>` (e.g. `docs/architecture-update`)
     - `refactor/<refactor-scope>`

---

## 🛠️ Local Development Setup

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/<your-username>/browserpilot.git
   cd browserpilot
   git checkout -b feat/your-feature develop
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Add your GEMINI_API_KEY
   ```

4. **Initialize Database**:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. **Start Dev Server**:
   ```bash
   npm run dev
   ```

---

## 🧪 Quality Gates & Pre-PR Checklist

Before opening a pull request, ensure all automated quality gates pass:

```bash
# 1. TypeScript Typechecking (0 errors)
npm run typecheck

# 2. ESLint (0 errors)
npm run lint

# 3. Full Automated Test Suite (7/7 §36 test scenarios green)
npm test

# 4. Production Build Verification
npm run build
```

---

## 📋 Pull Request Process

1. Open your PR against the **`develop`** branch.
2. Fill out the interactive [Pull Request Template](.github/pull_request_template.md) detailing:
   - Type of change (New Feature, Bug Fix, Performance, Docs, Refactor)
   - Scope and motivation
   - Verification and testing steps
   - Breaking changes (if any)
3. Ensure CI checks pass.
4. Maintainers will review your PR and provide feedback.

---

## 📄 License
By contributing to BrowserPilot, you agree that your contributions will be licensed under the [Apache-2.0 License](LICENSE).
