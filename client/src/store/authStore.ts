import { create } from 'zustand';
import { UserProfile } from 'shared';

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: UserProfile) => void;
  clearAuth: () => void;
}

const getStoredToken = () => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('token');
};

const getStoredUser = () => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  token: getStoredToken(),
  user: getStoredUser(),
  isAuthenticated: !!getStoredToken(),

  setAuth: (token: string, user: UserProfile) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }
    set({ token, user, isAuthenticated: true });
  },

  clearAuth: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
