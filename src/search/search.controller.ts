import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('services')
  async searchServices(
    @Query('q') query: string,
    @Query('lang') language: string = 'en',
  ) {
    try {
      if (!query || query.trim().length < 2) {
        return {
          success: true,
          data: [],
          message: 'Query must be at least 2 characters long',
        };
      }

      // Валидация языка
      const validLanguages = ['en', 'vn'];
      const lang = validLanguages.includes(language) ? language : 'en';

      const results = await this.searchService.searchServicesByCategory(
        query.trim(),
        lang,
      );

      return {
        success: true,
        data: results,
        query: query.trim(),
        language: lang,
        count: results.length,
      };
    } catch (error) {
      console.error('❌ Search services failed:', error.message);
      throw new HttpException(
        error.message || 'Search failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('categories')
  async searchCategories(
    @Query('q') query: string,
    @Query('lang') language: string = 'en',
  ) {
    try {
      // Валидация языка
      const validLanguages = ['en', 'vn'];
      const lang = validLanguages.includes(language) ? language : 'en';

      let results;

      // Если запрос пустой, возвращаем все категории
      if (!query || query.trim().length < 1) {
        results = await this.searchService.getAllCategories();
      } else {
        results = await this.searchService.searchCategories(query.trim(), lang);
      }

      return {
        success: true,
        data: results,
        query: query?.trim() || '',
        language: lang,
        count: results.length,
      };
    } catch (error) {
      console.error('❌ Search categories failed:', error.message);
      throw new HttpException(
        error.message || 'Search failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
