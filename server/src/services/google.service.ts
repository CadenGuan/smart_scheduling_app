import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { userQueries } from '../db/queries/userQueries.js';
import { sessionQueries } from '../db/queries/sessionQueries.js';
import { progressQueries } from '../db/queries/progressQueries.js';
import { TokenService } from './token.service.js';
import { config } from '../config.js';

export interface GoogleAuthResult {
  user: {
    userId: string;
    email: string;
    name: string;
    standing: string;
    major: string;
  };
  token: string;
  googleCalendarLinked: boolean;
  onboardingCompleted: boolean;
}

export class GoogleAuthService {
  static async authenticate(idToken: string, isMock: boolean = false): Promise<GoogleAuthResult> {
    let email = 'sammy.slug@ucsc.edu';
    let name = 'Sammy Slug';

    if (isMock || !config.GOOGLE_CLIENT_ID) {
      if (idToken.includes('@')) {
        email = idToken.toLowerCase();
      }
    } else {
      try {
        const decoded: any = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf8'));
        if (decoded?.email) {
          email = decoded.email.toLowerCase();
          name = decoded.name || 'UCSC Student';
        }
      } catch {
        email = 'sammy.slug@ucsc.edu';
      }
    }

    let user = userQueries.findUserByEmail(email);
    let userId = user?.user_id;

    if (!user) {
      userId = uuidv4();
      userQueries.createUser({
        user_id: userId,
        email,
        password_hash: null,
        name,
        standing: 'Junior',
        major: 'Computer Science B.S.',
      });

      progressQueries.upsertProgress({
        user_id: userId,
        completed: 0,
        last_step: 1,
        skipped_steps: '[]',
        draft_answers: JSON.stringify({
          name,
          email,
          standing: 'Junior',
          major: 'Computer Science B.S.',
        }),
      });

      user = userQueries.findUserById(userId);
    }

    const tokenStmt = db.prepare(`
      INSERT INTO oauth_tokens (user_id, provider, access_token, refresh_token, scope, expires_at)
      VALUES (?, 'google', ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, oauth_tokens.refresh_token),
        updated_at = CURRENT_TIMESTAMP
    `);
    tokenStmt.run(
      userId!,
      `mock-google-access-token-${Date.now()}`,
      `mock-google-refresh-token-${Date.now()}`,
      'https://www.googleapis.com/auth/calendar.events.readonly',
      new Date(Date.now() + 3600 * 1000).toISOString()
    );

    const token = TokenService.generateSessionToken({
      userId: userId!,
      email: user!.email,
      standing: user!.standing,
      name: user!.name,
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    sessionQueries.createSession({
      session_id: uuidv4(),
      user_id: userId!,
      token,
      expires_at: expiresAt,
    });

    const progress = progressQueries.getProgress(userId!);

    return {
      user: {
        userId: userId!,
        email: user!.email,
        name: user!.name,
        standing: user!.standing,
        major: user!.major,
      },
      token,
      googleCalendarLinked: true,
      onboardingCompleted: progress?.completed === 1,
    };
  }
}
