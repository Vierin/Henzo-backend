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

  @Get('current')
  async getCurrentUserSalon(@Headers('authorization') authHeader: string) {
    const currentUser = await this.authService.getCurrentUser(authHeader);
    const result = await this.salonsService.getCurrentUserSalon(
      currentUser.user.id,
    );
    return result;
  }

  @Post('current')
  async createCurrentUserSalon(
    @Body() createSalonDto: CreateSalonDto,
    @Headers('authorization') authHeader: string,
  ) {
    const currentUser = await this.authService.getCurrentUser(authHeader);
    return this.salonsService.createCurrentUserSalon(
      createSalonDto,
      currentUser.user.id,
    );
  }

  @Put('current')
  async updateCurrentUserSalon(
    @Body() updateSalonDto: UpdateSalonDto,
    @Headers('authorization') authHeader: string,
  ) {
    const currentUser = await this.authService.getCurrentUser(authHeader);
    return this.salonsService.updateCurrentUserSalon(
      updateSalonDto,
      currentUser.user.id,
    );
  }

  @Get(':id')
  async getSalonById(@Param('id') id: string) {
    return this.salonsService.findById(id);
  }
}
