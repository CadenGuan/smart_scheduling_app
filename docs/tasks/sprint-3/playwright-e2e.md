---
id: playwright-e2e
story: 6
assignee: Abeetzer
sprint: 3
estimate_hours: 4
---

# Playwright End-to-End Testing & CodeGen Integration

## Description

The smart scheduling application features an interactive client interface built with React, Vite, Tailwind CSS, and FullCalendar. As the frontend evolves with complex UI components (such as course catalog search, visual schedule calendars, onboarding steps, and conflict alerts), reliable end-to-end (E2E) browser testing and rapid test authoring tools are critical.

Previously, the test suites consisted exclusively of unit and integration tests executed in jsdom / Node environments via Vitest. While effective for unit isolation, jsdom does not execute real browser rendering, layout calculations, network interception, or true user interaction events. Furthermore, manual test scripting for intricate user journeys is time-consuming.

This task introduces Playwright into the monorepo alongside Playwright CodeGen (`playwright codegen`), enabling developers to interactively record browser actions into reproducible test scripts, run headless smoke test suites locally and in CI, and inspect failures using interactive UI mode and visual HTML reports.

## Specs

The Playwright testing and CodeGen toolchain consists of:
1. **Playwright Core Dependency**:
   - Install `@playwright/test` at root `devDependencies`.
2. **Root Configuration (`playwright.config.ts`)**:
   - Configured with `testDir: './e2e'`.
   - Desktop Chromium browser target for fast, deterministic runs.
   - Built-in `webServer` targeting `http://localhost:5173`, automatically launching `npm run dev --workspace=client` (or reusing existing running instance locally).
   - Trace, screenshot, and video capture configured on first retry / failure.
3. **Dedicated NPM Scripts**:
   - `test:e2e`: Runs headless Playwright test suite (`playwright test`).
   - `test:e2e:ui`: Launches Playwright interactive UI test runner (`playwright test --ui`).
   - `test:e2e:codegen`: Launches Playwright CodeGen pre-targeted at the development application URL `http://localhost:5173` (`playwright codegen http://localhost:5173`).
   - `test:e2e:report`: Opens the interactive HTML test report (`playwright show-report`).
4. **Smoke Test Suite (`e2e/playwright-e2e.spec.ts`)**:
   - Validates that the application boots and routes to `/login`.
   - Verifies key UI elements, headings, and authentication inputs render correctly.
   - Tests navigation between login and sign-up states.
   - Each test is prefixed with `playwright-e2e:` per course testing protocol.
5. **Continuous Integration (`.github/workflows/ci.yml`)**:
   - Adds a dedicated parallel GitHub Actions job `e2e` that sets up Node.js, installs dependencies, provisions the Chromium browser (`npx playwright install --with-deps chromium`), and runs `npm run test:e2e`.

## Requirements

1. **Root Integration**: Playwright and its scripts must reside at the root level so that developers can record and test across workspaces from a single command center.
2. **CodeGen Workflow**: Running `npm run test:e2e:codegen` must start the Playwright inspector and browser targeted at `http://localhost:5173` without requiring manual URL entry.
3. **Prefix Compliance**: All Playwright test titles must begin with `playwright-e2e:` to comply with the course task test verification rules.
4. **CI Isolation**: E2E tests must run in their own dedicated CI job in GitHub Actions so that browser testing does not block or slow down fast static analysis and unit test matrices.
5. **Quality Checks**: The new configuration, scripts, and tests must satisfy all repo quality checks (`lint:all`, `format:check`, `typecheck:all`, `check:deadcode`, `check:duplicates`).

## Acceptance criteria

- **AC1**: Root `package.json` contains `@playwright/test` in `devDependencies` and provides `test:e2e`, `test:e2e:ui`, `test:e2e:codegen`, and `test:e2e:report` scripts.
- **AC2**: Root `playwright.config.ts` is configured with `testDir: './e2e'`, auto-starts/reuses the web server on `http://localhost:5173`, and targets Chromium.
- **AC3**: Running `npm run test:e2e:codegen` launches the Playwright CodeGen generator targeting `http://localhost:5173`.
- **AC4**: `e2e/playwright-e2e.spec.ts` contains browser smoke tests prefixed with `playwright-e2e:`, verifying application loading, branding, and auth input controls.
- **AC5**: `.github/workflows/ci.yml` includes a dedicated `e2e` job that installs Chromium with OS dependencies and executes `npm run test:e2e`.
- **AC6**: All repo linters, formatters, typecheckers, knip dead code analyzer, and jscpd duplicate scanners pass cleanly with 0 errors.

## Tests

- `e2e/playwright-e2e.spec.ts`: End-to-end browser smoke test suite verifying page load, branding, login form controls, and sign-up toggle interaction.
