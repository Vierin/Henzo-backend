import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 60000, // 1 minute
            limit: 100, // 100 requests per minute for public endpoints
          },
          {
            name: 'medium',
            ttl: 600000, // 10 minutes
            limit: 1000, // 1000 requests per 10 minutes for authenticated users
          },
          {
            name: 'long',
            ttl: 3600000, // 1 hour
            limit: 5000, // 5000 requests per hour
          },
        ],
        // Using in-memory storage (sufficient for MVP)
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppThrottlerModule {}

