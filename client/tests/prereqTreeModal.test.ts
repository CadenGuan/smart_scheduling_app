import { describe, it, expect, vi, beforeEach } from 'vitest';
import _React from 'react';
import { renderToString } from 'react-dom/server';
import { PrereqTreeModal } from '../src/components/dashboard/PrereqTreeModal';
import { CalendarService } from '../src/services/calendarService';
import { CurriculumNode } from 'shared';

const cleanHtml = (html: string) => html.replace(/<!--.*?-->/g, '');

const mockNodes: CurriculumNode[] = [
  {
    code: 'MATH 19A',
    title: 'Calculus I',
    credits: 5,
    level: 'LOWER',
    status: 'COMPLETED',
    prerequisites: [],
    unmetPrerequisites: [],
    tier: 1,
  },
  {
    code: 'CSE 20',
    title: 'Beginning Python',
    credits: 5,
    level: 'LOWER',
    status: 'READY_TO_ENROLL',
    prerequisites: [],
    unmetPrerequisites: [],
    tier: 1,
  },
  {
    code: 'CSE 101',
    title: 'Data Structures and Algorithms',
    credits: 5,
    level: 'UPPER',
    status: 'LOCKED',
    prerequisites: ['CSE 13S', 'CSE 16'],
    unmetPrerequisites: ['CSE 13S', 'CSE 16'],
    tier: 3,
  },
];

const mockDagData = {
  major: 'Computer Science B.S.',
  totalCoreCount: 18,
  completedCount: 1,
  progressPercentage: 6,
  nodes: mockNodes,
  edges: [
    ['CSE 13S', 'CSE 101'],
    ['CSE 16', 'CSE 101'],
  ] as Array<[string, string]>,
  readyToEnroll: ['CSE 20'],
};

describe('PrereqTreeModal Component Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isOpen is false', () => {
    const modal = new PrereqTreeModal({ isOpen: false, onClose: vi.fn() });
    expect(modal.render()).toBeNull();
  });

  it('initializes with default state values', () => {
    const modal = new PrereqTreeModal({ isOpen: true, onClose: vi.fn() });
    expect(modal.state.activeTier).toBe('ALL');
    expect(modal.state.selectedCode).toBeNull();
    expect(modal.state.isLoading).toBe(true);
  });

  it('fetches curriculum data on mount and updates state', async () => {
    vi.spyOn(CalendarService, 'getCurriculumDag').mockResolvedValue(mockDagData as any);

    const modal = new PrereqTreeModal({ isOpen: true, onClose: vi.fn() });
    await modal.loadCurriculum();

    expect(CalendarService.getCurriculumDag).toHaveBeenCalled();
    expect(modal.state.nodes).toHaveLength(3);
    expect(modal.state.completedCount).toBe(1);
    expect(modal.state.progressPercentage).toBe(6);
    expect(modal.state.isLoading).toBe(false);
  });

  it('renders progress bar, tier tabs, and node cards when loaded', () => {
    const modal = new PrereqTreeModal({ isOpen: true, onClose: vi.fn() });
    modal.state = {
      nodes: mockNodes,
      edges: [['CSE 13S', 'CSE 101']] as Array<[string, string]>,
      major: 'Computer Science B.S.',
      totalCoreCount: 18,
      completedCount: 1,
      progressPercentage: 6,
      readyToEnroll: ['CSE 20'],
      selectedCode: null,
      activeTier: 'ALL',
      isLoading: false,
      error: null,
    };

    const html = cleanHtml(renderToString(modal.render()));

    // Header & Subtitles
    expect(html).toContain('Degree Roadmap &amp; Prerequisite Hierarchy');
    expect(html).toContain('Computer Science B.S.');
    expect(html).toContain('6% Completed');

    // Status Counters
    expect(html).toContain('1 Met');
    expect(html).toContain('Ready');
    expect(html).toContain('Locked');

    // Tier Tabs
    expect(html).toContain('All Tiers (18)');
    expect(html).toContain('Tier 1');
    expect(html).toContain('Tier 3');

    // Course Cards
    expect(html).toContain('MATH 19A');
    expect(html).toContain('Calculus I');
    expect(html).toContain('Completed');

    expect(html).toContain('CSE 20');
    expect(html).toContain('Beginning Python');
    expect(html).toContain('Ready to Enroll');

    expect(html).toContain('CSE 101');
    expect(html).toContain('Data Structures and Algorithms');
    expect(html).toContain('Locked');
    expect(html).toContain('Missing: CSE 13S, CSE 16');
  });

  it('renders bottom course inspector when a course is selected', () => {
    const modal = new PrereqTreeModal({ isOpen: true, onClose: vi.fn() });
    modal.state = {
      nodes: mockNodes,
      edges: [['CSE 20', 'CSE 30']] as Array<[string, string]>,
      major: 'Computer Science B.S.',
      totalCoreCount: 18,
      completedCount: 1,
      progressPercentage: 6,
      readyToEnroll: ['CSE 20'],
      selectedCode: 'CSE 20',
      activeTier: 'ALL',
      isLoading: false,
      error: null,
    };

    const html = cleanHtml(renderToString(modal.render()));
    expect(html).toContain('Close Inspector');
    expect(html).toContain(
      'All prerequisites satisfied! You can add this course to your schedule for next quarter.'
    );
    expect(html).toContain('Directly unlocks: `CSE 30`');
  });

  it('handles course selection toggle', () => {
    const modal = new PrereqTreeModal({ isOpen: true, onClose: vi.fn() });
    modal.handleSelectCourse('CSE 101');
    expect(modal.state.selectedCode).toBe('CSE 101');

    // Clicking same course again deselects it
    modal.handleSelectCourse('CSE 101');
    expect(modal.state.selectedCode).toBeNull();
  });

  it('renders error alert when loading fails', () => {
    const modal = new PrereqTreeModal({ isOpen: true, onClose: vi.fn() });
    modal.state = {
      ...modal.state,
      isLoading: false,
      error: 'Network connection failed.',
    };

    const html = renderToString(modal.render());
    expect(html).toContain('Network connection failed.');
    expect(html).toContain('⚠️');
  });
});
