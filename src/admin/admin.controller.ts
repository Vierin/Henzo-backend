import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { AnalyticsService } from './analytics.service';
import { PlatformMetricsService } from './platform-metrics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
    private readonly analyticsService: AnalyticsService,
    private readonly platformMetricsService: PlatformMetricsService,
  ) {}

  @Get('dashboard')
  async getDashboard(@Query('period') period?: string) {
    try {
      const dashboard = await this.adminService.getDashboardStats(
        period || '30d',
      );
      return dashboard;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get dashboard data',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('salons')
  async getAllSalons(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      return await this.adminService.getAllSalons({
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get salons',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('bookings')
  async getAllBookings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    try {
      return await this.adminService.getAllBookings({
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        status,
        search,
        sortBy,
        sortOrder,
      });
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get bookings',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('subscriptions')
  async getSubscriptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      return await this.adminService.getSubscriptions({
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get subscriptions',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('sms-usage')
  async getSmsUsage() {
    try {
      return await this.adminService.getSmsUsage();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get SMS usage',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('customers')
  async getCustomers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      return await this.adminService.getCustomers({
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get customers',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('analytics')
  async getAnalytics(@Query('period') period?: '7d' | '30d' | '90d') {
    try {
      return await this.analyticsService.getAnalytics(period || '30d');
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get analytics',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('platform-metrics')
  async getPlatformMetrics() {
    try {
      return await this.platformMetricsService.getPlatformMetrics();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get platform metrics',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('structure')
  async getStructure() {
    try {
      return await this.adminService.getStructure();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get structure',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('structure/service-category/:id')
  async getServiceCategoryDetails(@Param('id') id: string) {
    try {
      const serviceCategoryId = parseInt(id, 10);
      if (isNaN(serviceCategoryId)) {
        throw new HttpException(
          'Invalid service category ID',
          HttpStatus.BAD_REQUEST,
        );
      }
      return await this.adminService.getServiceCategoryDetails(
        serviceCategoryId,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get service category details',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
