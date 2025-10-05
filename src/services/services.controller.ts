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

  @Get('popular')
  async getPopularServices(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.servicesService.findPopularServices(limitNum);
  }

  @Get('trending')
  async getTrendingServices(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 8;
    return this.servicesService.findTrendingServices(limitNum);
  }

  @Get('categories')
  async getServiceCategories() {
    return this.servicesService.getServiceCategories();
  }

  @Get('search')
  async searchServices(@Query('q') query: string) {
    if (!query || query.trim().length < 3) {
      return {
        success: true,
        data: [],
      };
    }

    try {
      const results = await this.servicesService.searchServices(query);
      return {
        success: true,
        data: results,
      };
    } catch (error) {
      console.error('❌ Service search error:', error);
      return {
        success: false,
        error: 'Failed to search services',
        data: [],
      };
    }
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
