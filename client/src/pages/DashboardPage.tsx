import React from 'react';
import { BaseComponent } from '../components/base/BaseComponent';
import { Navbar } from '../components/layout/Navbar';
import { PreferencesModal } from '../components/layout/PreferencesModal';
import { AgentPlaceholder } from '../components/dashboard/AgentPlaceholder';
import { CalendarPreview } from '../components/dashboard/CalendarPreview';
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
  isLoading: boolean;
}

class DashboardPageComponent extends BaseComponent<WithRouterProps, DashboardState> {
  constructor(props: WithRouterProps) {
    super(props);
    this.state = {
      user: useAuthStore.getState().user,
      events: [],
      term: 'Winter 2027',
      totalCredits: 15,
      isPreferencesOpen: false,
      isLoading: true,
    };
  }

  async componentDidMount(): Promise<void> {
    super.componentDidMount();
    const currentUser = useAuthStore.getState().user;

    try {
      // 1. Fetch user profile
      if (currentUser?.userId) {
        const profile = await UserService.getProfile(currentUser.userId);
        this.safeSetState({ user: profile });
      }

      // 2. Fetch seeded calendar preview data
      const res = await apiClient.get<{ success: boolean; data: { term: string; totalCredits: number; events: CalendarEvent[] } }>(
        '/api/calendar/preview'
      );

      this.safeSetState({
        events: res.data.events,
        term: res.data.term,
        totalCredits: res.data.totalCredits,
        isLoading: false,
      });
    } catch {
      this.safeSetState({ isLoading: false });
    }
  }

  handleOpenPreferences = (): void => {
    this.safeSetState({ isPreferencesOpen: true });
  };

  handleClosePreferences = (): void => {
    this.safeSetState({ isPreferencesOpen: false });
  };

  handleSavePreferences = async (updates: Partial<UserProfile & { preferences: any }>): Promise<void> => {
    const { user } = this.state;
    if (!user?.userId) return;

    const updatedUser = await UserService.updateProfile(user.userId, updates);
    this.safeSetState({ user: updatedUser });
  };

  handleLogout = async (): Promise<void> => {
    await AuthService.logout();
    useAuthStore.getState().clearAuth();
    this.props.navigate('/login');
  };

  render() {
    const { user, events, term, isPreferencesOpen, isLoading } = this.state;

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-500 font-semibold text-sm">Loading your schedule dashboard...</div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <Navbar
          user={user}
          activeTerm={term}
          onOpenPreferences={this.handleOpenPreferences}
          onLogout={this.handleLogout}
        />

        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: SlugAgent Placeholder (38% ~ 5 columns on desktop) */}
          <div className="lg:col-span-5 h-[calc(100vh-112px)] min-h-[600px]">
            <AgentPlaceholder user={user} />
          </div>

          {/* Right Panel: Weekly Calendar Grid Preview (62% ~ 7 columns on desktop) */}
          <div className="lg:col-span-7 h-[calc(100vh-112px)] min-h-[600px]">
            <CalendarPreview events={events} term={term} />
          </div>
        </main>

        <PreferencesModal
          isOpen={isPreferencesOpen}
          user={user}
          onClose={this.handleClosePreferences}
          onSave={this.handleSavePreferences}
        />
      </div>
    );
  }
}

export const DashboardPage = withRouter(DashboardPageComponent);

