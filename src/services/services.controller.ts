import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async getServicesBySalon(@Query('salonId') salonId: string) {
    if (!salonId) {
      throw new Error('Salon ID is required');
    }
    return this.servicesService.findBySalonId(salonId);
  }

  @Get('public')
  async getPublicServices() {
    return this.servicesService.findAllPublic();
  }

  @Get(':id')
  async getServiceById(@Param('id') id: string) {
    return this.servicesService.findById(id);
  }

  @Post()
  async createService(
    @Body()
    data: {
      name: string;
      description?: string;
      duration: number;
      price: number;
      salonId: string;
      categoryId?: string;
    },
  ) {
    return this.servicesService.create(data);
  }

  @Put(':id')
  async updateService(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string;
      description?: string;
      duration?: number;
      price?: number;
    },
  ) {
    return this.servicesService.update(id, data);
  }

  @Delete(':id')
  async deleteService(@Param('id') id: string) {
    return this.servicesService.delete(id);
  }
}
