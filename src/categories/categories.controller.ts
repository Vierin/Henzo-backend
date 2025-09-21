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
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async getCategoriesBySalon(@Query('salonId') salonId: string) {
    if (!salonId) {
      throw new Error('Salon ID is required');
    }
    return this.categoriesService.findBySalonId(salonId);
  }

  @Get(':id')
  async getCategoryById(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @Post()
  async createCategory(
    @Body()
    data: {
      name: string;
      salonId: string;
    },
  ) {
    return this.categoriesService.create(data);
  }

  @Put(':id')
  async updateCategory(
    @Param('id') id: string,
    @Body() data: { name?: string },
  ) {
    return this.categoriesService.update(id, data);
  }

  @Delete(':id')
  async deleteCategory(@Param('id') id: string) {
    await this.categoriesService.delete(id);
    return { message: 'Category deleted successfully' };
  }
}
