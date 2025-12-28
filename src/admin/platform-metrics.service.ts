import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

interface DatabaseMetrics {
  activeConnections: number;
  maxConnections: number;
  connectionPoolUsage: number;
  databaseSize: string;
  databaseSizeBytes: number;
  databaseSizeLimit: number; // in bytes (500MB for free tier)
  databaseSizePercent: number;
}

interface BackendMetrics {
  memoryUsageMB: number;
  memoryLimitMB: number;
  memoryUsagePercent: number;
  cpuUsagePercent: number | null; // null if not available
  requestsPerMinute: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
}

interface EmailMetrics {
  sentToday: number;
  dailyLimit: number;
  usagePercent: number;
  remainingToday: number;
  sentThisMonth: number;
  monthlyLimit: number;
  monthlyUsagePercent: number;
}

interface InfrastructureCosts {
  digitalOcean: {
    estimatedMonthly: number;
    plan: string;
  };
  supabase: {
    estimatedMonthly: number;
    plan: string;
  };
  vercel: {
    estimatedMonthly: number;
    plan: string;
  };
  brevo: {
    estimatedMonthly: number;
    plan: string;
  };
  total: number;
}

export interface PlatformMetrics {
  database: DatabaseMetrics;
  backend: BackendMetrics;
  email: EmailMetrics;
  infrastructure: InfrastructureCosts;
  alerts: Array<{
    type: 'warning' | 'critical';
    message: string;
    metric: string;
  }>;
  timestamp: string;
}

@Injectable()
export class PlatformMetricsService {
  private requestCounts: Map<number, number> = new Map(); // timestamp -> count
  private responseTimes: number[] = [];
  private errorCounts: Map<number, number> = new Map();
  private startTime: number = Date.now();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Clean up old request counts every minute
    setInterval(() => this.cleanupOldMetrics(), 60000);
  }

  private cleanupOldMetrics() {
    const oneMinuteAgo = Date.now() - 60000;
    for (const [timestamp] of this.requestCounts) {
      if (timestamp < oneMinuteAgo) {
        this.requestCounts.delete(timestamp);
      }
    }
    for (const [timestamp] of this.errorCounts) {
      if (timestamp < oneMinuteAgo) {
        this.errorCounts.delete(timestamp);
      }
    }
    // Keep only last 100 response times
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-100);
    }
  }

  recordRequest(responseTime: number, isError: boolean = false) {
    const now = Math.floor(Date.now() / 1000) * 1000; // Round to nearest second
    this.requestCounts.set(now, (this.requestCounts.get(now) || 0) + 1);
    this.responseTimes.push(responseTime);
    if (isError) {
      this.errorCounts.set(now, (this.errorCounts.get(now) || 0) + 1);
    }
    this.cleanupOldMetrics();
  }

  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      // Get active connections
      const activeConnectionsResult = await this.prisma.$queryRaw<
        Array<{ count: number }>
      >`SELECT count(*)::int as count FROM pg_stat_activity WHERE datname = current_database() AND state = 'active'`;

      const activeConnections = activeConnectionsResult[0]?.count || 0;

      // Get max connections from database (Supabase free tier: 15, Pro: 200)
      // We'll use a reasonable default and allow override via env
      const maxConnections =
        parseInt(this.configService.get<string>('DB_MAX_CONNECTIONS') || '0') ||
        (activeConnections > 15 ? 200 : 15); // Guess based on current usage

      const connectionPoolUsage =
        maxConnections > 0 ? (activeConnections / maxConnections) * 100 : 0;

      // Get database size
      const sizeResult = await this.prisma.$queryRaw<
        Array<{ size: string; size_bytes: number }>
      >`SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database())::bigint as size_bytes`;

      const databaseSize = sizeResult[0]?.size || '0 bytes';
      const databaseSizeBytes = sizeResult[0]?.size_bytes || 0;

      // Supabase free tier: 500MB, Pro: 8GB+
      const databaseSizeLimit = 500 * 1024 * 1024; // 500MB default (free tier)
      const databaseSizePercent =
        databaseSizeLimit > 0
          ? (databaseSizeBytes / databaseSizeLimit) * 100
          : 0;

      return {
        activeConnections,
        maxConnections,
        connectionPoolUsage,
        databaseSize,
        databaseSizeBytes,
        databaseSizeLimit,
        databaseSizePercent,
      };
    } catch (error) {
      console.error('Error getting database metrics:', error);
      return {
        activeConnections: 0,
        maxConnections: 15,
        connectionPoolUsage: 0,
        databaseSize: 'Unknown',
        databaseSizeBytes: 0,
        databaseSizeLimit: 500 * 1024 * 1024,
        databaseSizePercent: 0,
      };
    }
  }

  async getBackendMetrics(): Promise<BackendMetrics> {
    try {
      // Get memory usage (Node.js process)
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

      // Memory limit: 1GB = 1024MB (DigitalOcean Basic plan)
      const memoryLimitMB = parseInt(
        this.configService.get<string>('MEMORY_LIMIT_MB') || '1024',
      );
      const memoryUsagePercent =
        memoryLimitMB > 0 ? (memoryUsageMB / memoryLimitMB) * 100 : 0;

      // CPU usage - not directly available in Node.js without external tools
      // We'll return null and frontend can show "N/A"
      const cpuUsagePercent = null;

      // Calculate requests per minute
      const oneMinuteAgo = Date.now() - 60000;
      let requestsInLastMinute = 0;
      for (const [timestamp, count] of this.requestCounts) {
        if (timestamp >= oneMinuteAgo) {
          requestsInLastMinute += count;
        }
      }

      // Calculate average response time
      const avgResponseTime =
        this.responseTimes.length > 0
          ? this.responseTimes.reduce((a, b) => a + b, 0) /
            this.responseTimes.length
          : 0;

      // Calculate error rate
      let errorsInLastMinute = 0;
      for (const [timestamp, count] of this.errorCounts) {
        if (timestamp >= oneMinuteAgo) {
          errorsInLastMinute += count;
        }
      }
      const errorRate =
        requestsInLastMinute > 0
          ? (errorsInLastMinute / requestsInLastMinute) * 100
          : 0;

      // Uptime in seconds
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);

      return {
        memoryUsageMB,
        memoryLimitMB,
        memoryUsagePercent,
        cpuUsagePercent,
        requestsPerMinute: requestsInLastMinute,
        averageResponseTime: Math.round(avgResponseTime),
        errorRate: Math.round(errorRate * 100) / 100,
        uptime,
      };
    } catch (error) {
      console.error('Error getting backend metrics:', error);
      return {
        memoryUsageMB: 0,
        memoryLimitMB: 1024,
        memoryUsagePercent: 0,
        cpuUsagePercent: null,
        requestsPerMinute: 0,
        averageResponseTime: 0,
        errorRate: 0,
        uptime: 0,
      };
    }
  }

  async getEmailMetrics(): Promise<EmailMetrics> {
    try {
      const brevoApiKey = this.configService.get<string>('BREVO_API_KEY');
      if (!brevoApiKey) {
        return {
          sentToday: 0,
          dailyLimit: 300,
          usagePercent: 0,
          remainingToday: 300,
          sentThisMonth: 0,
          monthlyLimit: 9000, // 300 * 30
          monthlyUsagePercent: 0,
        };
      }

      // Get email stats from Brevo API
      try {
        const response = await fetch('https://api.brevo.com/v3/account', {
          headers: {
            Accept: 'application/json',
            'api-key': brevoApiKey,
          },
        });

        if (response.ok) {
          const accountData = await response.json();

          // Try to get email statistics
          // Note: Brevo API might require different endpoint for detailed stats
          // For now, we'll estimate based on common free tier limits
          const dailyLimit = 300; // Brevo free tier: 300/day
          const sentToday = 0; // Would need to track this or use Brevo stats API
          const remainingToday = Math.max(0, dailyLimit - sentToday);
          const usagePercent = (sentToday / dailyLimit) * 100;

          // Monthly limits
          const monthlyLimit = dailyLimit * 30; // 9000
          const sentThisMonth = 0; // Would need tracking
          const monthlyUsagePercent = (sentThisMonth / monthlyLimit) * 100;

          return {
            sentToday,
            dailyLimit,
            usagePercent,
            remainingToday,
            sentThisMonth,
            monthlyLimit,
            monthlyUsagePercent,
          };
        }
      } catch (error) {
        console.error('Error fetching Brevo metrics:', error);
      }

      // Fallback: return default values
      return {
        sentToday: 0,
        dailyLimit: 300,
        usagePercent: 0,
        remainingToday: 300,
        sentThisMonth: 0,
        monthlyLimit: 9000,
        monthlyUsagePercent: 0,
      };
    } catch (error) {
      console.error('Error getting email metrics:', error);
      return {
        sentToday: 0,
        dailyLimit: 300,
        usagePercent: 0,
        remainingToday: 300,
        sentThisMonth: 0,
        monthlyLimit: 9000,
        monthlyUsagePercent: 0,
      };
    }
  }

  getInfrastructureCosts(): InfrastructureCosts {
    // Estimate costs based on common pricing
    // These are rough estimates and should be configured via env or admin panel
    const digitalOceanCost = parseFloat(
      this.configService.get<string>('DO_ESTIMATED_COST') || '9',
    ); // $9/month for 1GB RAM droplet
    const supabaseCost = parseFloat(
      this.configService.get<string>('SUPABASE_ESTIMATED_COST') || '0',
    ); // Free tier = $0
    const vercelCost = parseFloat(
      this.configService.get<string>('VERCEL_ESTIMATED_COST') || '0',
    ); // Hobby = $0
    const brevoCost = parseFloat(
      this.configService.get<string>('BREVO_ESTIMATED_COST') || '0',
    ); // Free tier = $0

    const total = digitalOceanCost + supabaseCost + vercelCost + brevoCost;

    return {
      digitalOcean: {
        estimatedMonthly: digitalOceanCost,
        plan: this.configService.get<string>('DO_PLAN') || '1GB RAM / 1 vCPU',
      },
      supabase: {
        estimatedMonthly: supabaseCost,
        plan: this.configService.get<string>('SUPABASE_PLAN') || 'Free',
      },
      vercel: {
        estimatedMonthly: vercelCost,
        plan: this.configService.get<string>('VERCEL_PLAN') || 'Hobby',
      },
      brevo: {
        estimatedMonthly: brevoCost,
        plan: this.configService.get<string>('BREVO_PLAN') || 'Free',
      },
      total,
    };
  }

  async getPlatformMetrics(): Promise<PlatformMetrics> {
    const [database, backend, email, infrastructure] = await Promise.all([
      this.getDatabaseMetrics(),
      this.getBackendMetrics(),
      this.getEmailMetrics(),
      Promise.resolve(this.getInfrastructureCosts()),
    ]);

    // Generate alerts
    const alerts: Array<{
      type: 'warning' | 'critical';
      message: string;
      metric: string;
    }> = [];

    // Database alerts
    if (database.connectionPoolUsage >= 95) {
      alerts.push({
        type: 'critical',
        message: `Database connection pool usage is at ${database.connectionPoolUsage.toFixed(1)}%`,
        metric: 'database.connections',
      });
    } else if (database.connectionPoolUsage >= 80) {
      alerts.push({
        type: 'warning',
        message: `Database connection pool usage is at ${database.connectionPoolUsage.toFixed(1)}%`,
        metric: 'database.connections',
      });
    }

    if (database.databaseSizePercent >= 95) {
      alerts.push({
        type: 'critical',
        message: `Database size is at ${database.databaseSizePercent.toFixed(1)}% of limit`,
        metric: 'database.size',
      });
    } else if (database.databaseSizePercent >= 80) {
      alerts.push({
        type: 'warning',
        message: `Database size is at ${database.databaseSizePercent.toFixed(1)}% of limit`,
        metric: 'database.size',
      });
    }

    // Backend alerts
    if (backend.memoryUsagePercent >= 95) {
      alerts.push({
        type: 'critical',
        message: `Backend memory usage is at ${backend.memoryUsagePercent.toFixed(1)}%`,
        metric: 'backend.memory',
      });
    } else if (backend.memoryUsagePercent >= 80) {
      alerts.push({
        type: 'warning',
        message: `Backend memory usage is at ${backend.memoryUsagePercent.toFixed(1)}%`,
        metric: 'backend.memory',
      });
    }

    if (backend.errorRate >= 10) {
      alerts.push({
        type: 'critical',
        message: `Error rate is at ${backend.errorRate.toFixed(1)}%`,
        metric: 'backend.errors',
      });
    } else if (backend.errorRate >= 5) {
      alerts.push({
        type: 'warning',
        message: `Error rate is at ${backend.errorRate.toFixed(1)}%`,
        metric: 'backend.errors',
      });
    }

    // Email alerts
    if (email.usagePercent >= 95) {
      alerts.push({
        type: 'critical',
        message: `Email daily quota usage is at ${email.usagePercent.toFixed(1)}%`,
        metric: 'email.quota',
      });
    } else if (email.usagePercent >= 80) {
      alerts.push({
        type: 'warning',
        message: `Email daily quota usage is at ${email.usagePercent.toFixed(1)}%`,
        metric: 'email.quota',
      });
    }

    return {
      database,
      backend,
      email,
      infrastructure,
      alerts,
      timestamp: new Date().toISOString(),
    };
  }
}
