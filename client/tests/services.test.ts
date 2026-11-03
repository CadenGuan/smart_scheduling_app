import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { apiClient, ApiError } from '../src/services/apiClient';
import { UserService } from '../src/services/userService';
import { AuthService } from '../src/services/authService';
import { ProgressService } from '../src/services/progressService';
import { AgentService } from '../src/services/agentService';
import { CalendarService } from '../src/services/calendarService';

describe('Client Services & ApiClient Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('ApiClient', () => {
    it('sends Authorization header when token is stored', async () => {
      localStorage.setItem('token', 'test-token-123');

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: 'test-data' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const data = await apiClient.get('/api/test');
      expect(data).toEqual({ success: true, data: 'test-data' });
      expect(fetchMock).toHaveBeenCalledWith('/api/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token-123',
        },
      });
    });

    it('omits Authorization header when token is missing', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await apiClient.get('/api/test');
      expect(fetchMock).toHaveBeenCalledWith('/api/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('handles post, put, and delete with and without bodies', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await apiClient.post('/api/test', { key: 'val' });
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ key: 'val' }),
        })
      );

      await apiClient.put('/api/test');
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'PUT',
          body: undefined,
        })
      );

      await apiClient.delete('/api/test');
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('throws ApiError when response is not ok', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Bad Request Payload' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(apiClient.get('/api/fail')).rejects.toThrow(ApiError);
    });

    it('handles non-JSON error responses gracefully', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Not JSON');
        },
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(apiClient.get('/api/crash')).rejects.toThrow('Request failed');
    });

    it('getText retrieves plain text / ics responses', async () => {
      const mockIcs = 'BEGIN:VCALENDAR\nEND:VCALENDAR';
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockIcs,
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await apiClient.getText('/api/calendar/export');
      expect(res).toBe(mockIcs);
    });
  });

  describe('UserService', () => {
    it('calls getProfile and returns profile data', async () => {
      const mockProfile = { userId: 'u1', name: 'Slug' };
      vi.spyOn(apiClient, 'get').mockResolvedValue({ success: true, data: mockProfile } as any);

      const res = await UserService.getProfile('u1');
      expect(res).toEqual(mockProfile);
      expect(apiClient.get).toHaveBeenCalledWith('/api/users/u1');
    });

    it('calls updateProfile and returns updated user', async () => {
      const mockUpdated = { userId: 'u1', standing: 'Senior' };
      vi.spyOn(apiClient, 'put').mockResolvedValue({ success: true, data: mockUpdated } as any);

      const res = await UserService.updateProfile('u1', { standing: 'Senior' });
      expect(res).toEqual(mockUpdated);
      expect(apiClient.put).toHaveBeenCalledWith('/api/users/u1', { standing: 'Senior' });
    });

    it('calls getPreferences and returns preferences object', async () => {
      const mockPref = { targetTerm: 'Fall 2026', targetCredits: 15 };
      vi.spyOn(apiClient, 'get').mockResolvedValue({ success: true, data: mockPref } as any);

      const res = await UserService.getPreferences('u1');
      expect(res).toEqual(mockPref);
      expect(apiClient.get).toHaveBeenCalledWith('/api/users/u1/preferences');
    });

    it('calls updatePreferences and returns updated preferences', async () => {
      const mockPref = { targetTerm: 'Winter 2027', targetCredits: 18 };
      vi.spyOn(apiClient, 'put').mockResolvedValue({ success: true, data: mockPref } as any);

      const res = await UserService.updatePreferences('u1', { targetCredits: 18 });
      expect(res).toEqual(mockPref);
      expect(apiClient.put).toHaveBeenCalledWith('/api/users/u1/preferences', {
        targetCredits: 18,
      });
    });

    it('calls exportSettings and importSettings', async () => {
      const mockExportData = { version: '1.0', profile: { name: 'Slug' } };
      vi.spyOn(apiClient, 'get').mockResolvedValue({ success: true, data: mockExportData } as any);
      vi.spyOn(apiClient, 'post').mockResolvedValue({ success: true, data: mockExportData } as any);

      const exported = await UserService.exportSettings('u1');
      expect(exported).toEqual(mockExportData);
      expect(apiClient.get).toHaveBeenCalledWith('/api/users/u1/export');

      const imported = await UserService.importSettings('u1', mockExportData);
      expect(imported).toEqual(mockExportData);
      expect(apiClient.post).toHaveBeenCalledWith('/api/users/u1/import', mockExportData);
    });

    it('downloadJson handles safe execution when globals are undefined or defined', () => {
      expect(() => UserService.downloadJson({ test: true }, 'test.json')).not.toThrow();

      const clickSpy = vi.fn();
      const appendChildSpy = vi.fn();
      const removeChildSpy = vi.fn();
      const createObjectURL = vi.fn().mockReturnValue('blob:test');
      const revokeObjectURL = vi.fn();

      vi.stubGlobal('window', {
        URL: { createObjectURL, revokeObjectURL },
      });
      vi.stubGlobal('document', {
        body: { appendChild: appendChildSpy, removeChild: removeChildSpy },
        createElement: vi
          .fn()
          .mockReturnValue({ click: clickSpy, set href(v: string) {}, set download(v: string) {} }),
      });

      UserService.downloadJson({ foo: 'bar' }, 'settings.json');
      expect(clickSpy).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');

      vi.unstubAllGlobals();
    });
  });

  describe('AuthService', () => {
    it('calls register, login, and googleAuth', async () => {
      const mockAuthRes = { token: 't1', user: { userId: 'u1' } };
      vi.spyOn(apiClient, 'post').mockResolvedValue({ success: true, data: mockAuthRes } as any);

      const reg = await AuthService.register({
        email: 'a@ucsc.edu',
        password: 'Pass',
        name: 'A',
        standing: 'Junior',
        major: 'CS',
      });
      expect(reg).toEqual(mockAuthRes);

      const log = await AuthService.login({ email: 'a@ucsc.edu', password: 'Pass' });
      expect(log).toEqual(mockAuthRes);

      const g = await AuthService.googleAuth({ idToken: 'id-token' });
      expect(g).toEqual(mockAuthRes);

      vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: { configured: true, url: 'https://accounts.google.com' },
      } as any);
      const urlRes = await AuthService.getGoogleAuthUrl();
      expect(urlRes.configured).toBe(true);
      expect(urlRes.url).toBe('https://accounts.google.com');

      const codeRes = await AuthService.exchangeGoogleCode('code-123');
      expect(codeRes).toEqual(mockAuthRes);
    });

    it('logout calls API and cleans up localStorage', async () => {
      localStorage.setItem('token', 't1');
      localStorage.setItem('user', '{}');

      vi.spyOn(apiClient, 'post').mockResolvedValue({ success: true } as any);

      await AuthService.logout();

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  describe('ProgressService', () => {
    it('calls getProgress and saveProgress', async () => {
      const mockProgress = { userId: 'u1', completed: false, lastStep: 2 };
      vi.spyOn(apiClient, 'get').mockResolvedValue({ success: true, data: mockProgress } as any);
      vi.spyOn(apiClient, 'put').mockResolvedValue({ success: true, data: mockProgress } as any);

      const getRes = await ProgressService.getProgress('u1');
      expect(getRes).toEqual(mockProgress);

      const saveRes = await ProgressService.saveProgress('u1', { completed: true, lastStep: 3 });
      expect(saveRes).toEqual(mockProgress);
    });
  });

  describe('AgentService', () => {
    it('sendMessage, getMessages, and clearMessages call corresponding endpoints', async () => {
      const mockChatRes = {
        userMessage: {
          messageId: 'u1',
          userId: 'u1',
          sender: 'USER' as const,
          content: 'Hi',
          createdAt: 'now',
        },
        agentMessage: {
          messageId: 'a1',
          userId: 'u1',
          sender: 'AGENT' as const,
          content: 'Hey',
          createdAt: 'now',
        },
      };
      const mockMessages = [mockChatRes.userMessage, mockChatRes.agentMessage];

      vi.spyOn(apiClient, 'post').mockResolvedValue({ success: true, data: mockChatRes } as any);
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: { messages: mockMessages },
      } as any);
      vi.spyOn(apiClient, 'delete').mockResolvedValue({ success: true, message: 'Cleared' } as any);

      const chatData = await AgentService.sendMessage('Hi');
      expect(chatData).toEqual(mockChatRes);
      expect(apiClient.post).toHaveBeenCalledWith('/api/agent/chat', { prompt: 'Hi' });

      const messages = await AgentService.getMessages();
      expect(messages).toEqual(mockMessages);
      expect(apiClient.get).toHaveBeenCalledWith('/api/agent/messages');

      await AgentService.clearMessages();
      expect(apiClient.delete).toHaveBeenCalledWith('/api/agent/messages');
    });
  });

  describe('CalendarService', () => {
    it('exportCalendarIcs calls /api/calendar/export and returns ICS text', async () => {
      const mockIcs = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
      vi.spyOn(apiClient, 'getText').mockResolvedValue(mockIcs);

      const ics = await CalendarService.exportCalendarIcs();
      expect(ics).toBe(mockIcs);
      expect(apiClient.getText).toHaveBeenCalledWith('/api/calendar/export');
    });

    it('downloadIcs returns safely when window or document is undefined', () => {
      expect(() => CalendarService.downloadIcs('test')).not.toThrow();
    });

    it('downloadIcs creates and triggers download anchor when window/document are defined', () => {
      const clickSpy = vi.fn();
      const appendChildSpy = vi.fn();
      const removeChildSpy = vi.fn();
      const createObjectURL = vi.fn().mockReturnValue('blob:test');
      const revokeObjectURL = vi.fn();

      vi.stubGlobal('window', {
        URL: { createObjectURL, revokeObjectURL },
      });
      vi.stubGlobal('document', {
        body: { appendChild: appendChildSpy, removeChild: removeChildSpy },
        createElement: vi
          .fn()
          .mockReturnValue({ click: clickSpy, set href(v: string) {}, set download(v: string) {} }),
      });

      CalendarService.downloadIcs('BEGIN:VCALENDAR\nEND:VCALENDAR', 'test.ics');
      expect(clickSpy).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');

      vi.unstubAllGlobals();
    });
  });
});
