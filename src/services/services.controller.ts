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
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

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
  async createService(@Body() createServiceDto: CreateServiceDto) {
    return this.servicesService.create(createServiceDto);
  }

  @Put(':id')
  async updateService(
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, updateServiceDto);
  }

  @Delete(':id')
  async deleteService(@Param('id') id: string) {
    return this.servicesService.delete(id);
  }
}
