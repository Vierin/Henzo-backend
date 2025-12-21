import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { Response } from 'express';
import * as Sentry from '@sentry/node';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth(@Res() res: Response) {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: 'unknown' as 'ok' | 'error' | 'unknown',
      },
    };

    // Check database connection
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.checks.database = 'ok';
    } catch (error) {
      checks.checks.database = 'error';
      checks.status = 'degraded';
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(checks);
    }

    const statusCode =
      checks.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json(checks);
  }

  @Get('test-routes')
  testRoutes() {
    return {
      message: 'Routes are working',
      availableEndpoints: [
        '/health',
        '/auth/send-business-magic-link',
        '/auth/register',
      ],
    };
  }

  @Get('sentry-status')
  getSentryStatus() {
    const sentryDsn = process.env.SENTRY_DSN;
    const enableSentryInDev = process.env.ENABLE_SENTRY_IN_DEV;
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isSentryEnabled =
      sentryDsn && (nodeEnv !== 'development' || enableSentryInDev);

    return {
      sentry: {
        configured: !!sentryDsn,
        enabled: isSentryEnabled,
        environment: nodeEnv,
        devModeEnabled: !!enableSentryInDev,
      },
      message: isSentryEnabled
        ? 'Sentry is enabled and will capture errors'
        : sentryDsn
          ? 'Sentry is configured but disabled in development. Set ENABLE_SENTRY_IN_DEV=true to enable.'
          : 'Sentry is not configured. Set SENTRY_DSN to enable error tracking.',
    };
  }

  @Get('debug-sentry')
  async getError() {
    const sentryDsn = process.env.SENTRY_DSN;
    const enableSentryInDev = process.env.ENABLE_SENTRY_IN_DEV;
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isSentryEnabled =
      sentryDsn && (nodeEnv !== 'development' || enableSentryInDev);

    // Create a test error
    const error = new Error('My first Sentry error!');
    error.name = 'SentryTestError';

    // Capture exception manually if Sentry is enabled
    if (isSentryEnabled) {
      const eventId = Sentry.captureException(error, {
        tags: {
          test: 'debug-sentry',
          endpoint: '/debug-sentry',
          manual_capture: 'true',
        },
        extra: {
          timestamp: new Date().toISOString(),
          environment: nodeEnv,
          sentry_status: 'enabled',
        },
      });

      // Flush events immediately to ensure they're sent
      await Sentry.flush(2000); // Wait up to 2 seconds for events to be sent
    }

    // Throw it to test exception filter integration
    // The filter will also capture it if Sentry is enabled
    throw error;
  }
}
