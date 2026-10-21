# Research & Architecture Decisions: Sprint 1 MVP

This document records the technology evaluations, architectural patterns, and implementation best practices for the Sprint 1 MVP.

---

## 1. React Class Components with React Router v6

### Decision
Implement a custom `withRouter` Higher-Order Component (HOC) that wraps typed React Class components, injecting `navigate`, `location`, and `params` as props. Use an abstract `BaseComponent<P, S>` parent class that provides safe state updates and unmount guards.

### Rationale
* **Academic/Course Requirement**: The project specification mandates React Class components with clear inheritance relationships, parent state definitions, and props.
* **React Router Compatibility**: React Router v6 exclusively exports hooks (`useNavigate`, `useLocation`) which cannot be called inside Class component lifecycle methods or `render()`.
* **Memory Safety**: `BaseComponent` maintains an internal `_isMounted` boolean flag and a `safeSetState()` method to prevent `Warning: Can't perform a React state update on an unmounted component` during asynchronous API calls.

### Alternatives Considered
* *Functional Components with Hooks*: Standard modern React pattern, but does not satisfy the explicit OOP Class component inheritance requirement.
* *Pure State-Driven View Switching (`this.state.activeView`)*: Avoids React Router entirely, but breaks browser back/forward buttons, deep linking, and bookmarking of `/login`, `/onboarding`, and `/dashboard`.

---

## 2. Local-First SQLite Database Engine (`better-sqlite3`)

### Decision
Use `better-sqlite3` initialized with `PRAGMA journal_mode = WAL` (Write-Ahead Logging) and `PRAGMA foreign_keys = ON` inside a single database file (`server/data/app.db`).

### Rationale
* **Performance & Local Execution**: `better-sqlite3` executes SQLite statements synchronously in-process via C++ V8 bindings. Unlike asynchronous drivers, there is no IPC overhead or event-loop scheduling latency for local disk operations.
* **Concurrency**: Enabling Write-Ahead Logging (`WAL`) allows concurrent reader connections while a write transaction is executing, preventing database locks during auto-saves.
* **Relational Integrity**: Foreign key constraints automatically cascade deletions (e.g. deleting a user purges their sessions and onboarding progress).

### Alternatives Considered
* *`sqlite3` (node-sqlite3)*: Uses Node.js asynchronous callbacks, leading to nested callback structures and callback hell.
* *Prisma ORM*: Introduces heavy binary engines and schema generation overhead that adds unnecessary complexity for a local desktop project.
* *Per-User Database Files*: Creating an isolated `.db` file per student creates an authentication paradox at login (cannot identify which database to query prior to credentials verification).

---

## 3. Cryptographic Tokenization & Session Integrity

### Decision
Issue HMAC-SHA256 signed JSON Web Tokens (`jsonwebtoken`) on login/registration, transmitted via the `Authorization: Bearer <token>` HTTP header.

### Rationale
* **Tamper-Proof Verification**: The signature ensures that the user ID, email, and expiration timestamp cannot be modified by the client or third parties.
* **Stateless Verification**: Protected routes verify the token cryptographically with negligible CPU overhead, while the `sessions` table in SQLite retains the revocation capability on logout.

### Alternatives Considered
* *Opaque Random Session IDs*: Requires a database query on every single HTTP request.
* *Unsigned Cookies / Tokens*: High security risk with no data integrity guarantees.

---

## 4. Dual-Mode Google Authentication

### Decision
Support real Google OAuth 2.0 via Google Identity Services when `GOOGLE_CLIENT_ID` is defined in `.env`, while supporting an instant "Mock Google Sign-In" fallback during development and grading.

### Rationale
* **Zero Dependency for Evaluators**: Evaluators and team members can clone the repository, run `npm run dev`, and immediately test the entire Google login and calendar authorization flow without having to configure a personal Google Cloud Console project.
* **Production Parity**: The database schema and frontend store handle both real and simulated tokens identically.

### Alternatives Considered
* *Strict Cloud-Only*: Blocks teammates and automated CI test pipelines until Google Cloud project keys are distributed.
* *Mock-Only*: Requires reworking the authentication service when integrating real Google Calendar APIs in Sprint 2.

---

## 5. Triadic Color System & Accessibility

### Decision
Configure Tailwind CSS and root CSS variables with the **Triadic Palette**:
* **Teal (`#00B4DB`)**: Primary actions, navbar highlights, major lecture courses.
* **Magenta (`#FF6B6B`)**: Accent buttons, GE elective courses, error alerts.
* **Yellow (`#F9CA24`)**: Active step indicators, warning badges, Google Calendar busy blocks.

### Rationale
* Ensures strict compliance with user visual styling requirements.
* Provides crisp visual contrast on calendar time slots with clear distinctions between course categories.

