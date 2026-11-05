import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

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

import { DashboardPageComponent } from '../src/pages/DashboardPage';
import { apiClient } from '../src/services/apiClient';
import { UserService } from '../src/services/userService';
import { AuthService } from '../src/services/authService';
import { useAuthStore } from '../src/store/authStore';
import { UserProfile, CalendarEvent } from 'shared';

const mockUser: UserProfile = {
  userId: '11111111-1111-1111-1111-111111111111',
  email: 'sammy@ucsc.edu',
  name: 'Sammy Slug',
  standing: 'Junior',
  major: 'Computer Science B.S.',
  minor: null,
};

const mockEvents: CalendarEvent[] = [
  {
    id: 'cse101',
    title: 'CSE 101 - Algorithms',
    type: 'MAJOR',
    days: ['Monday', 'Wednesday', 'Friday'],
    startTime: '10:00',
    endTime: '11:05',
    color: '#00B4DB',
    credits: 5,
  },
  {
    id: 'cse115a',
    title: 'CSE 115A - Software Engineering',
    type: 'MAJOR',
    days: ['Tuesday', 'Thursday'],
    startTime: '13:30',
    endTime: '15:05',
    color: '#00B4DB',
    credits: 5,
    conflictBadge: 'Spans preferred free day',
  },
];

describe('Dashboard Integration Test Suite (Ticket 05)', () => {
  let navigateMock: any;

  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().clearAuth();
    vi.restoreAllMocks();
    navigateMock = vi.fn();
  });

  describe('componentDidMount Data Hydration', () => {
    it('fetches profile and calendar preview on mount when user is authenticated', async () => {
      useAuthStore.getState().setAuth('test-token', mockUser);

      vi.spyOn(UserService, 'getProfile').mockResolvedValue({
        ...mockUser,
        preferences: {
          targetTerm: 'Winter 2027',
          targetCredits: 15,
          earliestStartTime: '09:00',
          latestEndTime: '17:00',
          preferredFreeDays: [],
          maxBackToBackHours: 3,
        },
        geStatus: null,
        majorRequirementsTaken: [],
      });

      vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: {
          term: 'Winter 2027',
          totalCredits: 15,
          events: mockEvents,
        },
      } as any);

      const dashboard = new DashboardPageComponent({
        navigate: navigateMock,
        location: { pathname: '/dashboard' } as any,
        params: {},
      });

      await dashboard.componentDidMount();

      expect(UserService.getProfile).toHaveBeenCalledWith(mockUser.userId);
      expect(apiClient.get).toHaveBeenCalledWith('/api/calendar/preview');
      expect(dashboard.state.user?.name).toBe('Sammy Slug');
      expect(dashboard.state.term).toBe('Winter 2027');
      expect(dashboard.state.totalCredits).toBe(15);
      expect(dashboard.state.events).toHaveLength(2);
      expect(dashboard.state.isLoading).toBe(false);
    });

    it('handles calendar preview fetch errors gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('Network error'));

      const dashboard = new DashboardPageComponent({
        navigate: navigateMock,
        location: { pathname: '/dashboard' } as any,
        params: {},
      });

      await dashboard.componentDidMount();

      expect(dashboard.state.isLoading).toBe(false);
    });
  });

  describe('handleSavePreferences Real-Time Update Flow', () => {
    it('persists preferences and triggers immediate /api/calendar/preview recalculation', async () => {
      useAuthStore.getState().setAuth('auth-token-123', mockUser);

      const updatedUser: UserProfile = {
        ...mockUser,
        standing: 'Senior',
        preferences: {
          targetTerm: 'Spring 2027',
          targetCredits: 20,
          earliestStartTime: '08:00',
          latestEndTime: '18:00',
          preferredFreeDays: ['Friday'],
          maxBackToBackHours: 2,
        },
      };

      const recalculatedEvents: CalendarEvent[] = [
        ...mockEvents,
        {
          id: 'cse130',
          title: 'CSE 130 - Principles of Computer Systems Design',
          type: 'MAJOR',
          days: ['Monday', 'Wednesday'],
          startTime: '14:00',
          endTime: '15:45',
          color: '#00B4DB',
          credits: 5,
        },
        {
          id: 'ge101',
          title: 'HAVC 10 - Intro to Visual Culture',
          type: 'GE',
          days: ['Friday'],
          startTime: '09:00',
          endTime: '10:00',
          color: '#FF6B6B',
          credits: 5,
          conflictBadge: 'Spans preferred free day',
        },
      ];

      vi.spyOn(UserService, 'updateProfileWithSync').mockResolvedValue({ profile: updatedUser });
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: {
          term: 'Spring 2027',
          totalCredits: 20,
          events: recalculatedEvents,
        },
      } as any);

      const dashboard = new DashboardPageComponent({
        navigate: navigateMock,
        location: { pathname: '/dashboard' } as any,
        params: {},
      });

      dashboard.state = {
        ...dashboard.state,
        user: mockUser,
        term: 'Winter 2027',
        totalCredits: 10,
        events: mockEvents,
      };

      const updatePayload = {
        standing: 'Senior' as const,
        major: 'Computer Science B.S.',
        preferences: {
          targetTerm: 'Spring 2027' as const,
          targetCredits: 20,
          preferredFreeDays: ['Friday' as const],
        },
      };

      await dashboard.handleSavePreferences(updatePayload);

      // 1. Verify the profile update was called with user ID and payload
      expect(UserService.updateProfileWithSync).toHaveBeenCalledWith(
        mockUser.userId,
        updatePayload
      );

      // 2. Verify immediate re-fetch of preview
      expect(apiClient.get).toHaveBeenCalledWith('/api/calendar/preview');

      // 3. Verify state synchronization
      expect(dashboard.state.user).toEqual(updatedUser);
      expect(dashboard.state.term).toBe('Spring 2027');
      expect(dashboard.state.totalCredits).toBe(20);
      expect(dashboard.state.events).toHaveLength(4);

      // 4. Verify authStore is kept in sync
      expect(useAuthStore.getState().user).toEqual(updatedUser);
    });

    it('returns without action if user has no userId', async () => {
      const updateProfileSpy = vi.spyOn(UserService, 'updateProfileWithSync');
      const getSpy = vi.spyOn(apiClient, 'get');

      const dashboard = new DashboardPageComponent({
        navigate: navigateMock,
        location: { pathname: '/dashboard' } as any,
        params: {},
      });

      dashboard.state = {
        ...dashboard.state,
        user: null,
      };

      await dashboard.handleSavePreferences({ standing: 'Junior' });

      expect(updateProfileSpy).not.toHaveBeenCalled();
      expect(getSpy).not.toHaveBeenCalled();
    });

    describe('agent hand-off after saving preferences', () => {
      const preview = {
        success: true,
        data: { term: 'Spring 2027', totalCredits: 0, events: [] },
      } as any;

      function makeDashboardWithWorkspace() {
        const dashboard = new DashboardPageComponent({
          navigate: navigateMock,
          location: { pathname: '/dashboard' } as any,
          params: {},
        });
        dashboard.state = { ...dashboard.state, user: mockUser };
        const workspace = {
          requestScheduleRebuild: vi.fn().mockResolvedValue(undefined),
          reloadMessages: vi.fn().mockResolvedValue(undefined),
        };
        (dashboard as any).agentWorkspaceRef = { current: workspace };
        return { dashboard, workspace };
      }

      const pivot = (overrides: object) => ({
        isMacroPivot: true,
        isInitialSetup: false,
        changes: [{ field: 'targetTerm' as const, from: 'Winter 2027', to: 'Spring 2027' }],
        clearedPinnedCourses: false,
        requiresAgentRegeneration: false,
        ...overrides,
      });

      it('asks the agent to rebuild when the server says the schedule needs regenerating', async () => {
        // Arrange
        const { dashboard, workspace } = makeDashboardWithWorkspace();
        const schedulePivot = pivot({ requiresAgentRegeneration: true });
        vi.spyOn(UserService, 'updateProfileWithSync').mockResolvedValue({
          profile: mockUser,
          schedulePivot,
        });
        vi.spyOn(apiClient, 'get').mockResolvedValue(preview);

        // Act
        await dashboard.handleSavePreferences({ preferences: { targetTerm: 'Spring 2027' } });

        // Assert
        expect(workspace.requestScheduleRebuild).toHaveBeenCalledWith(schedulePivot);
        expect(workspace.reloadMessages).not.toHaveBeenCalled();
      });

      it('only refreshes chat history when the server already rebuilt the schedule (mock mode)', async () => {
        // Arrange
        const { dashboard, workspace } = makeDashboardWithWorkspace();
        vi.spyOn(UserService, 'updateProfileWithSync').mockResolvedValue({
          profile: mockUser,
          schedulePivot: pivot({}),
        });
        vi.spyOn(apiClient, 'get').mockResolvedValue(preview);

        // Act
        await dashboard.handleSavePreferences({ preferences: { targetTerm: 'Spring 2027' } });

        // Assert
        expect(workspace.reloadMessages).toHaveBeenCalled();
        expect(workspace.requestScheduleRebuild).not.toHaveBeenCalled();
      });

      it('leaves the agent alone for soft adjustments', async () => {
        // Arrange
        const { dashboard, workspace } = makeDashboardWithWorkspace();
        vi.spyOn(UserService, 'updateProfileWithSync').mockResolvedValue({
          profile: mockUser,
          schedulePivot: pivot({ isMacroPivot: false, changes: [] }),
        });
        vi.spyOn(apiClient, 'get').mockResolvedValue(preview);

        // Act
        await dashboard.handleSavePreferences({ preferences: { preferredFreeDays: ['Friday'] } });

        // Assert
        expect(workspace.reloadMessages).not.toHaveBeenCalled();
        expect(workspace.requestScheduleRebuild).not.toHaveBeenCalled();
      });
    });
  });

  describe('Modal and Navigation Handlers', () => {
    it('opens and closes preferences modal', () => {
      const dashboard = new DashboardPageComponent({
        navigate: navigateMock,
        location: { pathname: '/dashboard' } as any,
        params: {},
      });

      expect(dashboard.state.isPreferencesOpen).toBe(false);

      dashboard.handleOpenPreferences();
      expect(dashboard.state.isPreferencesOpen).toBe(true);

      dashboard.handleClosePreferences();
      expect(dashboard.state.isPreferencesOpen).toBe(false);
    });

    it('handles logout by calling AuthService, clearing auth store, and navigating to /login', async () => {
      useAuthStore.getState().setAuth('token', mockUser);
      vi.spyOn(AuthService, 'logout').mockResolvedValue();

      const dashboard = new DashboardPageComponent({
        navigate: navigateMock,
        location: { pathname: '/dashboard' } as any,
        params: {},
      });

      await dashboard.handleLogout();

      expect(AuthService.logout).toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(navigateMock).toHaveBeenCalledWith('/login');
    });
  });

  describe('Dashboard Layout & Metrics Rendering', () => {
    it('renders loading placeholder when isLoading is true', () => {
      const dashboard = new DashboardPageComponent({
        navigate: navigateMock,
        location: { pathname: '/dashboard' } as any,
        params: {},
      });
      dashboard.state = {
        ...dashboard.state,
        isLoading: true,
      };

      const html = cleanHtml(renderToString(dashboard.render()));
      expect(html).toContain('Loading your schedule dashboard...');
    });

    it('renders synchronized Navbar metrics, AgentPlaceholder, and CalendarPreview when loaded', () => {
      const dashboard = new DashboardPageComponent({
        navigate: navigateMock,
        location: { pathname: '/dashboard' } as any,
        params: {},
      });
      dashboard.state = {
        ...dashboard.state,
        isLoading: false,
        user: mockUser,
        term: 'Spring 2027',
        totalCredits: 20,
        events: mockEvents,
      };

      const html = cleanHtml(renderToString(dashboard.render()));

      // Navbar synchronization
      expect(html).toContain('Target: Spring 2027');
      expect(html).toContain('20 Credits');
      expect(html).toContain('Edit Preferences');

      // SlugAgent Student snapshot
      expect(html).toContain('SlugAgent Advisor');
      expect(html).toContain('Junior • Computer Science B.S.');

      // Calendar preview
      expect(html).toContain('Weekly Schedule Preview');
      expect(html).toContain('CSE 101 - Algorithms');
      expect(html).toContain('CSE 115A - Software Engineering');
      expect(html).toContain('Spans preferred free day');
      expect(html).toContain('Export .ics');
    });

    it('handleCalendarUpdate synchronizes calendar events, term, and credits immediately without page reload', () => {
      const dashboard = new DashboardPageComponent({
        navigate: navigateMock,
        location: { pathname: '/dashboard' } as any,
        params: {},
      });
      dashboard.state = {
        ...dashboard.state,
        isLoading: false,
        user: mockUser,
        term: 'Winter 2027',
        totalCredits: 15,
        events: mockEvents,
      };

      const newEvents: CalendarEvent[] = [
        {
          id: 'cse130',
          title: 'CSE 130 - Computer Systems',
          type: 'MAJOR',
          days: ['Tuesday', 'Thursday'],
          startTime: '10:00',
          endTime: '11:45',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
          conflictBadge: 'Time conflict with another course',
        },
      ];

      dashboard.handleCalendarUpdate({
        term: 'Spring 2027',
        totalCredits: 10,
        events: newEvents,
      });

      expect(dashboard.state.term).toBe('Spring 2027');
      expect(dashboard.state.totalCredits).toBe(10);
      expect(dashboard.state.events).toHaveLength(1);
      expect(dashboard.state.events[0].id).toBe('cse130');
      expect(dashboard.state.events[0].pinned).toBe(true);

      const html = cleanHtml(renderToString(dashboard.render()));
      expect(html).toContain('CSE 130 - Computer Systems');
      expect(html).toContain('Time conflict with another course');
      expect(html).toContain('Target: Spring 2027');
      expect(html).toContain('10 Credits');
    });
  });
});
