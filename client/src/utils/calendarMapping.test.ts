import { describe, it, expect } from 'vitest';
import { parseDaysToDaysOfWeek, mapScheduleItemsToFullCalendar } from './calendarMapping';
import { UserScheduleItem } from 'shared';

describe('Calendar Mapping Utilities', () => {
  describe('parseDaysToDaysOfWeek', () => {
    it('parses comma-separated days correctly', () => {
      expect(parseDaysToDaysOfWeek('M,W,F')).toEqual([1, 3, 5]);
      expect(parseDaysToDaysOfWeek('Tu,Th')).toEqual([2, 4]);
      expect(parseDaysToDaysOfWeek('M,Tu,W,Th,F')).toEqual([1, 2, 3, 4, 5]);
    });

    it('parses compressed day tokens correctly', () => {
      expect(parseDaysToDaysOfWeek('MWF')).toEqual([1, 3, 5]);
      expect(parseDaysToDaysOfWeek('TuTh')).toEqual([2, 4]);
    });

    it('defaults to Monday if days cannot be parsed', () => {
      expect(parseDaysToDaysOfWeek('')).toEqual([1]);
    });
  });

  describe('mapScheduleItemsToFullCalendar', () => {
    const sampleItems: UserScheduleItem[] = [
      {
        id: 'ev-1',
        userId: 'u1',
        courseCode: 'CSE 30',
        title: 'Programming Abstractions in Python',
        description: 'Lecture 01',
        days: 'M,W,F',
        startTime: '10:00',
        endTime: '11:05',
        startDate: '2027-01-04',
        endDate: '2027-03-19',
        isImported: false,
        syncStatus: 'synced',
        googleEventId: 'gcal_1',
      },
      {
        id: 'ev-2',
        userId: 'u1',
        courseCode: 'CORP 100',
        title: 'Company Sync Block',
        description: 'Imported from Google Calendar',
        days: 'Tu,Th',
        startTime: '14:00',
        endTime: '15:00',
        startDate: '2027-01-04',
        endDate: '2027-03-19',
        isImported: true,
        syncStatus: 'synced',
        googleEventId: 'gcal_2',
      },
      {
        id: 'ev-3',
        userId: 'u1',
        courseCode: 'CSE 101',
        title: 'Algorithms',
        description: 'Lecture 01',
        days: 'MWF',
        startTime: '13:20',
        endTime: '14:25',
        startDate: '2027-01-04',
        endDate: '2027-03-19',
        isImported: false,
        syncStatus: 'pending',
        googleEventId: null,
      },
    ];

    it('maps items to recurring FullCalendar format with correct recurrence and styling', () => {
      const mapped = mapScheduleItemsToFullCalendar(sampleItems);
      expect(mapped).toHaveLength(3);

      // Check standard academic class
      expect(mapped[0].id).toBe('ev-1');
      expect(mapped[0].daysOfWeek).toEqual([1, 3, 5]);
      expect(mapped[0].startTime).toBe('10:00:00');
      expect(mapped[0].endTime).toBe('11:05:00');
      expect(mapped[0].startRecur).toBe('2027-01-04');
      expect(mapped[0].endRecur).toBe('2027-03-19');
      expect(mapped[0].backgroundColor).toBe('#00B4DB');
      expect(mapped[0].extendedProps.isImported).toBe(false);
      expect(mapped[0].extendedProps.syncStatus).toBe('synced');

      // Check imported external class (styled gray)
      expect(mapped[1].id).toBe('ev-2');
      expect(mapped[1].daysOfWeek).toEqual([2, 4]);
      expect(mapped[1].backgroundColor).toBe('#64748b'); // Gray for imported
      expect(mapped[1].extendedProps.isImported).toBe(true);

      // Check pending course
      expect(mapped[2].daysOfWeek).toEqual([1, 3, 5]);
      expect(mapped[2].extendedProps.syncStatus).toBe('pending');
    });
  });
});
