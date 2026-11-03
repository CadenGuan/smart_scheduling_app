import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CourseCard } from '../src/components/dashboard/CourseCard';
import { CalendarPreview } from '../src/components/dashboard/CalendarPreview';
import { CourseDetailsModal } from '../src/components/dashboard/CourseDetailsModal';
import { CalendarEvent } from 'shared';

const cleanHtml = (html: string) => html.replace(/<!--.*?-->/g, '');

const baseEvent: CalendarEvent = {
  id: 'cse101',
  title: 'CSE 101 - Algorithms',
  type: 'MAJOR',
  instructor: 'T. Tantalo',
  location: 'Baskin Eng 101',
  days: ['Monday', 'Wednesday', 'Friday'],
  startTime: '10:00',
  endTime: '11:05',
  color: '#00B4DB',
  credits: 5,
};

describe('CourseCard & Conflict Badges Test Suite', () => {
  it('renders standard course card without conflict badges when none are present', () => {
    const onHover = vi.fn();
    const onClick = vi.fn();

    const html = cleanHtml(
      renderToString(
        React.createElement(CourseCard, {
          event: baseEvent,
          isHoveredGlobally: false,
          onHover,
          onClick,
        })
      )
    );

    expect(html).toContain('CSE 101 - Algorithms');
    expect(html).toContain('10:00 - 11:05');
    expect(html).toContain('Baskin Eng 101');
    expect(html).not.toContain('⚠️');
  });

  it('renders a conflict badge with warning icon ⚠️ when conflictBadge string is set', () => {
    const eventWithBadge: CalendarEvent = {
      ...baseEvent,
      conflictBadge: 'Spans preferred free day',
    };

    const html = cleanHtml(
      renderToString(
        React.createElement(CourseCard, {
          event: eventWithBadge,
          isHoveredGlobally: false,
          onHover: vi.fn(),
          onClick: vi.fn(),
        })
      )
    );

    expect(html).toContain('⚠️');
    expect(html).toContain('Spans preferred free day');
    expect(html).toContain('text-amber-800');
    expect(html).toContain('bg-amber-100');
    expect(html).toContain('border-amber-300');
  });

  it('renders multiple badges when conflictBadges array is set', () => {
    const eventWithBadges: CalendarEvent = {
      ...baseEvent,
      conflictBadges: ['Spans preferred free day', 'Starts before preferred time'],
    };

    const html = cleanHtml(
      renderToString(
        React.createElement(CourseCard, {
          event: eventWithBadges,
          isHoveredGlobally: false,
          onHover: vi.fn(),
          onClick: vi.fn(),
        })
      )
    );

    expect(html).toContain('⚠️');
    expect(html).toContain('Spans preferred free day');
    expect(html).toContain('Starts before preferred time');
  });

  it('handles mouse enter, mouse leave, and click events on CourseCard', () => {
    const onHover = vi.fn();
    const onClick = vi.fn();

    const card = new CourseCard({
      event: baseEvent,
      isHoveredGlobally: false,
      onHover,
      onClick,
    });

    const preventDefault = vi.fn();
    card.handleCustomMouseEnter({} as any);
    expect(card.state.isHovered).toBe(true);
    expect(onHover).toHaveBeenCalledWith('cse101', true);

    card.handleCustomMouseLeave({} as any);
    expect(card.state.isHovered).toBe(false);
    expect(onHover).toHaveBeenCalledWith('cse101', false);

    card.handleCustomClick({ preventDefault } as any);
    expect(preventDefault).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledWith(baseEvent);
  });

  it('applies GE and GOOGLE_CALENDAR_BUSY styling variants', () => {
    const geEvent: CalendarEvent = {
      ...baseEvent,
      type: 'GE',
    };
    const geHtml = cleanHtml(
      renderToString(
        React.createElement(CourseCard, {
          event: geEvent,
          isHoveredGlobally: false,
          onHover: vi.fn(),
          onClick: vi.fn(),
        })
      )
    );
    expect(geHtml).toContain('bg-[#FFEBEB]');

    const googleEvent: CalendarEvent = {
      ...baseEvent,
      type: 'GOOGLE_CALENDAR_BUSY',
    };
    const googleHtml = cleanHtml(
      renderToString(
        React.createElement(CourseCard, {
          event: googleEvent,
          isHoveredGlobally: false,
          onHover: vi.fn(),
          onClick: vi.fn(),
        })
      )
    );
    expect(googleHtml).toContain('bg-[#FFFDE7]');
  });
});

describe('CalendarPreview Test Suite', () => {
  it('calculates offsets and expands height for conflicting events', () => {
    const preview = new CalendarPreview({
      events: [baseEvent],
      term: 'Winter 2027',
    });

    // 10:00 AM -> 2 hours past 8:00 AM = 120px
    const offset = preview.calculateTopOffset('10:00');
    expect(offset).toBe(120);

    // Normal 1 hour class: 65 mins = 65px
    const normalHeight = preview.calculateHeight('10:00', '11:05', false);
    expect(normalHeight).toBe(65);

    // Very short event without conflict -> min 35px
    const shortHeight = preview.calculateHeight('10:00', '10:20', false);
    expect(shortHeight).toBe(35);

    // Very short event with conflict -> min 50px
    const conflictHeight = preview.calculateHeight('10:00', '10:20', true);
    expect(conflictHeight).toBe(50);
  });

  it('renders weekly preview with active term and weekdays', () => {
    const html = cleanHtml(
      renderToString(
        React.createElement(CalendarPreview, {
          events: [
            {
              ...baseEvent,
              conflictBadge: 'Spans preferred free day',
            },
          ],
          term: 'Spring 2027',
        })
      )
    );

    expect(html).toContain('Weekly Schedule Preview');
    expect(html).toContain('Spring 2027');
    expect(html).toContain('Mon');
    expect(html).toContain('Fri');
    expect(html).toContain('CSE 101 - Algorithms');
    expect(html).toContain('⚠️');
    expect(html).toContain('Spans preferred free day');
  });

  it('handles course hover and selection state in CalendarPreview', () => {
    const preview = new CalendarPreview({
      events: [baseEvent],
      term: 'Winter 2027',
    });

    preview.handleCourseHover('cse101', true);
    expect(preview.state.hoveredCourseId).toBe('cse101');

    preview.handleCourseHover('cse101', false);
    expect(preview.state.hoveredCourseId).toBeNull();

    preview.handleCourseSelect(baseEvent);
    expect(preview.state.selectedEvent).toEqual(baseEvent);

    preview.handleCloseModal();
    expect(preview.state.selectedEvent).toBeNull();
  });
});

describe('CourseDetailsModal Conflict Notes Test Suite', () => {
  it('returns null when event is null', () => {
    const html = cleanHtml(
      renderToString(
        React.createElement(CourseDetailsModal, {
          event: null,
          onClose: vi.fn(),
        })
      )
    );
    expect(html).toBe('');
  });

  it('renders modal with conflict note when conflictBadge is present', () => {
    const html = cleanHtml(
      renderToString(
        React.createElement(CourseDetailsModal, {
          event: {
            ...baseEvent,
            conflictBadge: 'Spans preferred free day',
          },
          onClose: vi.fn(),
        })
      )
    );

    expect(html).toContain('CSE 101 - Algorithms');
    expect(html).toContain('Scheduling Conflict Note:');
    expect(html).toContain('Spans preferred free day');
    expect(html).toContain('⚠️');
  });

  it('renders joined conflict notes when conflictBadges array is present', () => {
    const html = cleanHtml(
      renderToString(
        React.createElement(CourseDetailsModal, {
          event: {
            ...baseEvent,
            conflictBadges: ['Spans preferred free day', 'Ends after preferred time'],
          },
          onClose: vi.fn(),
        })
      )
    );

    expect(html).toContain('Scheduling Conflict Note:');
    expect(html).toContain('Spans preferred free day, Ends after preferred time');
    expect(html).toContain('⚠️');
  });
});
