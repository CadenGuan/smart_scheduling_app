import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PreferencesModal } from '../src/components/layout/PreferencesModal';
import { UserProfile, UserPreferences } from 'shared';

const cleanHtml = (html: string) => html.replace(/<!--.*?-->/g, '');

const mockUser: UserProfile & { preferences: UserPreferences } = {
  userId: '11111111-1111-1111-1111-111111111111',
  email: 'slug@ucsc.edu',
  name: 'Sammy Slug',
  standing: 'Junior',
  major: 'Computer Science B.S.',
  minor: 'TIM',
  preferences: {
    targetTerm: 'Winter 2027',
    targetCredits: 15,
    earliestStartTime: '09:00',
    latestEndTime: '17:00',
    preferredFreeDays: ['Friday'],
    maxBackToBackHours: 3,
  },
};

describe('PreferencesModal Component Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State & Props Synchronization', () => {
    it('initializes state with user profile and preferences values', () => {
      const onClose = vi.fn();
      const onSave = vi.fn();

      const modal = new PreferencesModal({
        isOpen: true,
        user: mockUser,
        onClose,
        onSave,
      });

      expect(modal.state.standing).toBe('Junior');
      expect(modal.state.major).toBe('Computer Science B.S.');
      expect(modal.state.minor).toBe('TIM');
      expect(modal.state.targetTerm).toBe('Winter 2027');
      expect(modal.state.targetCredits).toBe(15);
      expect(modal.state.earliestStartTime).toBe('09:00');
      expect(modal.state.latestEndTime).toBe('17:00');
      expect(modal.state.preferredFreeDays).toEqual(['Friday']);
      expect(modal.state.maxBackToBackHours).toBe(3);
      expect(modal.state.validationError).toBeNull();
      expect(modal.state.isSaving).toBe(false);
    });

    it('falls back to default values when user or preferences are empty', () => {
      const modal = new PreferencesModal({
        isOpen: true,
        user: null,
        onClose: vi.fn(),
        onSave: vi.fn(),
      });

      expect(modal.state.standing).toBe('Junior');
      expect(modal.state.major).toBe('Computer Science B.S.');
      expect(modal.state.minor).toBe('');
      expect(modal.state.targetTerm).toBe('Winter 2027');
      expect(modal.state.targetCredits).toBe(15);
      expect(modal.state.earliestStartTime).toBe('09:00');
      expect(modal.state.latestEndTime).toBe('17:00');
      expect(modal.state.preferredFreeDays).toEqual([]);
      expect(modal.state.maxBackToBackHours).toBe(3);
    });

    it('updates internal state when props.user changes in componentDidUpdate', () => {
      const modal = new PreferencesModal({
        isOpen: true,
        user: mockUser,
        onClose: vi.fn(),
        onSave: vi.fn(),
      });

      const updatedUser: UserProfile & { preferences: UserPreferences } = {
        ...mockUser,
        standing: 'Senior',
        major: 'Cognitive Science B.S.',
        minor: 'Philosophy',
        preferences: {
          targetTerm: 'Spring 2027',
          targetCredits: 19,
          earliestStartTime: '10:00',
          latestEndTime: '16:00',
          preferredFreeDays: ['Monday', 'Wednesday'],
          maxBackToBackHours: 2,
        },
      };

      Object.defineProperty(modal, 'props', {
        value: {
          isOpen: true,
          user: updatedUser,
          onClose: vi.fn(),
          onSave: vi.fn(),
        },
        writable: true,
      });

      modal.componentDidUpdate({
        isOpen: true,
        user: mockUser,
        onClose: vi.fn(),
        onSave: vi.fn(),
      });

      expect(modal.state.standing).toBe('Senior');
      expect(modal.state.major).toBe('Cognitive Science B.S.');
      expect(modal.state.minor).toBe('Philosophy');
      expect(modal.state.targetTerm).toBe('Spring 2027');
      expect(modal.state.targetCredits).toBe(19);
      expect(modal.state.earliestStartTime).toBe('10:00');
      expect(modal.state.latestEndTime).toBe('16:00');
      expect(modal.state.preferredFreeDays).toEqual(['Monday', 'Wednesday']);
      expect(modal.state.maxBackToBackHours).toBe(2);
    });
  });

  describe('handleDayToggle', () => {
    it('adds a day to preferredFreeDays if not present and removes it if present', () => {
      const modal = new PreferencesModal({
        isOpen: true,
        user: mockUser,
        onClose: vi.fn(),
        onSave: vi.fn(),
      });

      expect(modal.state.preferredFreeDays).toEqual(['Friday']);

      // Add Monday
      modal.handleDayToggle('Monday');
      expect(modal.state.preferredFreeDays).toEqual(['Friday', 'Monday']);

      // Remove Friday
      modal.handleDayToggle('Friday');
      expect(modal.state.preferredFreeDays).toEqual(['Monday']);

      // Toggle Monday back off
      modal.handleDayToggle('Monday');
      expect(modal.state.preferredFreeDays).toEqual([]);
    });
  });

  describe('Validation & Submission', () => {
    it('flags an error and prevents saving if earliestStartTime > latestEndTime', async () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      const modal = new PreferencesModal({
        isOpen: true,
        user: mockUser,
        onClose,
        onSave,
      });

      modal.state = {
        ...modal.state,
        earliestStartTime: '16:00',
        latestEndTime: '10:00',
      };

      const preventDefault = vi.fn();
      await modal.handleSave({ preventDefault } as any);

      expect(preventDefault).toHaveBeenCalled();
      expect(modal.state.validationError).toBe(
        'Earliest start time must not be later than latest end time.'
      );
      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('submits atomic updates and closes modal on valid input', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      const modal = new PreferencesModal({
        isOpen: true,
        user: mockUser,
        onClose,
        onSave,
      });

      modal.state = {
        ...modal.state,
        standing: 'Senior',
        major: 'Computer Science B.S.',
        minor: 'Robotics',
        targetTerm: 'Spring 2027',
        targetCredits: 18,
        earliestStartTime: '08:00',
        latestEndTime: '18:00',
        preferredFreeDays: ['Tuesday', 'Thursday'],
        maxBackToBackHours: 4,
      };

      const preventDefault = vi.fn();
      await modal.handleSave({ preventDefault } as any);

      expect(onSave).toHaveBeenCalledWith({
        standing: 'Senior',
        major: 'Computer Science B.S.',
        minor: 'Robotics',
        preferences: {
          targetTerm: 'Spring 2027',
          targetCredits: 18,
          earliestStartTime: '08:00',
          latestEndTime: '18:00',
          preferredFreeDays: ['Tuesday', 'Thursday'],
          maxBackToBackHours: 4,
        },
      });

      expect(modal.state.validationError).toBeNull();
      expect(modal.state.isSaving).toBe(false);
      expect(onClose).toHaveBeenCalled();
    });

    it('converts empty string minor to null when saving', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const modal = new PreferencesModal({
        isOpen: true,
        user: mockUser,
        onClose: vi.fn(),
        onSave,
      });

      modal.state = {
        ...modal.state,
        minor: '',
      };

      await modal.handleSave({ preventDefault: vi.fn() } as any);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          minor: null,
        })
      );
    });

    it('displays error and halts spinner if onSave rejects', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Network failure'));
      const onClose = vi.fn();

      const modal = new PreferencesModal({
        isOpen: true,
        user: mockUser,
        onClose,
        onSave,
      });

      await modal.handleSave({ preventDefault: vi.fn() } as any);

      expect(modal.state.validationError).toBe('Network failure');
      expect(modal.state.isSaving).toBe(false);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('displays generic error message if error object lacks message', async () => {
      const onSave = vi.fn().mockRejectedValue({});
      const modal = new PreferencesModal({
        isOpen: true,
        user: mockUser,
        onClose: vi.fn(),
        onSave,
      });

      await modal.handleSave({ preventDefault: vi.fn() } as any);

      expect(modal.state.validationError).toBe(
        'Failed to update preferences. Please check your inputs.'
      );
    });
  });

  describe('HTML Rendering & Layout Sections', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToString(
        React.createElement(PreferencesModal, {
          isOpen: false,
          user: mockUser,
          onClose: vi.fn(),
          onSave: vi.fn(),
        })
      );

      expect(html).toBe('');
    });

    it('renders all three sections when isOpen is true', () => {
      const html = cleanHtml(
        renderToString(
          React.createElement(PreferencesModal, {
            isOpen: true,
            user: mockUser,
            onClose: vi.fn(),
            onSave: vi.fn(),
          })
        )
      );

      // Header
      expect(html).toContain('Refine Degree &amp; Scheduling Preferences');

      // Section 1: Academic Profile
      expect(html).toContain('Section 1: Academic Profile');
      expect(html).toContain('Class Standing');
      expect(html).toContain('Declared Major');
      expect(html).toContain('Minor (Optional)');

      // Section 2: Quarter Capacity
      expect(html).toContain('Section 2: Quarter Capacity');
      expect(html).toContain('Target Quarter Term');
      expect(html).toContain('Target Unit Load');
      expect(html).toContain('15 Credits');
      expect(html).toContain('type="range"');
      expect(html).toContain('min="10"');
      expect(html).toContain('max="20"');

      // Section 3: Time & Day Constraints
      expect(html).toContain('Section 3: Time &amp; Day Constraints');
      expect(html).toContain('Earliest Class Start');
      expect(html).toContain('Latest Class End');
      expect(html).toContain('Preferred Free Days');
      expect(html).toContain('Friday');
      expect(html).toContain('Max Back-to-Back Hours');

      // Buttons
      expect(html).toContain('Cancel');
      expect(html).toContain('Save Changes');
    });

    it('renders validation error banner when validationError is present in state', () => {
      const modal = new PreferencesModal({
        isOpen: true,
        user: mockUser,
        onClose: vi.fn(),
        onSave: vi.fn(),
      });
      modal.state = {
        ...modal.state,
        validationError: 'Earliest start time must not be later than latest end time.',
      };

      const html = renderToString(modal.render());
      expect(html).toContain('Earliest start time must not be later than latest end time.');
      expect(html).toContain('⚠️');
    });

    it('renders loading spinner and disabled state when isSaving is true', () => {
      const modal = new PreferencesModal({
        isOpen: true,
        user: mockUser,
        onClose: vi.fn(),
        onSave: vi.fn(),
      });
      modal.state = {
        ...modal.state,
        isSaving: true,
      };

      const html = renderToString(modal.render());
      expect(html).toContain('Saving Changes...');
      expect(html).toContain('disabled=""');
      expect(html).toContain('animate-spin');
    });
  });
});
