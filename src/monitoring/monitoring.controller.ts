import { Controller, Get } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';

@Controller('metrics')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get()
  async getMetrics() {
    const metrics = await this.monitoringService.getMetrics();
    return metrics;
  }
}











