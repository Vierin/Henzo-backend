import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Headers,
  Query,
} from '@nestjs/common';
import { SalonsService } from './salons.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { CreateSalonDto } from './dto/create-salon.dto';
import { AuthService } from '../auth/auth.service';

@Controller('salons')
export class SalonsController {
  constructor(
    private readonly salonsService: SalonsService,
    private readonly authService: AuthService,
  ) {}

  @Get('with-services')
  async getSalonsWithServices() {
    return this.salonsService.findSalonsWithServices();
  }

  @Get('search')
  async searchSalons(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('location') location?: string,
    @Query('category') category?: string,
    @Query('sortBy') sortBy?: string,
    @Query('minRating') minRating?: string,
    @Query('isOpenNow') isOpenNow?: string,
  ) {
    const params = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      location,
      category,
      sortBy,
      minRating: minRating ? parseInt(minRating, 10) : undefined,
      isOpenNow: isOpenNow === 'true',
    };

    const result = await this.salonsService.searchSalons(params);
    return {
      success: true,
      ...result,
    };
  }

  @Get('preview')
  async getSalonsPreview(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('location') location?: string,
    @Query('featured') featured?: string,
  ) {
    const params = {
      limit: limit ? parseInt(limit, 10) : 20,
      page: page ? parseInt(page, 10) : 1,
      location,
      featured: featured === 'true',
    };

    return this.salonsService.findSalonsPreview(params);
  }

  @Get('featured')
  async getFeaturedSalons(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 6;
    return this.salonsService.findFeaturedSalons(limitNum);
  }

  @Get('nearby')
  async getNearbySalons(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
    @Query('limit') limit?: string,
  ) {
    const params = {
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      radius: radius ? parseInt(radius, 10) : 10, // km
      limit: limit ? parseInt(limit, 10) : 10,
    };

    return this.salonsService.findNearbySalons(params);
  }

  @Get(':id/stats')
  async getSalonStats(@Param('id') id: string) {
    return this.salonsService.getSalonStats(id);
  }

  @Get(':id/availability')
  async getSalonAvailability(
    @Param('id') id: string,
    @Query('date') date?: string,
    @Query('serviceId') serviceId?: string,
  ) {
    return this.salonsService.getSalonAvailability(id, date, serviceId);
  }

  @Get('categories')
  async getSalonCategories() {
    return this.salonsService.getSalonCategories();
  }

  @Get('current')
  async getCurrentUserSalon(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);
      const result = await this.salonsService.getCurrentUserSalon(
        currentUser.user.id,
      );

      if (!result) {
        return { success: false, message: 'No salon found for this user' };
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Get current salon failed:', error.message);
      return { success: false, message: error.message };
    }
  }

  @Post('current')
  async createCurrentUserSalon(
    @Body() createSalonDto: CreateSalonDto,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('📝 Received create salon request:', {
        hasAuthHeader: !!authHeader,
        dataKeys: Object.keys(createSalonDto),
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log('✅ User authenticated:', currentUser.user.email);

      const result = await this.salonsService.createCurrentUserSalon(
        createSalonDto,
        currentUser.user.id,
      );

      console.log('✅ Salon created successfully:', result.id);
      return result;
    } catch (error) {
      console.error('❌ Create salon failed:', error.message);
      throw error;
    }
  }

  @Put('current')
  async updateCurrentUserSalon(
    @Body() updateSalonDto: UpdateSalonDto,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('📝 Received update salon request:', {
        hasAuthHeader: !!authHeader,
        dataKeys: Object.keys(updateSalonDto),
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log('✅ User authenticated:', currentUser.user.email);

      const result = await this.salonsService.updateCurrentUserSalon(
        updateSalonDto,
        currentUser.user.id,
      );

      console.log('✅ Salon updated successfully:', result.id);
      return result;
    } catch (error) {
      console.error('❌ Update salon failed:', error.message);
      throw error;
    }
  }

  @Get(':id')
  async getSalonById(@Param('id') id: string) {
    const result = await this.salonsService.findById(id);
    return result;
  }
}
