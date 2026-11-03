import { describe, it, expect } from 'vitest';
import {
  StandingEnum,
  TargetTermEnum,
  DayEnum,
  TimeStringSchema,
  UserPreferencesSchema,
  UserProfileSchema,
  UpdateUserProfileSchema,
} from '../src/user.schema.js';

describe('User Schema Architectural Contract Tests [TESTING_GOLDEN_RULES.md Layer: Shared]', () => {
  describe('StandingEnum & TargetTermEnum & DayEnum', () => {
    it('validates supported class standings and rejects invalid strings', () => {
      expect(StandingEnum.safeParse('Freshman').success).toBe(true);
      expect(StandingEnum.safeParse('Sophomore').success).toBe(true);
      expect(StandingEnum.safeParse('Junior').success).toBe(true);
      expect(StandingEnum.safeParse('Senior').success).toBe(true);
      expect(StandingEnum.safeParse('Graduate').success).toBe(true);

      expect(StandingEnum.safeParse('Alumni').success).toBe(false);
      expect(StandingEnum.safeParse('').success).toBe(false);
    });

    it('validates academic target terms and rejects unknown terms', () => {
      expect(TargetTermEnum.safeParse('Fall 2026').success).toBe(true);
      expect(TargetTermEnum.safeParse('Winter 2027').success).toBe(true);
      expect(TargetTermEnum.safeParse('Spring 2027').success).toBe(true);
      expect(TargetTermEnum.safeParse('Summer 2027').success).toBe(true);

      expect(TargetTermEnum.safeParse('Fall 2025').success).toBe(false);
    });

    it('validates standard academic weekdays Monday through Friday', () => {
      expect(DayEnum.safeParse('Monday').success).toBe(true);
      expect(DayEnum.safeParse('Tuesday').success).toBe(true);
      expect(DayEnum.safeParse('Wednesday').success).toBe(true);
      expect(DayEnum.safeParse('Thursday').success).toBe(true);
      expect(DayEnum.safeParse('Friday').success).toBe(true);

      expect(DayEnum.safeParse('Saturday').success).toBe(false);
      expect(DayEnum.safeParse('Sunday').success).toBe(false);
    });
  });

  describe('TimeStringSchema (Empty String & Null Sanitization)', () => {
    it('accepts valid 24-hour HH:MM formatted times', () => {
      const res1 = TimeStringSchema.safeParse('09:00');
      expect(res1.success).toBe(true);
      if (res1.success) expect(res1.data).toBe('09:00');

      const res2 = TimeStringSchema.safeParse('23:59');
      expect(res2.success).toBe(true);
      if (res2.success) expect(res2.data).toBe('23:59');

      const res3 = TimeStringSchema.safeParse('00:00');
      expect(res3.success).toBe(true);
      if (res3.success) expect(res3.data).toBe('00:00');
    });

    it('sanitizes empty string "" to undefined', () => {
      const res = TimeStringSchema.safeParse('');
      expect(res.success).toBe(true);
      if (res.success) expect(res.data).toBeUndefined();
    });

    it('sanitizes null to undefined', () => {
      const res = TimeStringSchema.safeParse(null);
      expect(res.success).toBe(true);
      if (res.success) expect(res.data).toBeUndefined();
    });

    it('accepts undefined without transformation error', () => {
      const res = TimeStringSchema.safeParse(undefined);
      expect(res.success).toBe(true);
      if (res.success) expect(res.data).toBeUndefined();
    });

    it('rejects invalid time formats', () => {
      expect(TimeStringSchema.safeParse('8:30').success).toBe(false);
      expect(TimeStringSchema.safeParse('24:00').success).toBe(false);
      expect(TimeStringSchema.safeParse('12:60').success).toBe(false);
      expect(TimeStringSchema.safeParse('invalid').success).toBe(false);
      expect(TimeStringSchema.safeParse(1234).success).toBe(false);
    });
  });

  describe('UserPreferencesSchema', () => {
    it('applies standard defaults when empty object is passed', () => {
      const parsed = UserPreferencesSchema.parse({});
      expect(parsed.targetTerm).toBe('Winter 2027');
      expect(parsed.targetCredits).toBe(15);
      expect(parsed.preferredFreeDays).toEqual([]);
      expect(parsed.earliestStartTime).toBeUndefined();
      expect(parsed.latestEndTime).toBeUndefined();
      expect(parsed.maxBackToBackHours).toBeUndefined();
    });

    it('enforces targetCredits bounds between 5 and 25', () => {
      expect(UserPreferencesSchema.safeParse({ targetCredits: 5 }).success).toBe(true);
      expect(UserPreferencesSchema.safeParse({ targetCredits: 25 }).success).toBe(true);
      expect(UserPreferencesSchema.safeParse({ targetCredits: 4 }).success).toBe(false);
      expect(UserPreferencesSchema.safeParse({ targetCredits: 26 }).success).toBe(false);
      expect(UserPreferencesSchema.safeParse({ targetCredits: 15.5 }).success).toBe(false);
    });

    it('enforces maxBackToBackHours bounds between 1 and 8', () => {
      expect(UserPreferencesSchema.safeParse({ maxBackToBackHours: 1 }).success).toBe(true);
      expect(UserPreferencesSchema.safeParse({ maxBackToBackHours: 8 }).success).toBe(true);
      expect(UserPreferencesSchema.safeParse({ maxBackToBackHours: 0 }).success).toBe(false);
      expect(UserPreferencesSchema.safeParse({ maxBackToBackHours: 9 }).success).toBe(false);
    });

    it('sanitizes empty strings for earliestStartTime and latestEndTime in preferences payload', () => {
      const parsed = UserPreferencesSchema.parse({
        earliestStartTime: '',
        latestEndTime: '',
      });
      expect(parsed.earliestStartTime).toBeUndefined();
      expect(parsed.latestEndTime).toBeUndefined();
    });

    it('sanitizes null for earliestStartTime and latestEndTime in preferences payload', () => {
      const parsed = UserPreferencesSchema.parse({
        earliestStartTime: null,
        latestEndTime: null,
      });
      expect(parsed.earliestStartTime).toBeUndefined();
      expect(parsed.latestEndTime).toBeUndefined();
    });

    it('validates that earliestStartTime is not later than latestEndTime', () => {
      const valid = UserPreferencesSchema.safeParse({
        earliestStartTime: '09:00',
        latestEndTime: '17:00',
      });
      expect(valid.success).toBe(true);

      const equal = UserPreferencesSchema.safeParse({
        earliestStartTime: '12:00',
        latestEndTime: '12:00',
      });
      expect(equal.success).toBe(true);

      const invalid = UserPreferencesSchema.safeParse({
        earliestStartTime: '18:00',
        latestEndTime: '09:00',
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0].message).toBe(
          'earliestStartTime must not be later than latestEndTime'
        );
      }
    });
  });

  describe('UserProfileSchema & UpdateUserProfileSchema', () => {
    const validProfile = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      email: 'slug@ucsc.edu',
      name: 'Sammy Slug',
      standing: 'Junior',
      major: 'Computer Science B.S.',
      minor: 'Technology and Information Management',
      intendedMajor: null,
      preferences: {
        targetTerm: 'Winter 2027',
        targetCredits: 15,
        earliestStartTime: '09:00',
        latestEndTime: '17:00',
        preferredFreeDays: ['Friday'],
        maxBackToBackHours: 3,
      },
    };

    it('validates a complete valid UserProfile', () => {
      const parsed = UserProfileSchema.safeParse(validProfile);
      expect(parsed.success).toBe(true);
    });

    it('validates partial updates with UpdateUserProfileSchema', () => {
      const partialUpdate = {
        name: 'Samantha Slug',
        minor: null,
        preferences: {
          earliestStartTime: '',
          latestEndTime: '18:00',
        },
      };

      const parsed = UpdateUserProfileSchema.safeParse(partialUpdate);
      expect(parsed.success).toBe(true);
      if (parsed.success && parsed.data.preferences) {
        expect(parsed.data.preferences.earliestStartTime).toBeUndefined();
        expect(parsed.data.preferences.latestEndTime).toBe('18:00');
      }
    });

    it('rejects invalid email and non-uuid userId in UserProfileSchema', () => {
      expect(
        UserProfileSchema.safeParse({
          ...validProfile,
          userId: 'non-uuid-string',
        }).success
      ).toBe(false);

      expect(
        UserProfileSchema.safeParse({
          ...validProfile,
          email: 'not-an-email',
        }).success
      ).toBe(false);
    });
  });
});
