# Golden Rules for Test-Driven Specification (Test Writer's Recipe)

This document is your step-by-step cookbook for writing automated test suites as a dedicated Test Engineer in CSE 115A. When you are writing tests *before* the implementation team writes the code, your tests serve as the **living executable specification**.

---

## The Recipe (5-Step Workflow)

Follow this recipe for every User Story assigned in the Sprint.

```
[User Story & Priority]
          │
          ▼
[1. Deconstruct Story into Gherkin (Given-When-Then)]
          │
          ▼
[2. Locate Target Architecture Layer (Shared / Server / Client)]
          │
          ▼
[3. Formulate Input/Output Contract]
          │
          ▼
[4. Write the AAA Test (Arrange - Act - Assert)]
          │
          ▼
[5. Gate in Vitest (.todo / .fails) to Preserve CI]
```

---

### Step 1: Deconstruct User Story into Test Scenarios
Break every user story into three scenario types using **Given-When-Then**:
1. **Happy Path:** The intended success case with valid input.
2. **Edge Cases:** Boundary values (empty strings, maximum length, extreme dates, zero credits).
3. **Unhappy/Failure Paths:** Malformed payloads, unauthorized tokens, missing fields, conflicting states.

*Example (Sprint 2 - Context Memory):*
- **Given** a registered user who previously told the agent "I prefer morning classes"
- **When** the user sends a new message "What courses should I take next quarter?"
- **Then** the response recommendations should prioritize courses before 12:00 PM and acknowledge their preference.

---

### Step 2: Identify the Target Component & Test Location
Map the scenario to the right layer based on [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md):

| Layer | Responsibility | File Location | Tools |
| :--- | :--- | :--- | :--- |
| **Shared (`shared/`)** | Data schemas, payload validation, Zod types | `shared/tests/*.test.ts` | Zod, Vitest |
| **Server DB (`server/`)** | Queries, persistence, context storage (C6) | `server/tests/*.db.test.ts` | In-memory SQLite, Vitest |
| **Server API (`server/`)** | HTTP status codes, auth headers, route contracts | `server/tests/*.contract.test.ts` | Supertest, Vitest |
| **Client Store (`client/`)** | Zustand state, local storage, action creators | `client/tests/*.store.test.ts` | Vitest |
| **Client UI (`client/`)** | Render states, button triggers, form inputs | `client/tests/*.ui.test.ts` | Testing Library, Vitest |

---

### Step 3: Define the Data Contract
Before testing behavior, define the exact JSON request and response shapes. Use the schemas in `shared/src/` as your single source of truth:
- What headers are required? (`Authorization: Bearer <token>`)
- What is the HTTP Method and Route? (`POST /api/agent/chat`)
- What does the exact response envelope look like?
  ```typescript
  {
    success: boolean,
    data?: T,
    error?: string
  }
  ```

---

### Step 4: Write the AAA Test Block
Structure every single test using the **AAA (Arrange, Act, Assert)** structure:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Feature: Agent Context Persistence [Sprint 2 - Story #8]', () => {
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    // 1. ARRANGE: Set up fixtures, accounts, and preconditions
    const userRes = await request(app).post('/api/auth/register').send({
      email: `test-${Date.now()}@ucsc.edu`,
      password: 'Password123!',
      name: 'Sammy Slug',
      standing: 'Junior',
      major: 'Computer Science B.S.',
    });
    authToken = userRes.body.data.token;
    userId = userRes.body.data.user.userId;
  });

  it('preserves user preference across distinct conversation turns', async () => {
    // 2. ACT: Execute the action under test
    await request(app)
      .post('/api/agent/message')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: 'I cannot take classes on Fridays' });

    const secondTurnRes = await request(app)
      .post('/api/agent/schedule-query')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ query: 'Show me my schedule options' });

    // 3. ASSERT: Verify the expected outcome
    expect(secondTurnRes.status).toBe(200);
    expect(secondTurnRes.body.success).toBe(true);
    expect(secondTurnRes.body.data.schedule.fridayCourses).toHaveLength(0);
  });
});
```

---

### Step 5: Keep the CI Pipeline Green (Crucial for Red-Phase Testing)
Because you write tests before the developers implement the features, raw tests will fail and break the GitHub Actions CI pipeline. 

Use Vitest's built-in test modifiers to document expectations without breaking CI:

1. **`it.todo('description')`**
   - For planned tests where the contract is still being drafted.
   - Shows up in test reports as pending/todo, but passes CI.

2. **`it.fails('description', async () => { ... })`**
   - For tests that are fully written and **expected to fail** because the feature is not implemented yet.
   - Vitest passes in CI as long as the test fails. When the implementation team finishes the code, Vitest will alert them to flip it back to a standard `it(...)`.

3. **Dedicated Feature Branches:**
   - Keep pending red tests on a branch like `spec/sprint2-tests`.
   - Open a PR against `main`. The PR checks will show red, providing a clear dashboard of remaining work for developers.

---

## The 7 Golden Rules

1. **Test One Thing Per Test:** One logical assertion per `it()` block. If a test fails, you should immediately know what broke without reading the stack trace.
2. **Never Test Implementation Details:** Don't test private variables or function names. Test API routes, inputs, outputs, and returned status codes.
3. **Deterministic & Isolated:** Tests must never depend on each other or run in a specific order. Always clear mock stores and databases in `beforeEach()`.
4. **Name Tests Like Specifications:**
   - Good: `it('rejects schedule generation when student has unfulfilled prerequisites')`
   - Bad: `it('testPrereqs()')`
5. **No Hardcoded Dates or Random Tokens:** Always compute timestamps dynamically (e.g. `Date.now()`) or use mock timers to avoid flaky tests next month.
6. **Cover Both Boundaries (Happy vs Boundary):** For every success test, write at least one boundary test (e.g., maximum credits) and one failure test (e.g., unauthorized request).
7. **The Test is the Contract:** If an engineer asks "how should this API respond?", point them to your test file. The test is the source of truth.

