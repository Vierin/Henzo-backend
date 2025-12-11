import { Injectable } from '@nestjs/common';
import * as promClient from 'prom-client';

@Injectable()
export class MonitoringService {
  private readonly httpRequestDuration: promClient.Histogram<string>;
  private readonly httpRequestTotal: promClient.Counter<string>;
  private readonly dbQueryDuration: promClient.Histogram<string>;
  private readonly activeConnections: promClient.Gauge<string>;

  constructor() {
    // Collect default metrics (CPU, memory, etc.)
    promClient.collectDefaultMetrics({
      prefix: 'henzo_',
    });

    // HTTP request duration histogram
    this.httpRequestDuration = new promClient.Histogram({
      name: 'henzo_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    // HTTP request total counter
    this.httpRequestTotal = new promClient.Counter({
      name: 'henzo_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    // Database query duration
    this.dbQueryDuration = new promClient.Histogram({
      name: 'henzo_db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'model'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    // Active database connections
    this.activeConnections = new promClient.Gauge({
      name: 'henzo_db_active_connections',
      help: 'Number of active database connections',
    });
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
  ): void {
    this.httpRequestDuration
      .labels(method, route, statusCode.toString())
      .observe(duration);
    this.httpRequestTotal.inc({
      method,
      route,
      status_code: statusCode.toString(),
    });
  }

  recordDbQuery(operation: string, model: string, duration: number): void {
    this.dbQueryDuration.labels(operation, model).observe(duration);
  }

  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  async getMetrics(): Promise<string> {
    return promClient.register.metrics();
  }
}


