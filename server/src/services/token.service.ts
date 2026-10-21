import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';

export interface TokenPayload {
  userId: string;
  email: string;
  standing: string;
  name: string;
  jti?: string;
}

export class TokenService {
  static generateSessionToken(payload: TokenPayload): string {
    return jwt.sign(
      { ...payload, jti: uuidv4() },
      config.JWT_SECRET,
      {
        expiresIn: config.JWT_EXPIRES_IN as any,
        algorithm: 'HS256',
      }
    );
  }

  static verifyAndDecode(token: string): TokenPayload {
    return jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as TokenPayload;
  }
}
