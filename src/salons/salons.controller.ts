import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Headers,
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
    return this.salonsService.findById(id);
  }
}
