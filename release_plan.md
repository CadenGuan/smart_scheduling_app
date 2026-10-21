# Release Plan

**Product name:** Smart Scheduling App
**Revision number:** 2
**Revision date:** 10/20/2026

---

## High-Level Goals

The application is going to be an interactive agent-driven schedule generator where UCSC students can input their degree status and learning preferences to in turn receive appropriately planned, comprehensively detailed, and accurately timestamped calendars for the respective quarter that they can easily import into their calendar apps and follow. User dispositions will be recorded and modifiable for maximum flexibility. Their requests will be processed by the agent who will utilize defined tools to yield corroborated, user-oriented responses.

---

## User Story Allocation

*(number in front indicates priority: 1-low 2-preferrable 3-necessary 5-must 8-failure without)*

### Sprint 1

- **3** — As a user who lands on the page for the first time, I should be greeted with a questionnaire that asks introductory questions (e.g. name, major, graduation date etc.).
- **3** — As a planner of a schedule, I want to be able to preview the calendar in the software so that I know what I am getting.
- **5** — As an interactor with the UI, I want all the buttons to be functional.
- **2** — As a first-time user, I want to skip optional questions and come back to them later, so that I'm not forced to answer everything at once.
- **5** — As a user, I want to sign in with my Google account, so that I can authenticate easily and link my student account.
- **3** — As a user connecting with Google, I want to grant read-only access to my Google Calendar, so that my existing events and commitments can be imported as schedule constraints.

### Sprint 2

- **5** — As an interactor with the agent, I want coherent answers.
- **5** — As a first-time user, I want the agent to greet me and explain what it can do, so that I know how to use it.
- **8** — As a returning user, I want the agent to remember what I told it last time, so that I don't repeat myself.
- **3** — As a user who is unsure, I want the agent to explain why it made a recommendation, so that I can decide whether to trust it.

### Sprint 3

- **3** — As an interactor with the agent, I want justifiable answers.
- **5** — As a user who changes their mind, I want to update my preferences without restarting the conversation, so that the agent adjusts the plan accordingly.
- **3** — As a user who disagrees with a suggestion, I want to tell the agent "This is too much" and have it propose alternatives, so that the plan fits my actual capacity.
- **3** — As a student who is struggling, I want to drop a course and see the downstream impact, so that I can adjust without losing the whole plan.
- **2** — As a user with too many constraints, I want the agent to tell me the plan is infeasible, so that I can relax something.
- **5** — As a student who is behind on prerequisites, I want to know the shortest path to a target course, so that I can plan realistically.

### Sprint 4

*(Note: In adherence to Agile principles, UI styling, responsive design, and visual polish are integrated continuously into each sprint's Definition of Done rather than isolated into a standalone phase).*

- **5** — As a user ready to use my generated schedule, I want to export my plan into a standard calendar format (.ics) so that I can import it directly into my preferred calendar application (e.g. Google Calendar, Apple Calendar).
- **3** — As a user ready to import the calendar, I want the formatting of the calendar export to be cleanly organized with accurate course metadata and location details.
- **3** — As a user who wants reminders, I want deadlines and milestones to be all-day events with customizable alerts, so that I don't forget them.
- **3** — As a user switching devices, I want to export and import my profile and preferences, so that I can continue where I left off without re-entering data.

---

## Product Backlog

- As a future developer hoping to extend the framework of the project, I want a container such that I can run the core logic on my own local environment.
- As a student tracking conference deadline, I want a consolidated view, so that I can decide which to target.
- As a user, I want to ensure that my information is secure.
- As a user, I want the program to be time and space efficient.
- As a future developer, I want a test suite, so that I can refactor with confidence.