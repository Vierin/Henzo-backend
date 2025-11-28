import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
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
      const validLanguages = ['en', 'vn', 'ru'];
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
      const validLanguages = ['en', 'vn', 'ru'];
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

  @Public()
  @Get('core/suggest')
  async suggestCore(
    @Query('q') query: string,
    @Query('lang') language: string = 'en',
    @Query('limit') limit?: string,
  ) {
    try {
      const q = (query || '').trim();
      if (q.length < 2) {
        return { success: true, data: [] };
      }
      const validLanguages = ['en', 'vn', 'ru'];
      const lang = validLanguages.includes(language) ? language : 'en';
      const take = limit ? Math.min(parseInt(limit, 10) || 10, 20) : 10;
      const results = await this.searchService.suggestCoreCategories(
        q,
        lang,
        take,
      );
      return { success: true, data: results };
    } catch (error) {
      console.error('❌ Core suggest failed:', (error as any).message);
      throw new HttpException(
        (error as any).message || 'Core suggest failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Public()
  @Get('popular/recommended')
  async getPopularRecommended(
    @Query('lang') language: string = 'en',
    @Query('limit') limit?: string,
  ) {
    try {
      const validLanguages = ['en', 'vn', 'ru'];
      const lang = validLanguages.includes(language) ? language : 'en';
      const take = limit ? Math.min(parseInt(limit, 10) || 10, 20) : 10;
      const results = await this.searchService.getPopularRecommendedServices(
        lang,
        take,
      );
      return { success: true, data: results };
    } catch (error) {
      console.error('❌ Get popular recommended failed:', (error as any).message);
      throw new HttpException(
        (error as any).message || 'Failed to get popular recommended',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Public()
  @Get('unified/suggest')
  async unifiedSuggest(
    @Query('q') query: string,
    @Query('lang') language: string = 'en',
    @Query('limit') limit?: string,
  ) {
    try {
      const q = (query || '').trim();
      const validLanguages = ['en', 'vn', 'ru'];
      const lang = validLanguages.includes(language) ? language : 'en';
      const take = limit ? Math.min(parseInt(limit, 10) || 10, 20) : 10;
      const results = await this.searchService.unifiedSuggest(q, lang, take);
      return { success: true, data: results };
    } catch (error) {
      console.error('❌ Unified suggest failed:', (error as any).message);
      throw new HttpException(
        (error as any).message || 'Unified suggest failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
