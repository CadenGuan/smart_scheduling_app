import { describe, it, expect } from 'vitest';
import {
  GeSourceEnum,
  TimeWindowSchema,
  OnboardingQuestionnaireSchema,
  OnboardingProgressPayloadSchema,
} from '../src/onboarding.schema.js';

describe('Onboarding Schema Architectural Contract Tests [TESTING_GOLDEN_RULES.md Layer: Shared]', () => {
  it('validates GeSourceEnum values', () => {
    expect(GeSourceEnum.safeParse('UCSC').success).toBe(true);
    expect(GeSourceEnum.safeParse('Community College / IGETC').success).toBe(true);
    expect(GeSourceEnum.safeParse('Hybrid').success).toBe(true);
    expect(GeSourceEnum.safeParse('Other').success).toBe(false);
  });

  it('validates TimeWindowSchema structure and time formats', () => {
    const valid = {
      label: 'Lunch Break',
      days: ['Monday', 'Wednesday'],
      startTime: '12:00',
      endTime: '13:00',
    };
    expect(TimeWindowSchema.safeParse(valid).success).toBe(true);

    expect(
      TimeWindowSchema.safeParse({
        label: '',
        days: ['Monday'],
        startTime: '12:00',
        endTime: '13:00',
      }).success
    ).toBe(false);

    expect(
      TimeWindowSchema.safeParse({
        label: 'Lunch',
        days: ['Monday'],
        startTime: '12:0',
        endTime: '13:00',
      }).success
    ).toBe(false);
  });

  it('validates OnboardingQuestionnaireSchema with defaults', () => {
    const valid = {
      name: 'Sammy Slug',
      email: 'slug@ucsc.edu',
      standing: 'Junior',
      major: 'Computer Science B.S.',
    };

    const parsed = OnboardingQuestionnaireSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.geSource).toBe('UCSC');
      expect(parsed.data.targetTerm).toBe('Winter 2027');
      expect(parsed.data.targetCredits).toBe(15);
      expect(parsed.data.targetCourseCount).toBe(3);
    }
  });

  it('validates OnboardingProgressPayloadSchema', () => {
    const validProgress = {
      lastStep: 2,
      skippedSteps: [1],
      draftAnswers: {
        name: 'Sammy',
      },
      completed: false,
    };

    expect(OnboardingProgressPayloadSchema.safeParse(validProgress).success).toBe(true);

    expect(
      OnboardingProgressPayloadSchema.safeParse({
        lastStep: 6,
      }).success
    ).toBe(false);
  });
});
