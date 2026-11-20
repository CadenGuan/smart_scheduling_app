import { z } from 'zod';
import { StandingEnum, TargetTermEnum, TargetTerm, DayEnum, Day } from './user.schema.js';

export { TargetTermEnum, TargetTerm, DayEnum, Day };

export const GeSourceEnum = z.enum(['UCSC', 'Community College / IGETC', 'Hybrid']);
export type GeSource = z.infer<typeof GeSourceEnum>;

/**
 * UCSC General Education requirements, in catalog order.
 * Source: UCSC General Catalog, General Education Requirements
 * https://catalog.ucsc.edu/en/current/general-catalog/undergraduate-information/undergraduate-academic-program/general-education-requirements
 * PE and PR are one requirement each, satisfied by any one of their sub-areas.
 */
export const GE_REQUIREMENTS = [
  { code: 'CC', name: 'Cross-Cultural Analysis' },
  { code: 'ER', name: 'Ethnicity and Race' },
  { code: 'IM', name: 'Interpreting Arts and Media' },
  { code: 'MF', name: 'Mathematical and Formal Reasoning' },
  { code: 'SI', name: 'Scientific Inquiry' },
  { code: 'SR', name: 'Statistical Reasoning' },
  { code: 'TA', name: 'Textual Analysis and Interpretation' },
  { code: 'PE', name: 'Perspectives (Environmental, Human Behavior, or Technology and Society)' },
  { code: 'PR', name: 'Practice (Collaborative Endeavor, Creative Process, or Service Learning)' },
  { code: 'C', name: 'Composition' },
  { code: 'DC', name: 'Disciplinary Communication' },
] as const;

export const GeCodeEnum = z.enum(['CC', 'ER', 'IM', 'MF', 'SI', 'SR', 'TA', 'PE', 'PR', 'C', 'DC']);
export type GeCode = z.infer<typeof GeCodeEnum>;

const isGeCode = (value: unknown): value is GeCode => GeCodeEnum.safeParse(value).success;

/** Every GE requirement not in `completed`, in catalog order. */
export function computeRemainingGEs(completed: readonly string[]): GeCode[] {
  const done = new Set(completed);
  return GE_REQUIREMENTS.map((ge) => ge.code).filter((code) => !done.has(code));
}

export interface GeStatus {
  source: GeSource;
  completed: GeCode[];
  remaining: GeCode[];
}

/**
 * Normalizes stored GE status into { source, completed, remaining }.
 * Handles the current shape (completed), the legacy shape (remaining only),
 * and missing or malformed data (nothing completed). Unknown codes are dropped.
 */
export function normalizeGeStatus(raw: unknown): GeStatus {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const sourceResult = GeSourceEnum.safeParse(obj.source);
  const source: GeSource = sourceResult.success ? sourceResult.data : 'UCSC';
  const validCodes = (value: unknown): GeCode[] =>
    Array.isArray(value) ? Array.from(new Set(value.filter(isGeCode))) : [];

  if (Array.isArray(obj.completed)) {
    const completed = validCodes(obj.completed);
    return { source, completed, remaining: computeRemainingGEs(completed) };
  }

  if (Array.isArray(obj.remaining)) {
    const remaining = validCodes(obj.remaining);
    const left = new Set<string>(remaining);
    const completed = GE_REQUIREMENTS.map((ge) => ge.code).filter((code) => !left.has(code));
    return { source, completed, remaining };
  }

  return { source, completed: [], remaining: computeRemainingGEs([]) };
}

export const TimeWindowSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  days: z.array(DayEnum),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'HH:MM format required'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'HH:MM format required'),
});
export type TimeWindow = z.infer<typeof TimeWindowSchema>;

export const OnboardingQuestionnaireSchema = z.object({
  // Step 1: Personal & Academic Profile
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email is required'),
  standing: StandingEnum,
  major: z.string().min(1, 'Major is required'),
  minor: z.string().nullable().optional(),
  intendedMajor: z.string().nullable().optional(),

  // Step 2: Academic History
  majorRequirementsTaken: z.array(z.string()).default([]),

  // Step 3: General Education
  geSource: GeSourceEnum.default('UCSC'),
  geCategoriesCompleted: z.array(GeCodeEnum).default([]),

  // Step 4: Quarter Planning & Capacity
  targetTerm: TargetTermEnum.default('Winter 2027'),
  targetCredits: z.number().int().min(5).max(25).default(15),
  targetCourseCount: z.number().int().min(1).max(5).default(3),

  // Step 5: Scheduling Preferences & Constraints
  earliestStartTime: z.string().optional(),
  latestEndTime: z.string().optional(),
  preferredFreeDays: z.array(DayEnum).default([]),
  scheduledBreaks: z.array(TimeWindowSchema).default([]),
  maxBackToBackHours: z.number().min(1).max(8).optional(),
});
export type OnboardingQuestionnaire = z.infer<typeof OnboardingQuestionnaireSchema>;

export const OnboardingProgressPayloadSchema = z.object({
  lastStep: z.number().int().min(1).max(5),
  skippedSteps: z.array(z.number().int().min(1).max(5)).default([]),
  draftAnswers: OnboardingQuestionnaireSchema.partial().default({}),
  completed: z.boolean().default(false),
});
export type OnboardingProgressPayload = z.infer<typeof OnboardingProgressPayloadSchema>;
