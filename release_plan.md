# Release Plan

**Product name:** Smart Scheduling App  
**Team name:** —  
**Release name:** Pre-sprint  
**Release date:** —  
**Revision number:** 0  
**Revision date:** —

---

## High-Level Goals

The application targets UCSC students who need help scheduling their academic and research lives. The initial vision—personalized research planning, faculty outreach, and long-term career mapping—was too ambitious for a quarter-long project, so the team narrowed the scope to a focused core: an agent-driven assistant that elicits the user's constraints and goals through conversation, retrieves accurate event data (course sections, research deadlines, job fairs) via a web scraping service built with UCSC ITS consent, and generates a calendar deliverable with precise timestamps. The agent does not decide for the user; it proposes, explains, and lets the user adjust before export.

The MVP is defined by user stories. For agent interaction, a first-time user should be greeted, a vague interest should prompt clarifying questions, and answers should be coherent and justifiable. A user who says "this is too much" should receive alternatives, and a user who is unsure should hear why a recommendation was made. For scheduling, a freshman should get a course planner aligned with that year's offerings, a research-interested student should avoid searching, a job-seeking student should see job fair and application deadlines, and a four-year student should have unit and GE caps respected. For data, the catalog should reflect the current term, and research deadlines should be accurate. For calendar export, the plan should be previewable, the formatting user-friendly, and the `.ics` file should import cleanly into Google or Apple Calendar with deadlines as all-day events carrying alerts. For trust, users should see sources, edit preferences directly, and clear their data. For edge cases, ambiguity should prompt questions, infeasible plans should be flagged, and missing course sections should trigger alternatives.

Each sprint will produce a Software Requirements Specification and a Design Document to surface concerns before development. Planned learning spikes include CSS and JavaScript, non-relational database languages, web scraping with consent, LangGraph agent orchestration, and `.ics` generation. The project succeeds if a UCSC student can converse with the agent, receive a proposed schedule with courses and deadlines, preview it, export a working `.ics` file, and return later to find their preferences preserved.

---

## User Stories

> **Format:** As a {role}, I want {goal} [so that {reason}].

1. As a freshman, I want a planner of all my courses that aligns with what is offered that academic year.
2. As a student interested in research, I want to avoid time spent searching on research (i.e. I want listing of research opportunities, classes that I can take, contact information of professors and their research preferences).
3. As a student looking for an on-campus job, I want the timestamps on job fairs and priority application deadlines.
4. As a user trying to better coordinate the events, I need clear time constraints and description of the events so that I can discern and evaluate what can be done.
5. As an interactor with the agent, I want coherent, justifiable answers resulting from algorithmically predefined actions.
6. As a user ready to import the calendar, I want the formatting of the calendar to be user-friendly.
7. As a planner of a schedule, I want to be able to preview the calendar in the software so that I know what I am getting before import.
8. As a first-time user, I want the agent to greet me and explain what it can do, so that I know how to use it.
9. As a student with a vague interest, I want the agent to ask clarifying questions, so that it understands what I mean by "AI research."
10. As a user who changes their mind, I want to update my preferences without restarting the conversation, so that the agent adjusts the plan accordingly.
11. As a returning user, I want the agent to remember what I told it last time, so that I don't repeat myself.
12. As a user who disagrees with a suggestion, I want to tell the agent "This is too much" and have it propose alternatives, so that the plan fits my actual capacity.
13. As a user who is unsure, I want the agent to explain why it made a recommendation, so that I can decide whether to trust it.
14. As a student who is struggling, I want to drop a course and see the downstream impact, so that I can adjust without losing the whole plan.
15. As a user with too many constraints, I want the agent to tell me the plan is infeasible, so that I can relax something.
16. As a user switching devices, I want to export and import my profile, so that I can continue where I left off.
17. As a user interacting with the interface, I want it to be visually appealing whilst functional.
18. As a user who wants reminders, I want deadlines to be all-day events with alerts, so that I don't forget them.

---

## Sprint Plan

| Sprint | Focus |
|---|---|
| Sprint 1 | Frontend & Backend |
| Sprint 2 | Agent |
| Sprint 3 | Agent |
| Sprint 4 | Web scraping server & Cloud deployment |

---

## Product Backlog

- As a future developer hoping to extend the framework of the project, I want a container such that I can run the core logic on my own local environment.
- As a student tracking conference deadline, I want a consolidated view, so that I can decide which to target.
- As a student who is behind on prerequisites, I want to know the shortest path to a target course, so that I can plan realistically.
- As a student with a preferred learning style, I want to avoid back-to-back classes, so that I have time to process material.