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
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

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
  async createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Put(':id')
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  async deleteCategory(@Param('id') id: string) {
    await this.categoriesService.delete(id);
    return { message: 'Category deleted successfully' };
  }
}
