export * from './user.schema.js';
export * from './auth.schema.js';
export * from './onboarding.schema.js';
export * from './calendar.schema.js';
export * from './agent.schema.js';
export * from './deadline.schema.js';

export * from './schedule.schema.js';

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
  GE_REQUIREMENTS,
  GeCodeEnum,
  computeRemainingGEs,
  normalizeGeStatus,
  TimeWindowSchema,
  OnboardingQuestionnaireSchema,
  OnboardingProgressPayloadSchema,
} from './onboarding.schema.js';

export {
  CourseTypeEnum,
  getCourseTypeColor,
  CourseLevelEnum,
  ConflictBadgeSchema,
  CalendarEventSchema,
  CourseSchema,
  CourseCatalogItemSchema,
  CalendarPreviewResponseSchema,
  CurriculumNodeStatusEnum,
  CurriculumNodeSchema,
  CurriculumDagResponseSchema,
  SaveCalendarEventsRequestSchema,
  SaveCalendarEventsResponseSchema,
  ClearCalendarEventsResponseSchema,
} from './calendar.schema.js';

export type { CourseLevel, Course, CourseCatalogItem } from './calendar.schema.js';

export {
  AgentSenderEnum,
  AgentChatRequestSchema,
  AgentMessageSchema,
  AgentChatResponseSchema,
  AgentMessagesResponseSchema,
  ClearChatResponseSchema,
} from './agent.schema.js';

export {
  ConferenceTierEnum,
  ConferenceDeadlineSchema,
  DeadlinesResponseSchema,
} from './deadline.schema.js';

export {
  SyncStatusEnum,
  type SyncStatus,
  UserScheduleItemSchema,
  type UserScheduleItem,
  UserSettingsSchema,
  type UserSettings,
  CreateScheduleEventRequestSchema,
  type CreateScheduleEventDTO,
  UpdateScheduleEventRequestSchema,
  type UpdateScheduleEventDTO,
} from './schedule.schema.js';
