export * from './user.schema.js';
export * from './auth.schema.js';
export * from './onboarding.schema.js';
export * from './calendar.schema.js';
export * from './agent.schema.js';
export * from './deadline.schema.js';

// Explicit re-exports for CommonJS/Rollup interop
export {
  StandingEnum,
  StandingSchema,
  TargetTermEnum,
  DayEnum,
  TimeStringSchema,
  UserPreferencesSchema,
  UserProfileSchema,
  UpdateUserProfileSchema,
} from './user.schema.js';

export {
  RegisterRequestSchema,
  LoginRequestSchema,
  GoogleAuthRequestSchema,
  AuthResponseSchema,
} from './auth.schema.js';

export {
  GeSourceEnum,
  TimeWindowSchema,
  OnboardingQuestionnaireSchema,
  OnboardingProgressPayloadSchema,
} from './onboarding.schema.js';

export {
  CourseTypeEnum,
  ConflictBadgeSchema,
  CalendarEventSchema,
  CalendarPreviewResponseSchema,
  CurriculumNodeStatusEnum,
  CurriculumNodeSchema,
  CurriculumDagResponseSchema,
} from './calendar.schema.js';

export {
  ConferenceTierEnum,
  ConferenceDeadlineSchema,
  DeadlinesResponseSchema,
} from './deadline.schema.js';
