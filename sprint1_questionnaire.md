# Sprint 1 — Onboarding Questionnaire Specification

This document details the structure, fields, validation rules, and schema for the student onboarding questionnaire implemented in Sprint 1.

---

## 1. Questionnaire Flow & Sections

The questionnaire is split into 5 modular steps to provide a clean multi-step wizard UI. In accordance with the sprint requirements, non-critical questions are **skippable** so first-time users can proceed quickly and return later.

---

### Step 1: Personal & Academic Profile

| Field Name | Type | Required? | Description / UI Control |
| :--- | :--- | :--- | :--- |
| **`name`** | Text Input | **Required** | Student's full or preferred name. |
| **`email`** | Email Input | **Required** | UCSC email (`@ucsc.edu`) or personal email (pre-filled if using Google Sign-In). |
| **`standing`** | Dropdown | **Required** | Academic level (affects enrollment appointment windows):<br>• `Freshman`<br>• `Sophomore`<br>• `Junior`<br>• `Senior`<br>• `Graduate` |
| **`major`** | Searchable Dropdown | **Required** | Primary declared major (e.g., *Computer Science B.S.*, *Computer Engineering B.S.*). |
| **`minor`** | Searchable Dropdown | Optional (Skippable) | Declared or planned minor (e.g., *Technology & Information Management*, *Bioinformatics*). |
| **`intended_major`** | Searchable Dropdown | Optional (Skippable) | Applicable for proposed/undeclared students seeking major qualification. |

---

### Step 2: Academic History & Major Requirements

| Field Name | Type | Required? | Description / UI Control |
| :--- | :--- | :--- | :--- |
| **`major_requirements_taken`** | Multi-Select Search / Checklist | Optional (Skippable) | List of major-specific prerequisite courses completed or waived (e.g., `CSE 12`, `CSE 13S`, `CSE 16`, `MATH 19A`, `MATH 19B`, `AM 10`). Grouped by lower-division and upper-division. |

---

### Step 3: General Education (GE) Status

| Field Name | Type | Required? | Description / UI Control |
| :--- | :--- | :--- | :--- |
| **`ge_source`** | Radio / Toggle | **Required** | Where GE requirements were/are being fulfilled:<br>• `UCSC (Here)`<br>• `Community College / Transfer (IGETC)`<br>• `Hybrid / Both` |
| **`ge_categories_remaining`** | Multi-Select Tags / Checklist | Optional (Skippable) | If GEs still needed, select remaining UCSC GE codes:<br>• `CC` (Cross-Cultural Analysis)<br>• `ER` (Ethnicity & Race)<br>• `IM` (Interpreting Arts & Media)<br>• `SI` (Scientific Inquiry)<br>• `SR` (Statistical Reasoning)<br>• `TA` (Textual Analysis)<br>• `PE` (Physical & Environmental Sciences)<br>• `PR` (Practice: Collaborative, Creative, Service)<br>• `C` (Composition) |

---

### Step 4: Quarter Target & Course Load

| Field Name | Type | Required? | Description / UI Control |
| :--- | :--- | :--- | :--- |
| **`target_term`** | Dropdown | **Required** | The target academic term being planned:<br>• `Fall 2026`<br>• `Winter 2027`<br>• `Spring 2027`<br>• `Summer 2027` |
| **`target_credits`** | Slider / Number Input | **Required** | Planned unit load (Default: 15 units):<br>• `10–12 units` (Part-time / Light)<br>• `15 units` (Standard 3 courses)<br>• `19–20 units` (Overload / 4 courses) |
| **`target_course_count`** | Stepper (1–4) | **Required** | Number of courses planned (Default: 3 courses). |

---

### Step 5: Scheduling Preferences & Constraints

| Field Name | Type | Required? | Description / UI Control |
| :--- | :--- | :--- | :--- |
| **`earliest_start_time`** | Time Dropdown | Optional (Skippable) | Earliest acceptable class time (e.g., `09:00 AM`). |
| **`latest_end_time`** | Time Dropdown | Optional (Skippable) | Latest acceptable class end time (e.g., `06:00 PM`). |
| **`preferred_free_days`** | Multi-Checkbox | Optional (Skippable) | Days student prefers to keep light or free (e.g., `Monday`, `Wednesday`, `Friday`). |
| **`scheduled_breaks`** | Dynamic List | Optional (Skippable) | Blocked time intervals for lunch, gym, work, or study (e.g., `Lunch: 12:00 PM – 01:00 PM M-F`). |
| **`max_back_to_back_hours`** | Number Stepper | Optional (Skippable) | Max continuous hours in class without a break (Default: `3 hours`). |

---

## 2. Shared Zod Validation Schema

This schema is placed in `shared/src/onboarding.ts` and used on both frontend and backend.

```typescript
import { z } from 'zod';

export const StandingEnum = z.enum([
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Graduate',
]);

export const GeSourceEnum = z.enum([
  'UCSC',
  'Community College / IGETC',
  'Hybrid',
]);

export const TargetTermEnum = z.enum([
  'Fall 2026',
  'Winter 2027',
  'Spring 2027',
  'Summer 2027',
]);

export const TimeWindowSchema = z.object({
  label: z.string().min(1),
  days: z.array(z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'HH:MM format required'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'HH:MM format required'),
});

export const OnboardingQuestionnaireSchema = z.object({
  // Profile (Step 1)
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email is required'),
  standing: StandingEnum,
  major: z.string().min(1, 'Major is required'),
  minor: z.string().optional(),
  intendedMajor: z.string().optional(),

  // Academic History (Step 2)
  majorRequirementsTaken: z.array(z.string()).default([]),

  // General Education (Step 3)
  geSource: GeSourceEnum.default('UCSC'),
  geCategoriesRemaining: z.array(z.string()).default([]),

  // Quarter Planning (Step 4)
  targetTerm: TargetTermEnum,
  targetCredits: z.number().int().min(5).max(25).default(15),
  targetCourseCount: z.number().int().min(1).max(5).default(3),

  // Scheduling Preferences (Step 5)
  earliestStartTime: z.string().optional(),
  latestEndTime: z.string().optional(),
  preferredFreeDays: z.array(z.string()).default([]),
  scheduledBreaks: z.array(TimeWindowSchema).default([]),
  maxBackToBackHours: z.number().min(1).max(8).optional(),
});

export type OnboardingQuestionnaire = z.infer<typeof OnboardingQuestionnaireSchema>;
```

---

## 3. Storage Representation in SQLite

Inside `server/data/app.db`:
* **`users` Table**: Contains core profile columns (`name`, `email`, `standing`, `major`, `minor`, `intended_major`).
* **`onboarding_progress` Table**:
  * `last_step`: An integer (1 to 5) tracking where the user left off.
  * `skipped_steps`: JSON array of skipped step indices (e.g. `[2, 5]`).
  * `draft_answers`: Full JSON payload conforming to `OnboardingQuestionnaireSchema` so users can incrementally save and resume across sessions.

