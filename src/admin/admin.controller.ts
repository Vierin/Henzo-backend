import {
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { AnalyticsService } from './analytics.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
    private readonly analyticsService: AnalyticsService,
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
}
