import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
const jwksRsa = require('jwks-rsa');

interface DecodedToken {
  sub: string; // user id
  email?: string;
  app_metadata?: {
    role?: string;
  };
  user_metadata?: {
    role?: string;
    name?: string;
    full_name?: string;
    phone?: string;
  };
  exp: number;
  iat: number;
  iss: string;
}

@Injectable()
export class JwtVerifierService implements OnModuleInit {
  private jwksClient: any; // jwks-rsa client
  private supabaseUrl: string;
  private jwtSecret: string | null = null;

  constructor(private configService: ConfigService) {
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
  }

  async onModuleInit() {
    // Инициализация JWKS клиента для автоматической загрузки публичных ключей
    this.jwksClient = jwksRsa({
      jwksUri: `${this.supabaseUrl}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 86400000, // 24 часа
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });

    // Попытка получить JWT secret из конфига (если есть)
    // Supabase использует свой собственный секрет, но можно попробовать использовать его
    this.jwtSecret = this.configService.get<string>('SUPABASE_JWT_SECRET') || null;
  }

  /**
   * Получить ключ для верификации JWT
   */
  private getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
    if (!header.kid) {
      callback(new Error('No kid in header'));
      return;
    }

    this.jwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) {
        callback(err);
        return;
      }
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    });
  };

  /**
   * Верифицировать JWT токен локально (без сетевых запросов)
   * Использует JWKS для автоматической загрузки публичных ключей
   */
  async verifyToken(token: string): Promise<DecodedToken> {
    try {
      // Supabase использует RS256 алгоритм для подписи JWT
      const decoded = await new Promise<DecodedToken>((resolve, reject) => {
        jwt.verify(
          token,
          this.getKey,
          {
            algorithms: ['RS256'],
            issuer: `${this.supabaseUrl}/auth/v1`,
          },
          (err, decoded) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(decoded as DecodedToken);
          },
        );
      });

      // Проверка срока действия токена
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }

      return decoded;
    } catch (error: any) {
      // Если локальная верификация не удалась, пробрасываем ошибку
      // Вызывающий код может использовать fallback на Supabase API
      throw new Error(`JWT verification failed: ${error.message}`);
    }
  }

  /**
   * Декодировать JWT без верификации (для отладки)
   */
  decodeToken(token: string): DecodedToken | null {
    try {
      return jwt.decode(token) as DecodedToken;
    } catch (error) {
      return null;
    }
  }

  /**
   * Получить роль из токена
   */
  getRoleFromToken(token: DecodedToken): string | null {
    return token.app_metadata?.role || token.user_metadata?.role || null;
  }

  /**
   * Получить email из токена
   */
  getEmailFromToken(token: DecodedToken): string | null {
    return token.email || null;
  }

  /**
   * Получить user ID из токена
   */
  getUserIdFromToken(token: DecodedToken): string {
    return token.sub;
  }
}

