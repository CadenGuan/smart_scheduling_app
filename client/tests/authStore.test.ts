import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../src/store/authStore';

// Mock localStorage for Node test environment if not present
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

describe('Client Auth Store', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().clearAuth();
  });

  it('initializes with unauthenticated status', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('updates state and storage on setAuth', () => {
    const dummyUser = {
      userId: 'test-user-123',
      email: 'slug@ucsc.edu',
      name: 'Sammy Slug',
      standing: 'Senior',
      major: 'Computer Science B.S.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    useAuthStore.getState().setAuth('mock-token-xyz', dummyUser);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('mock-token-xyz');
    expect(state.user?.email).toBe('slug@ucsc.edu');
    expect(localStorage.getItem('token')).toBe('mock-token-xyz');
  });

  it('clears state and storage on clearAuth', () => {
    useAuthStore.getState().setAuth('mock-token-xyz', {
      userId: 'test-user-123',
      email: 'slug@ucsc.edu',
      name: 'Sammy Slug',
      standing: 'Senior',
      major: 'Computer Science B.S.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});

