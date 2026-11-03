import React from 'react';
import { BaseComponent } from '../components/base/BaseComponent';
import { Navbar } from '../components/layout/Navbar';
import { PreferencesModal } from '../components/layout/PreferencesModal';
import { AgentWorkspace } from '../components/dashboard/AgentWorkspace';
import { CalendarPreview } from '../components/dashboard/CalendarPreview';
import { TourWalkthrough } from '../components/dashboard/TourWalkthrough';
import { apiClient } from '../services/apiClient';
import { UserService } from '../services/userService';
import { AuthService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { withRouter, WithRouterProps } from '../utils/withRouter';
import { CalendarEvent, UserProfile } from 'shared';

interface DashboardState {
  user: UserProfile | null;
  events: CalendarEvent[];
  term: string;
  totalCredits: number;
  isPreferencesOpen: boolean;
  isTourOpen: boolean;
  isLoading: boolean;
}

export class DashboardPageComponent extends BaseComponent<WithRouterProps, DashboardState> {
  constructor(props: WithRouterProps) {
    super(props);
    this.state = {
      user: useAuthStore.getState().user,
      events: [],
      term: 'Winter 2027',
      totalCredits: 15,
      isPreferencesOpen: false,
      isTourOpen: false,
      isLoading: true,
    };
  }

  async componentDidMount(): Promise<void> {
    super.componentDidMount();
    const currentUser = useAuthStore.getState().user;

    if (typeof localStorage !== 'undefined' && !localStorage.getItem('hasSeenDashboardTour')) {
      this.safeSetState({ isTourOpen: true });
    }

    try {
      // 1. Fetch user profile
      if (currentUser?.userId) {
        const profile = await UserService.getProfile(currentUser.userId);
        this.safeSetState({ user: profile });
      }

      // 2. Fetch seeded calendar preview data
      const res = await apiClient.get<{
        success: boolean;
        data: { term: string; totalCredits: number; events: CalendarEvent[] };
      }>('/api/calendar/preview');

      this.safeSetState({
        events: res?.data?.events || [],
        term: res?.data?.term || 'Winter 2027',
        totalCredits: res?.data?.totalCredits ?? 15,
        isLoading: false,
      });
    } catch (error: any) {
      if (error?.statusCode === 401) {
        useAuthStore.getState().clearAuth();
        this.props.navigate('/login');
        return;
      }
      this.safeSetState({ isLoading: false });
    }
  }

  handleOpenPreferences = (): void => {
    this.safeSetState({ isPreferencesOpen: true });
  };

  handleClosePreferences = (): void => {
    this.safeSetState({ isPreferencesOpen: false });
  };

  handleStartTour = (): void => {
    this.safeSetState({ isTourOpen: true });
  };

  handleCloseTour = (): void => {
    this.safeSetState({ isTourOpen: false });
  };

  handleRefreshSchedule = async (): Promise<void> => {
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: { term: string; totalCredits: number; events: CalendarEvent[] };
      }>('/api/calendar/preview');
      this.safeSetState({
        events: res.data.events,
        term: res.data.term,
        totalCredits: res.data.totalCredits,
      });
    } catch {
      // Graceful fallback
    }
  };

  handleSavePreferences = async (
    updates: Partial<UserProfile & { preferences: any }>
  ): Promise<void> => {
    const { user } = this.state;
    if (!user?.userId) return;

    const updatedUser = await UserService.updateProfile(user.userId, updates);

    // Re-fetch dynamically recalculated schedule
    const res = await apiClient.get<{
      success: boolean;
      data: { term: string; totalCredits: number; events: CalendarEvent[] };
    }>('/api/calendar/preview');

    const currentToken = useAuthStore.getState().token;
    if (currentToken && updatedUser) {
      useAuthStore.getState().setAuth(currentToken, updatedUser);
    }

    this.safeSetState({
      user: updatedUser,
      events: res.data.events,
      term: res.data.term,
      totalCredits: res.data.totalCredits,
      isPreferencesOpen: false,
    });
  };

  handleLogout = async (): Promise<void> => {
    await AuthService.logout();
    useAuthStore.getState().clearAuth();
    this.props.navigate('/login');
  };

  render() {
    const { user, events, term, totalCredits, isPreferencesOpen, isTourOpen, isLoading } =
      this.state;

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-500 font-semibold text-sm">
            Loading your schedule dashboard...
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <Navbar
          user={user}
          activeTerm={term}
          totalCredits={totalCredits}
          onOpenPreferences={this.handleOpenPreferences}
          onLogout={this.handleLogout}
          onStartTour={this.handleStartTour}
        />

        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: SlugAgent Workspace (38% ~ 5 columns on desktop) */}
          <div
            data-tour="agent-workspace"
            className="lg:col-span-5 h-[calc(100vh-112px)] min-h-[600px]"
          >
            <AgentWorkspace user={user} onScheduleUpdated={this.handleRefreshSchedule} />
          </div>

          {/* Right Panel: Weekly Calendar Grid Preview (62% ~ 7 columns on desktop) */}
          <div
            data-tour="calendar-preview"
            className="lg:col-span-7 h-[calc(100vh-112px)] min-h-[600px]"
          >
            <CalendarPreview events={events} term={term} />
          </div>
        </main>

        <PreferencesModal
          isOpen={isPreferencesOpen}
          user={user}
          onClose={this.handleClosePreferences}
          onSave={this.handleSavePreferences}
        />

        <TourWalkthrough isOpen={isTourOpen} onClose={this.handleCloseTour} />
      </div>
    );
  }
}

export const DashboardPage = withRouter(DashboardPageComponent);
