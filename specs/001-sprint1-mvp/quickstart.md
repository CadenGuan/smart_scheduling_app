# Quickstart Validation Guide: Sprint 1 MVP

This guide provides the prerequisites, environment setup, and verification scenarios to validate the Sprint 1 MVP end-to-end.

---

## 1. Prerequisites

* **Node.js**: `v20.0.0` or higher (`node -v`)
* **npm**: `v10.0.0` or higher (`npm -v`)
* **Operating System**: macOS, Linux, or Windows (WSL recommended on Windows)

---

## 2. Setup & Installation

From the repository root:

```bash
# 1. Install all monorepo dependencies (shared, client, server)
npm install

# 2. Configure environment variables
cp server/.env.example server/.env

# 3. Start both backend and frontend concurrently
npm run dev
```

The services will start at:
* **Frontend Client**: `http://localhost:5173`
* **Backend Express Server**: `http://localhost:3001` (proxied via Vite `/api`)

---

## 3. End-to-End Validation Scenarios

### Scenario 1: User Registration & Session Token Verification
1. Open `http://localhost:5173/login`.
2. Click **"Need an account? Sign Up"**.
3. Fill out the registration form:
   * Email: `slug@ucsc.edu`
   * Password: `Password123!`
   * Name: `Sammy Slug`
   * Standing: `Junior`
   * Major: `Computer Science B.S.`
4. Click **"Create Account"**.
5. **Expected Outcome**:
   * Network tab shows `POST /api/auth/register` returning `201 Created` with a signed JWT token.
   * Client automatically navigates to `http://localhost:5173/onboarding`.

---

### Scenario 2: Dual-Mode Google Authentication Fallback
1. Open `http://localhost:5173/login` in an Incognito window.
2. Click the **"Sign in with Google"** button.
3. If Google credentials are not yet configured in `.env`, the system activates the simulated Google login.
4. **Expected Outcome**:
   * Toast notification appears: *"Google Sign-In verified (Dev Mode)"*.
   * Session is established and client redirects to `/onboarding`.

---

### Scenario 3: Onboarding Multi-Step Wizard & Skip Logic
1. On `http://localhost:5173/onboarding` (Step 1: Profile), verify pre-filled name and standing. Click **"Next"**.
2. On Step 2 (Major Requirements), select `CSE 12` and `CSE 13S`. Click **"Next"**.
3. On Step 3 (General Education), select source as `UCSC` and check `CC` and `ER`.
4. On Step 4 (Quarter Planning), choose `Winter 2027` and set target credits to `15`.
5. On Step 5 (Preferences), click **"Skip this step"**.
6. Refresh the browser page (`F5`).
7. **Expected Outcome**:
   * Progress is restored to the exact step from SQLite (`server/data/app.db`).
   * Step 5 displays skipped status. Click **"Finish Onboarding"** to advance to `/dashboard`.

---

### Scenario 4: Split-View Dashboard, Calendar Preview & Hover Interactions
1. On `http://localhost:5173/dashboard`:
2. **Left Panel (38%)**: Verify the **SlugAgent Workspace** placeholder is rendered with prompt preview chips and the Sprint 2 integration banner.
3. **Right Panel (62%)**: Verify the weekly calendar grid displays:
   * `CSE 115A` (MWF 9:00-10:10) in **Triadic Teal (`#00B4DB`)**.
   * `MATH 21` (TuTh 13:15-14:50) in **Triadic Teal (`#00B4DB`)**.
   * `ART 10F` (MW 15:20-16:55) in **Triadic Magenta (`#FF6B6B`)**.
   * `Work Shift` (TuTh 10:00-12:00) in **Triadic Yellow (`#F9CA24`)**.
4. Hover over `CSE 115A`: Verify all Monday, Wednesday, and Friday meeting slots illuminate simultaneously.
5. Click `CSE 115A`: Verify course details modal opens with instructor and room details.

---

### Scenario 5: Navbar Preferences Drawer
1. In the top navigation bar, locate the **"✏️ Edit Preferences"** button.
2. Click the button.
3. **Expected Outcome**:
   * A slide-over modal opens without unmounting or reloading the calendar view.
   * Edit target credits or add a break window and click **"Save Changes"**.
   * Network tab confirms `PUT /api/users/:id` executes successfully and updates state.

---

## 4. Automated Test Suite Execution

Run all test suites across the monorepo:

```bash
# Run backend API contract and auth tests
npm run test --workspace=server

# Run frontend React Class component tests
npm run test --workspace=client

# Run end-to-end typecheck
npm run typecheck --workspaces
```

