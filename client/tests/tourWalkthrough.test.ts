import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TourWalkthrough, DASHBOARD_TOUR_STEPS } from '../src/components/dashboard/TourWalkthrough';

const cleanHtml = (html: string) => html.replace(/<!--.*?-->/g, '');

const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
});

describe('TourWalkthrough Component Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders null when isOpen is false', () => {
    const tour = new TourWalkthrough({ isOpen: false, onClose: vi.fn() });
    expect(tour.render()).toBeNull();
  });

  it('initializes at step 0 with Welcome step', () => {
    const tour = new TourWalkthrough({ isOpen: true, onClose: vi.fn() });
    expect(tour.state.currentStepIndex).toBe(0);

    const html = cleanHtml(renderToString(tour.render()));
    expect(html).toContain('Welcome to SlugSchedule!');
    expect(html).toContain('Step 1 of 6');
    expect(html).toContain('Dashboard Overview');
  });

  it('steps through sequence on Next and Back actions', () => {
    const tour = new TourWalkthrough({ isOpen: true, onClose: vi.fn() });

    // Step 0 -> Step 1
    tour.handleNext();
    expect(tour.state.currentStepIndex).toBe(1);
    let html = cleanHtml(renderToString(tour.render()));
    expect(html).toContain('Balanced Weekly Calendar Preview');
    expect(html).toContain('Step 2 of 6');

    // Step 1 -> Step 2
    tour.handleNext();
    expect(tour.state.currentStepIndex).toBe(2);
    html = cleanHtml(renderToString(tour.render()));
    expect(html).toContain('Prerequisite Hierarchy &amp; Degree Roadmap');

    // Step 2 -> Back to Step 1
    tour.handleBack();
    expect(tour.state.currentStepIndex).toBe(1);
  });

  it('renders Finish button on final step', () => {
    const tour = new TourWalkthrough({ isOpen: true, onClose: vi.fn() });
    tour.state = { currentStepIndex: DASHBOARD_TOUR_STEPS.length - 1 };

    const html = cleanHtml(renderToString(tour.render()));
    expect(html).toContain('Finish Tour 🚀');
    expect(html).toContain(`Step ${DASHBOARD_TOUR_STEPS.length} of ${DASHBOARD_TOUR_STEPS.length}`);
  });

  it('persists hasSeenDashboardTour in localStorage and calls onClose on Finish', () => {
    const onClose = vi.fn();
    const tour = new TourWalkthrough({ isOpen: true, onClose });

    tour.handleFinish();
    expect(localStorage.getItem('hasSeenDashboardTour')).toBe('true');
    expect(onClose).toHaveBeenCalled();
  });

  it('persists hasSeenDashboardTour in localStorage and calls onClose on Skip', () => {
    const onClose = vi.fn();
    const tour = new TourWalkthrough({ isOpen: true, onClose });

    tour.handleSkip();
    expect(localStorage.getItem('hasSeenDashboardTour')).toBe('true');
    expect(onClose).toHaveBeenCalled();
  });

  it('handles keyboard shortcuts Escape, ArrowRight, and ArrowLeft', () => {
    const onClose = vi.fn();
    const tour = new TourWalkthrough({ isOpen: true, onClose });

    // ArrowRight advances step
    tour.handleKeyDown({ key: 'ArrowRight' } as KeyboardEvent);
    expect(tour.state.currentStepIndex).toBe(1);

    // ArrowLeft moves back
    tour.handleKeyDown({ key: 'ArrowLeft' } as KeyboardEvent);
    expect(tour.state.currentStepIndex).toBe(0);

    // Escape skips tour
    tour.handleKeyDown({ key: 'Escape' } as KeyboardEvent);
    expect(onClose).toHaveBeenCalled();
  });

  it('ignores keyboard shortcuts when modal is not open', () => {
    const onClose = vi.fn();
    const tour = new TourWalkthrough({ isOpen: false, onClose });

    tour.handleKeyDown({ key: 'ArrowRight' } as KeyboardEvent);
    expect(tour.state.currentStepIndex).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });
});
