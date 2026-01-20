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
import { StaffService } from './staff.service';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  async getStaffBySalon(@Query('salonId') salonId: string) {
    if (!salonId) {
      throw new Error('Salon ID is required');
    }
    return this.staffService.findBySalonId(salonId);
  }

  @Get(':id')
  async getStaffById(@Param('id') id: string) {
    return this.staffService.findById(id);
  }

  @Post()
  async createStaff(
    @Body()
    data: {
      name: string;
      email?: string;
      phone?: string;
      accessLevel: 'ADMIN' | 'EMPLOYEE';
      salonId: string;
      serviceIds?: string[];
    },
  ) {
    return this.staffService.create(data);
  }

  @Put(':id')
  async updateStaff(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string;
      email?: string;
      phone?: string;
      accessLevel?: 'ADMIN' | 'EMPLOYEE';
      serviceIds?: string[];
    },
  ) {
    return this.staffService.update(id, data);
  }

  @Delete(':id')
  async deleteStaff(@Param('id') id: string) {
    return this.staffService.delete(id);
  }
}
