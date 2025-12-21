import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { Response } from 'express';

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
}
