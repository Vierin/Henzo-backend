import { Controller, Get, Param } from '@nestjs/common';
import { SalonsService } from './salons.service';

@Controller('salons')
export class SalonsController {
  constructor(private readonly salonsService: SalonsService) {}

  @Get('with-services')
  async getSalonsWithServices() {
    return this.salonsService.findSalonsWithServices();
  }

  @Get(':id')
  async getSalonById(@Param('id') id: string) {
    return this.salonsService.findById(id);
  }
}
