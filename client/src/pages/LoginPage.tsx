import React from 'react';
import { BaseFormView, BaseFormState } from '../components/base/BaseFormView';
import { AuthService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { withRouter, WithRouterProps } from '../utils/withRouter';
import { Standing } from 'shared';

interface LoginState extends BaseFormState {
  isSignUp: boolean;
  email: string;
  password: string;
  name: string;
  standing: Standing;
  major: string;
  googleLoading: boolean;
  isGoogleHovered: boolean;
  isSubmitHovered: boolean;
}

class LoginPageComponent extends BaseFormView<WithRouterProps, LoginState> {
  constructor(props: WithRouterProps) {
    super(props);
    this.state = {
      isSignUp: false,
      email: '',
      password: '',
      name: '',
      standing: 'Junior',
      major: 'Computer Science B.S.',
      isSubmitting: false,
      googleLoading: false,
      isGoogleHovered: false,
      isSubmitHovered: false,
      errors: {},
    };
  }

  toggleMode = (): void => {
    this.safeSetState((prev) => ({
      isSignUp: !prev.isSignUp,
      errors: {},
    }));
  };

  handleGoogleAuthClick = async (): Promise<void> => {
    this.safeSetState({ googleLoading: true, errors: {} });
    try {
      const data = await AuthService.googleAuth({
        idToken: 'mock-google-token-slug@ucsc.edu',
        isMock: true,
      });

      useAuthStore.getState().setAuth(data.token, data.user);
      if (data.onboardingCompleted) {
        this.props.navigate('/dashboard');
      } else {
        this.props.navigate('/onboarding');
      }
    } catch (err: any) {
      this.setFieldError('general', err.message || 'Google Authentication failed');
    } finally {
      this.safeSetState({ googleLoading: false });
    }
  };

  handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    this.safeSetState({ isSubmitting: true, errors: {} });

    try {
      if (this.state.isSignUp) {
        const data = await AuthService.register({
          email: this.state.email,
          password: this.state.password,
          name: this.state.name,
          standing: this.state.standing,
          major: this.state.major,
        });
        useAuthStore.getState().setAuth(data.token, data.user);
        this.props.navigate('/onboarding');
      } else {
        const data = await AuthService.login({
          email: this.state.email,
          password: this.state.password,
        });
        useAuthStore.getState().setAuth(data.token, data.user);
        if (data.onboardingCompleted) {
          this.props.navigate('/dashboard');
        } else {
          this.props.navigate('/onboarding');
        }
      }
    } catch (err: any) {
      this.setFieldError('general', err.message || 'Authentication failed');
    } finally {
      this.safeSetState({ isSubmitting: false });
    }
  };

  render() {
    const { isSignUp, isSubmitting, googleLoading, isGoogleHovered, isSubmitHovered, errors } = this.state;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Header Bar */}
          <div className="bg-[#00B4DB] p-6 text-white text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-full mb-3 text-2xl font-bold">
              🐌
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Smart Scheduling App</h1>
            <p className="text-sm text-cyan-100 mt-1">UCSC Degree & Calendar Planner</p>
          </div>

          <div className="p-8">
            {/* General Error Alert */}
            {errors.general && (
              <div className="mb-4 p-3 rounded-lg bg-[#FFEBEB] text-[#FF6B6B] text-sm font-medium border border-[#FF6B6B]/20">
                {errors.general}
              </div>
            )}

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={this.handleGoogleAuthClick}
              onMouseEnter={() => this.safeSetState({ isGoogleHovered: true })}
              onMouseLeave={() => this.safeSetState({ isGoogleHovered: false })}
              disabled={googleLoading}
              className={`w-full py-2.5 px-4 mb-5 border-2 rounded-xl flex items-center justify-center gap-3 font-semibold text-sm transition-all duration-200 ${
                isGoogleHovered
                  ? 'border-[#F9CA24] bg-[#FFFDE7] text-slate-900 shadow-md scale-[1.01]'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              {googleLoading ? 'Connecting...' : 'Sign in with Google'}
            </button>

            <div className="relative flex py-2 items-center mb-6">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                or with email
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Email Form */}
            <form onSubmit={this.handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Sammy Slug"
                      value={this.state.name}
                      onChange={(e) => this.safeSetState({ name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4DB]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Standing
                      </label>
                      <select
                        value={this.state.standing}
                        onChange={(e) => this.safeSetState({ standing: e.target.value as Standing })}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4DB]"
                      >
                        <option value="Freshman">Freshman</option>
                        <option value="Sophomore">Sophomore</option>
                        <option value="Junior">Junior</option>
                        <option value="Senior">Senior</option>
                        <option value="Graduate">Graduate</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Major
                      </label>
                      <input
                        type="text"
                        required
                        value={this.state.major}
                        onChange={(e) => this.safeSetState({ major: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4DB]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="student@ucsc.edu"
                  value={this.state.email}
                  onChange={(e) => this.safeSetState({ email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4DB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={this.state.password}
                  onChange={(e) => this.safeSetState({ password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4DB]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                onMouseEnter={() => this.safeSetState({ isSubmitHovered: true })}
                onMouseLeave={() => this.safeSetState({ isSubmitHovered: false })}
                className={`w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition-all duration-200 ${
                  isSubmitHovered
                    ? 'bg-[#0098ba] shadow-[#00B4DB]/30 scale-[1.01]'
                    : 'bg-[#00B4DB]'
                }`}
              >
                {isSubmitting ? 'Processing...' : isSignUp ? 'Create Account' : 'Log In'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={this.toggleMode}
                className="text-xs text-slate-500 hover:text-[#00B4DB] font-medium transition-colors"
              >
                {isSignUp
                  ? 'Already have an account? Log in'
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export const LoginPage = withRouter(LoginPageComponent);

