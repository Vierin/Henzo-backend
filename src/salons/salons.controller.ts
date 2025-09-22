import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { SalonsService } from './salons.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { CreateSalonDto } from './dto/create-salon.dto';

@Controller('salons')
export class SalonsController {
  constructor(private readonly salonsService: SalonsService) {}

  @Get('with-services')
  async getSalonsWithServices() {
    return this.salonsService.findSalonsWithServices();
  }

  @Get('current')
  async getCurrentUserSalon() {
    // Временное решение - возвращаем первый салон или null
    // В реальном приложении здесь будет аутентификация пользователя
    const result = await this.salonsService.getCurrentUserSalon();
    return result; // Сервис уже возвращает салон напрямую
  }

  @Post('current')
  async createCurrentUserSalon(@Body() createSalonDto: CreateSalonDto) {
    // Временное решение - создаем салон для первого пользователя
    // В реальном приложении здесь будет аутентификация пользователя
    return this.salonsService.createCurrentUserSalon(createSalonDto);
  }

  @Put('current')
  async updateCurrentUserSalon(@Body() updateSalonDto: UpdateSalonDto) {
    // Временное решение - обновляем первый салон
    // В реальном приложении здесь будет аутентификация пользователя
    return this.salonsService.updateCurrentUserSalon(updateSalonDto);
  }

  @Get(':id')
  async getSalonById(@Param('id') id: string) {
    return this.salonsService.findById(id);
  }
}
