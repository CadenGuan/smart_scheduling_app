import { CalendarEvent } from 'shared';

export const sampleCalendarEvents: CalendarEvent[] = [
  {
    id: 'cse-115a-lec',
    title: 'CSE 115A: Intro to Software Engineering',
    type: 'MAJOR',
    instructor: 'Richard Jullig',
    location: 'Baskin Engr 152',
    days: ['Monday', 'Wednesday', 'Friday'],
    startTime: '09:00',
    endTime: '10:10',
    color: '#00B4DB', // Triadic Teal
  },
  {
    id: 'math-21-lec',
    title: 'MATH 21: Linear Algebra',
    type: 'MAJOR',
    instructor: 'Pedro Morales',
    location: 'Thimann 003',
    days: ['Tuesday', 'Thursday'],
    startTime: '13:15',
    endTime: '14:50',
    color: '#00B4DB', // Triadic Teal
  },
  {
    id: 'art-10f-lec',
    title: 'ART 10F: 2D Design (PR GE)',
    type: 'GE',
    instructor: 'Elizabeth Stephens',
    location: 'Digital Arts 101',
    days: ['Monday', 'Wednesday'],
    startTime: '15:20',
    endTime: '16:55',
    color: '#FF6B6B', // Triadic Magenta
  },
  {
    id: 'gcal-work-shift',
    title: 'Dining Hall Work Shift (Google Cal)',
    type: 'GOOGLE_CALENDAR_BUSY',
    location: 'Cowell Dining Hall',
    days: ['Tuesday', 'Thursday'],
    startTime: '10:00',
    endTime: '12:00',
    color: '#F9CA24', // Triadic Yellow
  },
];

