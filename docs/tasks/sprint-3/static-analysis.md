---
title: Full-Stack Static Analysis, Linting, Code Coverage Thresholds, and Pre-Commit Hooks
sprint: 3
estimate_hours: 2
---

# Full-Stack Static Analysis, Linting, Code Coverage Thresholds, and Pre-Commit Hooks

## Description

The smart scheduling application is a heterogeneous multi-package monorepo spanning two distinct software ecosystems: a TypeScript frontend/backend/shared workspace (`client` in React/Vite, `server` in Express/SQLite, and `shared` Zod schemas) and a Python agent service (`agent_service` in Django/LangChain). Prior to this task, the repository suffered from severe quality and static analysis blind spots:
1. The Python agent service had zero linting, zero formatting, zero static type checking, and zero test coverage measurement.
2. The TypeScript ESLint configuration had minimal rules and lacked React Hooks linting (`eslint-plugin-react-hooks`), allowing missing dependency and render loop bugs in `client/`.
3. Test coverage was not enforced in CI or tracked with thresholds, allowing regressions to go unnoticed.
4. There were no tools detecting dead code, orphaned dependencies, or copy-pasted code duplication across workspaces.
5. There were no local git pre-commit hooks, permitting unformatted or non-compliant code to be committed.

This task implements a unified, full-stack static analysis, linting, formatting, code coverage threshold (70%), and git pre-commit hook toolchain across the entire repository.

## Specs

The static analysis and code quality infrastructure consists of:
1. **Python Toolchain (`agent_service/`)**:
   - `Ruff`: Ultra-fast Python linter, code formatter, and import organizer configured via `agent_service/pyproject.toml`.
   - `mypy`: Static type checker configured for Python 3.11 with Django/LangChain typing allowances.
   - `pytest-cov`: Pytest coverage runner configured with a strict `fail_under = 70` threshold.
   - `scripts/run-agent-tool.js`: Cross-platform Node.js launcher that resolves Python virtualenv executables across Windows (`.venv/Scripts/`) and POSIX (`.venv/bin/`).
2. **TypeScript & React Linting**:
   - `eslint-plugin-react-hooks`: Configured in `eslint.config.js` targeting `client/**/*.{ts,tsx}` to enforce `rules-of-hooks` (error) and `exhaustive-deps` (warning) without breaking existing workspace rules.
3. **Dead Code & Duplication Detection**:
   - `knip`: Monorepo-aware dead code analyzer configured in `knip.json` to verify entry points, workspaces, and detect orphaned packages or unused exports.
   - `jscpd`: Code duplication scanner configured in `.jscpd.json` with token limits and test directory exclusions to keep code duplication below 10%.
4. **Coverage Threshold Enforcement (70% Baseline)**:
   - Configured `thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 }` in `client/vitest.config.ts`, `server/vitest.config.ts`, and `shared/vitest.config.ts`.
   - Configured `fail_under = 70` in `agent_service/pyproject.toml`.
5. **Git Pre-Commit Hooks (Husky + lint-staged)**:
   - Initialized Husky in `.husky/pre-commit` to execute `npx lint-staged`, `npm run check:deadcode`, and `npm run check:duplicates` before every commit.
   - Configured `lint-staged` in root `package.json` to automatically run Prettier and ESLint fix on staged TypeScript/JSON files, and Ruff format and fix on staged Python files.
6. **Unified Root CLI Scripts**:
   - `npm run lint:all`: Runs ESLint on TS and Ruff on Python.
   - `npm run typecheck:all`: Runs `tsc --noEmit` across TS workspaces and `mypy` on Python.
   - `npm run format:check`: Checks formatting via Prettier.
   - `npm run check:deadcode`: Executes Knip.
   - `npm run check:duplicates`: Executes jscpd.
   - `npm run test:coverage`: Executes Vitest across workspaces with coverage thresholds.
   - `npm run test:coverage:agent`: Executes Pytest with coverage thresholds.
7. **CI/CD Pipeline Integration**:
   - Updated `.github/workflows/ci.yml` on Node 22.x and 24.x to execute all linting, formatting, typechecking, static analysis, and test coverage suites.

## Requirements

- Python linter and formatter must use Ruff with Python 3.11 target.
- Python type checker must use mypy with zero unresolved type errors.
- React components and hooks in `client/` must conform to React Hooks rules.
- Test coverage across all modules (`client`, `server`, `shared`, `agent_service`) must meet or exceed 70%.
- Pre-commit hook must intercept `git commit` locally and block invalid code from entering history.
- All commands must be cross-platform compatible and execute identically in Windows PowerShell and Ubuntu GitHub Actions runners.
- Existing business logic and green test suites must not be broken or degraded.

## Acceptance criteria

- `npm run lint:all` exits with code 0 (both TypeScript ESLint and Python Ruff pass).
- `npm run format:check` exits with code 0 (all TS, TSX, and JSON files match Prettier style).
- `npm run typecheck:all` exits with code 0 (`tsc` passes on client, server, shared; `mypy` passes on agent).
- `npm run check:deadcode` exits with code 0 (Knip finds zero dead dependencies or unlisted binaries).
- `npm run check:duplicates` exits with code 0 (jscpd reports duplication below threshold, currently 1.24%).
- `npm run test:coverage` exits with code 0 (shared at 100%, client at 86.6%, server at 87.2%, all meeting 70% threshold).
- `npm run test:coverage:agent` exits with code 0 (27 passing tests, achieving 75.97% coverage, exceeding 70% threshold).
- `.husky/pre-commit` and `lint-staged` execute successfully on staged files upon running `git commit`.
- GitHub Actions CI workflow in `.github/workflows/ci.yml` runs the complete verification suite and passes.

## Tests

The automated test suites in the pull request verifying system behavior and coverage:
- `shared/tests/schemas.test.ts`: 65 passing schema validation tests (100% coverage).
- `client/tests/`: 103 passing unit and integration tests across Zustand stores, modals, and services (86.6% coverage).
- `server/tests/static-analysis.test.ts`: 9 passing tests covering all acceptance criteria AC1-AC9.
- `server/tests/`: 214 passing unit and API contract tests across routes, database queries, and scheduling algorithms (87.2% coverage).
- `agent_service/tests/test_agent_api.py`: 27 passing tests covering prompt building, DAG solver, and agent tools (75.97% coverage).
- `agent_service/tests/test_static_analysis.py`: 3 passing tests covering Python configuration and coverage thresholds.
