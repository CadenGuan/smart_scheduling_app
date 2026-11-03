import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DeadlinesModal } from '../src/components/dashboard/DeadlinesModal';
import { CalendarService } from '../src/services/calendarService';
import { ConferenceDeadline } from 'shared';

const cleanHtml = (html: string) => html.replace(/<!--.*?-->/g, '');

const mockDeadlines: ConferenceDeadline[] = [
  {
    id: 'ucsc-urs-2027',
    name: 'UCSC Baskin Engineering Undergraduate Research Symposium (URS 2027)',
    abbreviation: 'UCSC URS 2027',
    tier: 'Undergraduate Showcase',
    submissionDeadline: '2027-05-15',
    notificationDate: '2027-05-28',
    conferenceDates: 'June 5, 2027',
    location: 'Baskin Engineering Courtyard, UC Santa Cruz',
    topics: ['Software Engineering', 'Systems'],
    websiteUrl: 'https://undergrad.soe.ucsc.edu/symposium',
    description: 'Premier showcase for undergraduate engineering.',
    daysUntilDeadline: 42,
    status: 'UPCOMING',
  },
  {
    id: 'osdi-2027',
    name: 'USENIX Symposium on Operating Systems Design and Implementation (OSDI 2027)',
    abbreviation: 'OSDI 2027',
    tier: 'Top Tier',
    submissionDeadline: '2027-05-07',
    notificationDate: '2027-06-25',
    conferenceDates: 'July 12-14, 2027',
    location: 'Seattle, Washington',
    topics: ['Systems', 'Distributed Systems'],
    websiteUrl: 'https://www.usenix.org/conference/osdi27',
    description: 'Highest impact systems research venue.',
    daysUntilDeadline: 10,
    status: 'URGENT',
  },
];

describe('DeadlinesModal Component Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isOpen is false', () => {
    const modal = new DeadlinesModal({ isOpen: false, onClose: vi.fn() });
    expect(modal.render()).toBeNull();
  });

  it('initializes with default state values', () => {
    const modal = new DeadlinesModal({ isOpen: true, onClose: vi.fn() });
    expect(modal.state.selectedTier).toBe('ALL');
    expect(modal.state.selectedTopic).toBe('ALL');
    expect(modal.state.isLoading).toBe(true);
    expect(modal.state.isExporting).toBe(false);
  });

  it('fetches conference deadlines from CalendarService and updates state', async () => {
    vi.spyOn(CalendarService, 'getConferenceDeadlines').mockResolvedValue({
      totalCount: 2,
      deadlines: mockDeadlines,
      topics: ['Software Engineering', 'Systems'],
    });

    const modal = new DeadlinesModal({ isOpen: true, onClose: vi.fn() });
    await modal.loadDeadlines();

    expect(CalendarService.getConferenceDeadlines).toHaveBeenCalled();
    expect(modal.state.deadlines).toHaveLength(2);
    expect(modal.state.topics).toContain('Software Engineering');
    expect(modal.state.topics).toContain('Systems');
    expect(modal.state.isLoading).toBe(false);
  });

  it('renders header, tier filters, topic dropdown, and conference cards', () => {
    const modal = new DeadlinesModal({ isOpen: true, onClose: vi.fn() });
    modal.state = {
      deadlines: mockDeadlines,
      topics: ['Software Engineering', 'Systems'],
      totalCount: 2,
      selectedTopic: 'ALL',
      selectedTier: 'ALL',
      isLoading: false,
      isExporting: false,
      error: null,
    };

    const html = cleanHtml(renderToString(modal.render()));

    // Header & Subtitles
    expect(html).toContain('CS Research &amp; Conference Deadlines');
    expect(html).toContain('Export to .ics');

    // Tier Filters
    expect(html).toContain('All Tiers');
    expect(html).toContain('Undergraduate Showcase');
    expect(html).toContain('Top Tier');

    // Topic Dropdown
    expect(html).toContain('All Topics (2)');
    expect(html).toContain('Software Engineering');

    // Conference cards
    expect(html).toContain('UCSC Baskin Engineering Undergraduate Research Symposium');
    expect(html).toContain('42 Days Left');
    expect(html).toContain('USENIX Symposium on Operating Systems Design and Implementation');
    expect(html).toContain('10 Days Left');
  });

  it('handles empty state when no deadlines match filter', () => {
    const modal = new DeadlinesModal({ isOpen: true, onClose: vi.fn() });
    modal.state = {
      deadlines: [],
      topics: ['Systems'],
      totalCount: 0,
      selectedTopic: 'ALL',
      selectedTier: 'ALL',
      isLoading: false,
      isExporting: false,
      error: null,
    };

    const html = cleanHtml(renderToString(modal.render()));
    expect(html).toContain('No conference deadlines match your selected filters.');
  });

  it('handles error state gracefully', () => {
    const modal = new DeadlinesModal({ isOpen: true, onClose: vi.fn() });
    modal.state = {
      deadlines: [],
      topics: [],
      totalCount: 0,
      selectedTopic: 'ALL',
      selectedTier: 'ALL',
      isLoading: false,
      isExporting: false,
      error: 'Network connection failed',
    };

    const html = cleanHtml(renderToString(modal.render()));
    expect(html).toContain('Network connection failed');
  });

  it('invokes exportDeadlinesIcs when Export button is clicked', async () => {
    vi.spyOn(CalendarService, 'exportDeadlinesIcs').mockResolvedValue('BEGIN:VCALENDAR...');
    vi.spyOn(CalendarService, 'downloadIcs').mockImplementation(() => {});

    const modal = new DeadlinesModal({ isOpen: true, onClose: vi.fn() });
    modal.state = {
      deadlines: mockDeadlines,
      topics: ['Systems'],
      totalCount: 2,
      selectedTopic: 'ALL',
      selectedTier: 'ALL',
      isLoading: false,
      isExporting: false,
      error: null,
    };

    await modal.handleExportAll();
    expect(CalendarService.exportDeadlinesIcs).toHaveBeenCalledWith('ALL', 'ALL');
    expect(CalendarService.downloadIcs).toHaveBeenCalledWith(
      'BEGIN:VCALENDAR...',
      'ucsc-cs-conference-deadlines.ics'
    );
  });
});
