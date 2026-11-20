import { describe, it, expect } from 'vitest';
import {
  GE_REQUIREMENTS,
  GeCodeEnum,
  computeRemainingGEs,
  normalizeGeStatus,
  OnboardingQuestionnaireSchema,
  OnboardingProgressPayloadSchema,
} from '../src/onboarding.schema.js';
import * as sharedIndex from '../src/index.js';

// Source of truth: UCSC General Catalog 2026-27, General Education Requirements
// https://catalog.ucsc.edu/en/current/general-catalog/undergraduate-information/undergraduate-academic-program/general-education-requirements
const CATALOG_GE_CODES = ['CC', 'ER', 'IM', 'MF', 'SI', 'SR', 'TA', 'PE', 'PR', 'C', 'DC'];

const baseAnswers = {
  name: 'Sammy Slug',
  email: 'sammy@ucsc.edu',
  standing: 'Junior',
  major: 'Computer Science B.S.',
};

describe('GT22 [Shared] GE requirement catalog', () => {
  it('GT22: GE_REQUIREMENTS lists exactly the GE codes in the current UCSC catalog', () => {
    const codes = GE_REQUIREMENTS.map((g) => g.code);
    expect([...codes].sort()).toEqual([...CATALOG_GE_CODES].sort());
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('GT22: GE_REQUIREMENTS includes MF (Mathematical and Formal Reasoning)', () => {
    const mf = GE_REQUIREMENTS.find((g) => g.code === 'MF');
    expect(mf).toBeDefined();
    expect(mf!.name).toMatch(/mathematical and formal reasoning/i);
  });

  it('GT22: every GE requirement has a non-empty display name', () => {
    for (const ge of GE_REQUIREMENTS) {
      expect(ge.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('GT22: PE and PR are single requirements whose names mention their sub-areas', () => {
    const pe = GE_REQUIREMENTS.find((g) => g.code === 'PE');
    const pr = GE_REQUIREMENTS.find((g) => g.code === 'PR');
    expect(pe!.name).toMatch(/perspectives/i);
    expect(pr!.name).toMatch(/practice/i);
    // Sub-areas are not separate checklist entries
    const codes = GE_REQUIREMENTS.map((g) => g.code);
    for (const sub of ['PE-E', 'PE-H', 'PE-T', 'PR-C', 'PR-E', 'PR-S']) {
      expect(codes).not.toContain(sub);
    }
  });

  it('GT22: GeCodeEnum accepts every catalog code and rejects unknown codes', () => {
    for (const code of CATALOG_GE_CODES) {
      expect(GeCodeEnum.safeParse(code).success).toBe(true);
    }
    expect(GeCodeEnum.safeParse('XYZ').success).toBe(false);
    expect(GeCodeEnum.safeParse('cc').success).toBe(false);
    expect(GeCodeEnum.safeParse('').success).toBe(false);
  });

  it('GT22: GE helpers are exported from the shared package index', () => {
    expect(sharedIndex.GE_REQUIREMENTS).toBe(GE_REQUIREMENTS);
    expect(sharedIndex.GeCodeEnum).toBe(GeCodeEnum);
    expect(sharedIndex.computeRemainingGEs).toBe(computeRemainingGEs);
    expect(sharedIndex.normalizeGeStatus).toBe(normalizeGeStatus);
  });
});

describe('GT22 [Shared] geCategoriesCompleted questionnaire field', () => {
  it('GT22: accepts a list of satisfied GE codes', () => {
    const parsed = OnboardingQuestionnaireSchema.parse({
      ...baseAnswers,
      geCategoriesCompleted: ['CC', 'TA', 'MF'],
    });
    expect(parsed.geCategoriesCompleted).toEqual(['CC', 'TA', 'MF']);
  });

  it('GT22: defaults geCategoriesCompleted to an empty list (nothing pre-selected)', () => {
    const parsed = OnboardingQuestionnaireSchema.parse(baseAnswers);
    expect(parsed.geCategoriesCompleted).toEqual([]);
  });

  it('GT22: rejects non-string entries', () => {
    const result = OnboardingQuestionnaireSchema.safeParse({
      ...baseAnswers,
      geCategoriesCompleted: ['CC', 42],
    });
    expect(result.success).toBe(false);
  });

  it('GT22: rejects codes that are not UCSC GE requirements', () => {
    const result = OnboardingQuestionnaireSchema.safeParse({
      ...baseAnswers,
      geCategoriesCompleted: ['CC', 'NOT-A-GE'],
    });
    expect(result.success).toBe(false);
  });

  it('GT22: progress payload draft answers accept geCategoriesCompleted', () => {
    const parsed = OnboardingProgressPayloadSchema.parse({
      lastStep: 3,
      draftAnswers: { geSource: 'UCSC', geCategoriesCompleted: ['SI', 'SR'] },
    });
    expect(parsed.draftAnswers.geCategoriesCompleted).toEqual(['SI', 'SR']);
  });

  it('GT22: progress payload rejects unknown GE codes in draft answers', () => {
    const result = OnboardingProgressPayloadSchema.safeParse({
      lastStep: 3,
      draftAnswers: { geCategoriesCompleted: ['BOGUS'] },
    });
    expect(result.success).toBe(false);
  });
});

describe('GT22 [Shared] computeRemainingGEs', () => {
  it('GT22: returns every GE except the completed ones', () => {
    const remaining = computeRemainingGEs(['CC', 'TA']);
    expect(remaining).not.toContain('CC');
    expect(remaining).not.toContain('TA');
    expect([...remaining].sort()).toEqual(
      CATALOG_GE_CODES.filter((c) => c !== 'CC' && c !== 'TA').sort()
    );
  });

  it('GT22: nothing completed means every GE remains', () => {
    expect([...computeRemainingGEs([])].sort()).toEqual([...CATALOG_GE_CODES].sort());
  });

  it('GT22: everything completed means nothing remains', () => {
    expect(computeRemainingGEs([...CATALOG_GE_CODES])).toEqual([]);
  });

  it('GT22: duplicate completed codes do not affect the result', () => {
    expect([...computeRemainingGEs(['CC', 'CC'])].sort()).toEqual(
      CATALOG_GE_CODES.filter((c) => c !== 'CC').sort()
    );
  });

  it('GT22: keeps the catalog order of GE_REQUIREMENTS', () => {
    const order = GE_REQUIREMENTS.map((g) => g.code);
    const remaining = computeRemainingGEs(['ER']);
    expect(remaining).toEqual(order.filter((c) => c !== 'ER'));
  });
});

describe('GT22 [Shared] normalizeGeStatus (legacy compatibility)', () => {
  it('GT22: passes through a status that already has completed and remaining', () => {
    const status = normalizeGeStatus({
      source: 'Hybrid',
      completed: ['CC'],
      remaining: computeRemainingGEs(['CC']),
    });
    expect(status.source).toBe('Hybrid');
    expect(status.completed).toEqual(['CC']);
    expect(status.remaining).toEqual(computeRemainingGEs(['CC']));
  });

  it('GT22: derives remaining when only completed is stored', () => {
    const status = normalizeGeStatus({ source: 'UCSC', completed: ['SI', 'SR'] });
    expect(status.completed).toEqual(['SI', 'SR']);
    expect(status.remaining).toEqual(computeRemainingGEs(['SI', 'SR']));
  });

  it('GT22: derives completed for a legacy status that only stored remaining', () => {
    const status = normalizeGeStatus({ source: 'UCSC', remaining: ['CC', 'ER'] });
    expect(status.remaining).toEqual(['CC', 'ER']);
    expect([...status.completed].sort()).toEqual(
      CATALOG_GE_CODES.filter((c) => c !== 'CC' && c !== 'ER').sort()
    );
  });

  it('GT22: null, undefined, or malformed input yields an empty completed list and source UCSC', () => {
    for (const raw of [null, undefined, 'not-an-object', 42]) {
      const status = normalizeGeStatus(raw as unknown);
      expect(status.source).toBe('UCSC');
      expect(status.completed).toEqual([]);
      expect([...status.remaining].sort()).toEqual([...CATALOG_GE_CODES].sort());
    }
  });

  it('GT22: unknown codes in stored data are dropped', () => {
    const status = normalizeGeStatus({ source: 'UCSC', completed: ['CC', 'C1', 'BOGUS'] });
    expect(status.completed).toEqual(['CC']);
  });
});
