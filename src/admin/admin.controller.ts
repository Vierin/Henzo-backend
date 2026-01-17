import {
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Query,
  Param,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { AnalyticsService } from './analytics.service';
import { PlatformMetricsService } from './platform-metrics.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
    private readonly analyticsService: AnalyticsService,
    private readonly platformMetricsService: PlatformMetricsService,
  ) {}

  @Get('dashboard')
  async getDashboard(
    @Headers('authorization') authHeader: string,
    @Query('period') period?: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

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
  async getAllSalons(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const salons = await this.adminService.getAllSalons();
      return salons;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get salons',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('bookings')
  async getAllBookings(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const bookings = await this.adminService.getAllBookings();
      return bookings;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get bookings',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('subscriptions')
  async getSubscriptions(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const subscriptions = await this.adminService.getSubscriptions();
      return subscriptions;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get subscriptions',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('sms-usage')
  async getSmsUsage(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const smsUsage = await this.adminService.getSmsUsage();
      return smsUsage;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get SMS usage',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('customers')
  async getCustomers(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const customers = await this.adminService.getCustomers();
      return customers;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get customers',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('analytics')
  async getAnalytics(
    @Headers('authorization') authHeader: string,
    @Query('period') period?: '7d' | '30d' | '90d',
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const analytics = await this.analyticsService.getAnalytics(
        period || '30d',
      );
      return analytics;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get analytics',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('platform-metrics')
  async getPlatformMetrics(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const metrics = await this.platformMetricsService.getPlatformMetrics();
      return metrics;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get platform metrics',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('structure')
  async getStructure(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const structure = await this.adminService.getStructure();
      return structure;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get structure',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('structure/service-category/:id')
  async getServiceCategoryDetails(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const serviceCategoryId = parseInt(id, 10);
      if (isNaN(serviceCategoryId)) {
        throw new HttpException('Invalid service category ID', HttpStatus.BAD_REQUEST);
      }

      const details = await this.adminService.getServiceCategoryDetails(serviceCategoryId);
      return details;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get service category details',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
