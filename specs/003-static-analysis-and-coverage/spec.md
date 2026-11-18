# Spec: Full-Stack Static Analysis, Linting, Code Coverage, and Git Hooks

Status: ready-for-agent
Effort: static-analysis-and-coverage
Created: 2026-11-17

## Problem Statement

The smart scheduling repository spans multiple workspaces across two language ecosystems: a TypeScript monorepo (frontend React client, backend Express server, and shared data schemas) and a Python agent service (Django + LangChain). Currently, the codebase suffers from significant static analysis gaps:
1. **Python Blindspots:** The Python service (`agent_service/`) has zero linting, zero formatting, zero static type checking, and zero test coverage tracking configured.
2. **TypeScript & React Gaps:** The root ESLint setup uses only minimal rules without React Hooks linting, permitting subtle hook dependency and render cycle bugs in `client/`.
3. **Ungated Test Coverage:** Although `@vitest/coverage-v8` is installed, coverage is not measured in CI, has no baseline thresholds (lines/branches), and does not cover the Python test suite.
4. **Dead Code & Duplication Accumulation:** There is no automated detection of dead code, orphaned exports, unused dependencies, or copy-pasted code blocks across workspaces.
5. **No Local Guardrails:** Developers can commit code that violates formatting, type checks, or quality standards because there are no pre-commit git hooks.

Engineers need a fast, unified, cross-platform static analysis and test coverage toolchain that runs locally before commits and is strictly enforced in CI.

## Solution

1. **Python Static Analysis & Coverage:** Integrate `Ruff` (linting, formatting, import sorting), `mypy` (static type checking), and `pytest-cov` into `agent_service/`, managed by `pyproject.toml` and cross-platform npm delegate scripts.
2. **React Hooks Linting:** Extend ESLint with `eslint-plugin-react-hooks` on `client/` to enforce React hook rules without disrupting existing workspace configurations.
3. **Dead Code & Duplication Detection:** Add `knip` (identifying dead exports, unused files, and extraneous dependencies) and `jscpd` (detecting duplicate code across client, server, and agent services).
4. **Coverage Enforcement (70-75% Baseline):** Configure minimum coverage thresholds (lines, functions, branches, statements) in `vitest.config.ts` for `server`, `client`, and `shared`, and in pytest configuration for `agent_service/`. Require coverage validation in CI.
5. **Automated Local Gating (Husky + lint-staged):** Install and configure Husky and lint-staged so that committing automatically formats and lints staged files (Prettier + ESLint for TS, Ruff for Python) and executes `knip` and `jscpd`.
6. **Unified CI/CD Pipeline:** Update `.github/workflows/ci.yml` to execute all linters, typecheckers, static analyzers, and coverage suites.

## User Stories

1. As a developer, I want `eslint-plugin-react-hooks` enabled on all React files in the client workspace, so that missing hook dependencies and invalid hook calls are flagged immediately.
2. As a developer, I want Python code in `agent_service` automatically linted and formatted with Ruff, so that Python style, imports, and syntax issues are caught with sub-second feedback.
3. As a developer, I want `mypy` to statically type-check the Python agent service, so that type errors and mismatched function arguments are identified prior to runtime.
4. As a developer, I want `knip` configured across the monorepo, so that dead files, orphaned exports, and unneeded npm dependencies are flagged before they accumulate.
5. As a developer, I want `jscpd` configured to scan client, server, shared, and agent code, so that copy-pasted blocks and duplicate logic are surfaced early.
6. As a developer, I want a single unified `npm run lint:all` command, so that I can lint both the TypeScript monorepo and the Python agent service in one step.
7. As a developer, I want a single unified `npm run typecheck:all` command, so that I can verify TypeScript types and Python mypy signatures in one step.
8. As a developer, I want `npm run test:coverage` to compute coverage across all TypeScript workspaces and fail if coverage drops below the 70% threshold.
9. As a developer, I want `npm run test:coverage:agent` to compute coverage across the Django agent service and fail if coverage drops below the 70% threshold.
10. As a developer, I want cross-platform npm runner scripts that automatically locate the Python virtual environment on Windows (`Scripts`) or macOS/Linux (`bin`), so that commands work identically across OS environments without manual path tweaking.
11. As a developer, I want Husky pre-commit hooks installed, so that invalid or unformatted code is blocked from being committed locally.
12. As a developer, I want `lint-staged` to format and lint only staged files during commit, so that pre-commit checks remain fast and do not stall git workflows.
13. As a developer, I want `knip` and `jscpd` executed as pre-commit checks, so that commits introducing dead code or duplicate blocks are prevented locally.
14. As a team lead, I want GitHub Actions CI to execute all linting, formatting, type-checking, dead code, duplication, and coverage suites on pull requests, so that regressions cannot be merged to `main`.
15. As a developer, I want existing ESLint rules for TypeScript to remain non-breaking and functional, so that adding hook linting does not trigger mass churn across working server and shared code.
16. As a developer, I want coverage reports generated in standard terminal summary formats and local HTML/lcov outputs, so that I can inspect untested lines and branches directly.
17. As an open-source contributor, I want `npm run prepare` to automatically initialize Husky hooks upon running `npm install`, so that onboarding requires no extra manual hook configuration.
18. As a developer, I want clear console output and actionable file/line pointers when any linter or static analyzer fails, so that I can resolve violations quickly.

## Implementation Decisions

### Modules Built and Modified
- **Root Project Management (`package.json`)**:
  - Add devDependencies: `husky`, `lint-staged`, `knip`, `jscpd`, `eslint-plugin-react-hooks`.
  - Add npm scripts: `lint:all`, `lint:agent`, `lint:agent:fix`, `format:agent`, `typecheck:all`, `typecheck:agent`, `check:deadcode`, `check:duplicates`, `test:coverage:agent`, `prepare`.
  - Add `lint-staged` configuration block targeting `.ts`, `.tsx`, `.json`, and `.py` files.
- **Python Agent Environment (`agent_service/`)**:
  - Update `agent_service/requirements.txt` to include `ruff`, `mypy`, and `pytest-cov`.
  - Introduce `agent_service/pyproject.toml` to configure:
    - Ruff target version (Python 3.11), line length (100), and rulesets (E, F, I for imports).
    - Mypy settings with appropriate Django/LangChain typing allowances.
    - Pytest coverage configuration targeting `agent` and `agent_api` packages with a 70% minimum threshold.
- **Cross-Platform Script Runner (`scripts/run-agent-tool.js`)**:
  - Create a Node.js utility script that discovers the virtual environment python/bin directory (`agent_service/.venv/Scripts` on Windows vs `agent_service/.venv/bin` on POSIX) and executes the requested tool (`ruff`, `mypy`, `pytest`) transparently.
- **ESLint Configuration (`eslint.config.js`)**:
  - Import and mount `eslint-plugin-react-hooks` specifically on files matching `client/**/*.{ts,tsx}`, enforcing `rules-of-hooks` as an error and `exhaustive-deps` as a warning.
  - Preserve all existing ignore blocks and TypeScript parser options.
- **Vitest Workspace Configurations**:
  - Update `server/vitest.config.ts`, `client/vitest.config.ts`, and `shared/vitest.config.ts` to include `coverage.thresholds` enforcing 70% lines, functions, and branches.
- **Static Analysis Specifications**:
  - Create `knip.json` configuring the monorepo workspaces and entry points (`client/src/main.tsx`, `server/src/index.ts`, `shared/src/index.ts`).
  - Create `.jscpd.json` defining duplication thresholds, token limits, and ignored patterns (dist, coverage, mocks, migrations).
- **Git Hooks (`.husky/pre-commit`)**:
  - Initialize Husky structure with a `pre-commit` hook executing `npx lint-staged`, `npm run check:deadcode`, and `npm run check:duplicates`.
- **CI/CD Pipeline (`.github/workflows/ci.yml`)**:
  - Update `lint-and-test` job steps to run full linting (`npm run lint:all`), formatting checks (`npm run format:check`), typechecking (`npm run typecheck:all`), static analysis (`npm run check:deadcode`, `npm run check:duplicates`), and test coverage suites (`npm run test:coverage`, `npm run test:coverage:agent`).

## Testing Decisions

### What Makes a Good Test for Tooling & Static Analysis
- Static analysis and tooling validations should be tested via top-level execution verification commands (exit code 0 on compliant code, non-zero on simulated violations).
- Tests must be cross-platform (executing cleanly in Windows PowerShell and Ubuntu CI runners).
- Tests should assert external developer observable outcomes: lint failure flags incorrect code, coverage calculation halts builds below thresholds, and pre-commit hooks prevent non-compliant commits.

### Seams for Verification
- **Primary CLI Seam:** Running `npm run lint:all`, `npm run typecheck:all`, `npm run check:deadcode`, `npm run check:duplicates`, `npm run test:coverage`, and `npm run test:coverage:agent`.
- **Commit Seam:** Triggering `git commit` to verify Husky and `lint-staged` intercept staged files and execute formatters and static checks.
- **CI Seam:** GitHub Actions workflow execution in `.github/workflows/ci.yml` verifying that all checks run and pass on clean code.

## Out of Scope
- Rewriting existing application code or business logic in `server`, `client`, or `agent_service` to satisfy strict zero-`any` TypeScript types (minimal ESLint rules preserved).
- Adding full dependency vulnerability auditing (`npm audit`, `pip-audit`) or automated secret scanning (e.g. `gitleaks`), as opted out during planning.
- Enforcing 80%+ or 90%+ code coverage on legacy codebases immediately; target baseline is set at 70%.

## Further Notes
- The Python virtual environment is set up via `npm run setup:agent` prior to running agent static analysis commands.
- `knip` and `jscpd` configuration should account for monorepo workspace package boundaries to avoid false positives on inter-workspace imports (`shared` used in `server` and `client`).
