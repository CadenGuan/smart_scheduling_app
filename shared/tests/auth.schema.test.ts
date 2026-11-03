import { describe, it, expect } from 'vitest';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  GoogleAuthRequestSchema,
  AuthResponseSchema,
} from '../src/auth.schema.js';

describe('Auth Schema Architectural Contract Tests [TESTING_GOLDEN_RULES.md Layer: Shared]', () => {
  it('validates a valid registration payload', () => {
    const valid = {
      email: 'slug@ucsc.edu',
      password: 'Password123!',
      name: 'Sammy Slug',
      standing: 'Junior',
      major: 'Computer Science B.S.',
    };
    expect(RegisterRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid email, short password, or empty fields in RegisterRequestSchema', () => {
    expect(
      RegisterRequestSchema.safeParse({
        email: 'invalid-email',
        password: 'Password123!',
        name: 'Sammy',
        standing: 'Junior',
        major: 'CS',
      }).success
    ).toBe(false);

    expect(
      RegisterRequestSchema.safeParse({
        email: 'slug@ucsc.edu',
        password: 'short',
        name: 'Sammy',
        standing: 'Junior',
        major: 'CS',
      }).success
    ).toBe(false);

    expect(
      RegisterRequestSchema.safeParse({
        email: 'slug@ucsc.edu',
        password: 'Password123!',
        name: '',
        standing: 'Junior',
        major: 'CS',
      }).success
    ).toBe(false);
  });

  it('validates LoginRequestSchema', () => {
    expect(
      LoginRequestSchema.safeParse({
        email: 'slug@ucsc.edu',
        password: 'Password123!',
      }).success
    ).toBe(true);

    expect(
      LoginRequestSchema.safeParse({
        email: 'not-email',
        password: 'Password123!',
      }).success
    ).toBe(false);
  });

  it('validates GoogleAuthRequestSchema', () => {
    expect(
      GoogleAuthRequestSchema.safeParse({
        idToken: 'valid-token',
        isMock: true,
      }).success
    ).toBe(true);

    expect(
      GoogleAuthRequestSchema.safeParse({
        idToken: '',
      }).success
    ).toBe(false);
  });

  it('validates AuthResponseSchema structure', () => {
    const validResponse = {
      success: true,
      data: {
        token: 'mock-jwt-token',
        onboardingCompleted: true,
        googleCalendarLinked: false,
        user: {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          email: 'slug@ucsc.edu',
          name: 'Sammy Slug',
          standing: 'Junior',
          major: 'Computer Science B.S.',
        },
      },
    };
    expect(AuthResponseSchema.safeParse(validResponse).success).toBe(true);

    expect(
      AuthResponseSchema.safeParse({
        success: false,
      }).success
    ).toBe(false);
  });
});
