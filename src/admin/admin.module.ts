import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AnalyticsService } from './analytics.service';
import { PlatformMetricsService } from './platform-metrics.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [PrismaModule, AuthModule, ConfigModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AnalyticsService,
    PlatformMetricsService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AdminModule {}
