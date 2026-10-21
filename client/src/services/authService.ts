import { apiClient } from './apiClient';
import {
  RegisterRequest,
  LoginRequest,
  GoogleAuthRequest,
  AuthResponse,
} from 'shared';

export class AuthService {
  static async register(data: RegisterRequest): Promise<AuthResponse['data']> {
    const res = await apiClient.post<AuthResponse>('/api/auth/register', data);
    return res.data;
  }

  static async login(data: LoginRequest): Promise<AuthResponse['data']> {
    const res = await apiClient.post<AuthResponse>('/api/auth/login', data);
    return res.data;
  }

  static async googleAuth(data: GoogleAuthRequest): Promise<AuthResponse['data']> {
    const res = await apiClient.post<AuthResponse>('/api/auth/google', data);
    return res.data;
  }

  static async logout(): Promise<void> {
    try {
      await apiClient.post('/api/auth/logout');
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
}

