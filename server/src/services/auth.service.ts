import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { userQueries, UserRow } from '../db/queries/userQueries.js';
import { sessionQueries } from '../db/queries/sessionQueries.js';
import { progressQueries } from '../db/queries/progressQueries.js';
import { TokenService } from './token.service.js';
import { RegisterRequest, LoginRequest } from 'shared';

export interface AuthResult {
  user: {
    userId: string;
    email: string;
    name: string;
    standing: string;
    major: string;
    minor?: string | null;
    intendedMajor?: string | null;
  };
  token: string;
  onboardingCompleted: boolean;
}

export class AuthService {
  static async register(input: RegisterRequest): Promise<AuthResult> {
    const existing = userQueries.findUserByEmail(input.email);
    if (existing) {
      const err: any = new Error('An account with this email already exists.');
      err.statusCode = 409;
      err.code = 'EMAIL_ALREADY_REGISTERED';
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);
    const userId = uuidv4();

    userQueries.createUser({
      user_id: userId,
      email: input.email,
      password_hash: passwordHash,
      name: input.name,
      standing: input.standing,
      major: input.major,
    });

    // Initialize onboarding progress
    progressQueries.upsertProgress({
      user_id: userId,
      completed: 0,
      last_step: 1,
      skipped_steps: '[]',
      draft_answers: JSON.stringify({
        name: input.name,
        email: input.email,
        standing: input.standing,
        major: input.major,
      }),
    });

    const token = TokenService.generateSessionToken({
      userId,
      email: input.email,
      standing: input.standing,
      name: input.name,
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    sessionQueries.createSession({
      session_id: uuidv4(),
      user_id: userId,
      token,
      expires_at: expiresAt,
    });

    return {
      user: {
        userId,
        email: input.email,
        name: input.name,
        standing: input.standing,
        major: input.major,
      },
      token,
      onboardingCompleted: false,
    };
  }

  static async login(input: LoginRequest): Promise<AuthResult> {
    const user = userQueries.findUserByEmail(input.email);
    if (!user || !user.password_hash) {
      const err: any = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const isMatch = await bcrypt.compare(input.password, user.password_hash);
    if (!isMatch) {
      const err: any = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const token = TokenService.generateSessionToken({
      userId: user.user_id,
      email: user.email,
      standing: user.standing,
      name: user.name,
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    sessionQueries.createSession({
      session_id: uuidv4(),
      user_id: user.user_id,
      token,
      expires_at: expiresAt,
    });

    const progress = progressQueries.getProgress(user.user_id);

    return {
      user: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        standing: user.standing,
        major: user.major,
        minor: user.minor,
        intendedMajor: user.intended_major,
      },
      token,
      onboardingCompleted: progress?.completed === 1,
    };
  }

  static logout(token: string): void {
    sessionQueries.deleteSession(token);
  }
}

