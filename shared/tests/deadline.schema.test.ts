import { describe, it, expect } from 'vitest';
import {
  ConferenceTierEnum,
  ConferenceDeadlineSchema,
  DeadlinesResponseSchema,
} from '../src/deadline.schema.js';

describe('Deadlines Zod Schema Contract Test Suite', () => {
  describe('ConferenceTierEnum', () => {
    it('accepts valid conference tiers', () => {
      expect(ConferenceTierEnum.parse('Top Tier')).toBe('Top Tier');
      expect(ConferenceTierEnum.parse('Major Conference')).toBe('Major Conference');
      expect(ConferenceTierEnum.parse('Undergraduate Showcase')).toBe('Undergraduate Showcase');
      expect(() => ConferenceTierEnum.parse('Local Meetup')).toThrow();
    });
  });

  describe('ConferenceDeadlineSchema', () => {
    it('validates a complete conference deadline object', () => {
      const conf = {
        id: 'ucsc-urs-2027',
        name: 'UCSC Undergraduate Research Symposium',
        abbreviation: 'UCSC URS 2027',
        tier: 'Undergraduate Showcase',
        submissionDeadline: '2027-05-15',
        notificationDate: '2027-05-28',
        conferenceDates: 'June 5, 2027',
        location: 'Baskin Engineering Courtyard',
        topics: ['Software Engineering', 'Systems'],
        websiteUrl: 'https://undergrad.soe.ucsc.edu/symposium',
        description: 'Undergraduate research showcase.',
        daysUntilDeadline: 45,
        status: 'UPCOMING',
      };
      const parsed = ConferenceDeadlineSchema.parse(conf);
      expect(parsed.id).toBe('ucsc-urs-2027');
      expect(parsed.status).toBe('UPCOMING');
    });

    it('rejects invalid date format for submissionDeadline', () => {
      const conf = {
        id: 'bad-date',
        name: 'Bad Date Conf',
        abbreviation: 'BDC',
        tier: 'Top Tier',
        submissionDeadline: '05/15/2027', // Not YYYY-MM-DD
        conferenceDates: 'June 2027',
        location: 'San Jose',
        topics: ['AI'],
        description: 'A conference with invalid date',
      };
      expect(() => ConferenceDeadlineSchema.parse(conf)).toThrow();
    });
  });

  describe('DeadlinesResponseSchema', () => {
    it('validates a complete deadlines API response', () => {
      const payload = {
        success: true,
        data: {
          totalCount: 1,
          deadlines: [
            {
              id: 'sigcse-2027',
              name: 'ACM SIGCSE 2027',
              abbreviation: 'SIGCSE 2027',
              tier: 'Major Conference',
              submissionDeadline: '2026-12-05',
              conferenceDates: 'March 3-6, 2027',
              location: 'Portland, OR',
              topics: ['CS Education'],
              description: 'CS education symposium',
            },
          ],
          topics: ['CS Education'],
        },
      };
      const parsed = DeadlinesResponseSchema.parse(payload);
      expect(parsed.success).toBe(true);
      expect(parsed.data.totalCount).toBe(1);
      expect(parsed.data.topics).toContain('CS Education');
    });
  });
});
