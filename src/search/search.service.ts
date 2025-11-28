import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  // Unified core suggestion (categories + tags collapsed to categories)
  async suggestCoreCategories(query: string, language: string, limit: number) {
    const q = query.trim();
    const lang = language === 'vn' ? 'vn' : language === 'ru' ? 'ru' : 'en';
    // 1) categories by name
    const catWhere =
      lang === 'vn'
        ? {
            OR: [
              { name_vn: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { name_en: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : lang === 'ru'
          ? {
              OR: [
                {
                  name_ru: { contains: q, mode: Prisma.QueryMode.insensitive },
                },
                {
                  name_en: { contains: q, mode: Prisma.QueryMode.insensitive },
                },
                {
                  name_vn: { contains: q, mode: Prisma.QueryMode.insensitive },
                },
              ],
            }
          : {
              OR: [
                {
                  name_en: { contains: q, mode: Prisma.QueryMode.insensitive },
                },
                {
                  name_vn: { contains: q, mode: Prisma.QueryMode.insensitive },
                },
              ],
            };

    // Search only categories (tags removed)
    const categories = await this.prisma.service_categories.findMany({
      where: catWhere,
      select: { id: true, name_en: true, name_vn: true, name_ru: true },
      take: limit,
    });

    // Merge categories from name search
    const byId = new Map<
      number,
      {
        id: number;
        nameEn: string;
        nameVn: string;
        nameRu: string;
        score: number;
      }
    >();

    categories.forEach((c) =>
      byId.set(c.id, {
        id: c.id,
        nameEn: c.name_en,
        nameVn: c.name_vn,
        nameRu: c.name_ru,
        score: 10, // Higher score for direct category match
      }),
    );

    // Rank: score desc, then alphabetical
    const merged = Array.from(byId.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aName =
        lang === 'vn'
          ? a.nameVn || a.nameEn
          : lang === 'ru'
            ? a.nameRu || a.nameEn
            : a.nameEn || a.nameVn;
      const bName =
        lang === 'vn'
          ? b.nameVn || b.nameEn
          : lang === 'ru'
            ? b.nameRu || b.nameEn
            : b.nameEn || b.nameVn;
      return (aName || '').localeCompare(bName || '');
    });

    return merged.slice(0, limit).map(({ id, nameEn, nameVn, nameRu }) => ({
      id,
      name:
        lang === 'vn'
          ? nameVn || nameEn
          : lang === 'ru'
            ? nameRu || nameEn
            : nameEn || nameVn,
    }));
  }

  async searchServicesByCategory(query: string, language: string = 'en') {
    try {
      console.log(`🔍 Booksy-style search for query: "${query}" (${language})`);

      // Определяем язык запроса
      const detectedLanguage = this.detectLanguage(query) || language;

      // Этап 1: Поиск по категориям
      const categoryResults = await this.searchByCategories(
        query,
        detectedLanguage,
      );

      // Этап 2: Прямой поиск по названию услуги
      const directResults = await this.searchServicesByName(query);

      // Объединяем результаты и убираем дубликаты
      const allResults = [...categoryResults, ...directResults];
      const uniqueResults = this.removeDuplicateServices(allResults);

      // Ранжируем по релевантности (как у Booksy)
      const rankedResults = this.rankServices(
        uniqueResults,
        query,
        detectedLanguage,
      );

      console.log(
        `🎯 Found ${rankedResults.length} services (Booksy-style, ${detectedLanguage})`,
      );

      return rankedResults;
    } catch (error) {
      console.error('❌ Error in Booksy-style search:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  // Новый метод: определение языка запроса
  detectLanguage(query: string): string | null {
    // Простая эвристика для определения языка
    const vietnameseChars =
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    const cyrillicChars = /[А-Яа-яЁё]/;
    const englishChars = /[a-zA-Z]/;

    if (vietnameseChars.test(query)) {
      return 'vn';
    } else if (cyrillicChars.test(query)) {
      return 'ru';
    } else if (englishChars.test(query)) {
      return 'en';
    }

    return null; // Неопределенный язык
  }

  // Новый метод: поиск по тегам
  // searchByTags method removed - tags are no longer used

  // Новый метод: поиск по категориям
  async searchByCategories(query: string, language: string = 'en') {
    try {
      // Приоритет поиска по языку
      const whereCondition =
        language === 'vn'
          ? {
              OR: [
                {
                  name_vn: {
                    contains: query,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  name_en: {
                    contains: query,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            }
          : language === 'ru'
            ? {
                OR: [
                  {
                    name_ru: {
                      contains: query,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                  {
                    name_en: {
                      contains: query,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                  {
                    name_vn: {
                      contains: query,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                ],
              }
            : {
                OR: [
                  {
                    name_en: {
                      contains: query,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                  {
                    name_vn: {
                      contains: query,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                ],
              };

      const categories = await this.prisma.service_categories.findMany({
        where: whereCondition,
        take: 30,
      });

      if (categories.length === 0) {
        return [];
      }

      const categoryIds = categories.map((c) => c.id);

      const services = await this.prisma.service.findMany({
        where: {
          serviceCategoryId: {
            in: categoryIds,
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          serviceCategoryId: true,
          service_categories: {
            select: {
              name_en: true,
              name_vn: true,
            },
          },
        },
        take: 20,
      });

      console.log(`📋 Found ${services.length} services via categories`);
      return services;
    } catch (error) {
      console.error('❌ Error searching by categories:', error);
      return [];
    }
  }

  // Новый метод: удаление дубликатов услуг
  removeDuplicateServices(services: any[]) {
    const seen = new Set();
    return services.filter((service) => {
      const key = `${service.id}-${service.salonId}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Новый метод: ранжирование услуг (как у Booksy)
  rankServices(services: any[], query: string, language: string = 'en') {
    return services
      .map((service) => {
        let score = 0;

        // Бонус за точное совпадение в названии
        if (service.name.toLowerCase().includes(query.toLowerCase())) {
          score += 10;
        }

        // Бонус за совпадение в категории (с приоритетом по языку)
        if (language === 'vn') {
          if (
            service.service_categories?.name_vn
              ?.toLowerCase()
              .includes(query.toLowerCase())
          ) {
            score += 12; // Высший приоритет для вьетнамского
          } else if (
            service.service_categories?.name_en
              ?.toLowerCase()
              .includes(query.toLowerCase())
          ) {
            score += 8; // Меньший приоритет для английского
          }
        } else {
          if (
            service.service_categories?.name_en
              ?.toLowerCase()
              .includes(query.toLowerCase())
          ) {
            score += 12; // Высший приоритет для английского
          } else if (
            service.service_categories?.name_vn
              ?.toLowerCase()
              .includes(query.toLowerCase())
          ) {
            score += 8; // Меньший приоритет для вьетнамского
          }
        }

        // Бонус за привязанную категорию
        if (service.serviceCategoryId) {
          score += 5;
        }

        // Бонус за описание
        if (service.description?.toLowerCase().includes(query.toLowerCase())) {
          score += 3;
        }

        // Бонус за язык (если услуга на том же языке, что и запрос)
        if (this.isVietnameseText(service.name) && language === 'vn') {
          score += 2;
        } else if (!this.isVietnameseText(service.name) && language === 'en') {
          score += 2;
        }

        return { ...service, relevanceScore: score };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Вспомогательный метод: проверка вьетнамского текста
  isVietnameseText(text: string): boolean {
    const vietnameseChars =
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    return vietnameseChars.test(text);
  }

  async searchServicesByName(query: string) {
    try {
      console.log(`🔍 Searching services by name: "${query}"`);

      const services = await this.prisma.service.findMany({
        where: {
          name: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          serviceCategoryId: true,
          service_categories: {
            select: {
              name_en: true,
              name_vn: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        take: 20,
      });

      console.log(`🎯 Found ${services.length} services by name`);

      return services;
    } catch (error) {
      console.error('❌ Error searching services by name:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async searchCategories(query: string, language: string = 'en') {
    try {
      console.log(
        `🔍 Searching categories for query: "${query}" (${language})`,
      );

      // Сначала получаем ID категорий, которые используются в салонах
      const usedCategoryIds = await this.getUsedCategoryIds();

      // Приоритет поиска по языку
      const whereCondition =
        language === 'vn'
          ? {
              AND: [
                {
                  id: {
                    in: usedCategoryIds,
                  },
                },
                {
                  OR: [
                    {
                      name_vn: {
                        contains: query,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      name_en: {
                        contains: query,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                  ],
                },
              ],
            }
          : {
              AND: [
                {
                  id: {
                    in: usedCategoryIds,
                  },
                },
                {
                  OR: [
                    {
                      name_en: {
                        contains: query,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      name_vn: {
                        contains: query,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                  ],
                },
              ],
            };

      const categories = await this.prisma.service_categories.findMany({
        where: whereCondition,
        orderBy: language === 'vn' ? { name_vn: 'asc' } : { name_en: 'asc' },
        take: 10, // Limit to 10 suggestions
      });

      console.log(
        `📋 Found ${categories.length} matching categories (${language})`,
      );

      return categories;
    } catch (error) {
      console.error('❌ Error searching categories:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async getAllCategories() {
    try {
      // Получаем только категории, которые используются в салонах
      const usedCategoryIds = await this.getUsedCategoryIds();

      const categories = await this.prisma.service_categories.findMany({
        where: {
          id: {
            in: usedCategoryIds,
          },
        },
        orderBy: {
          name_en: 'asc',
        },
      });

      return categories;
    } catch (error) {
      console.error('❌ Error getting all categories:', error);
      throw new Error(`Failed to get categories: ${error.message}`);
    }
  }

  private usedCategoriesCache: { ids: number[]; at: number } | null = null;
  private readonly usedCategoriesTtlMs = 10 * 60 * 1000; // 10 minutes

  async getUsedCategoryIds(): Promise<number[]> {
    try {
      const now = Date.now();
      if (
        this.usedCategoriesCache &&
        now - this.usedCategoriesCache.at < this.usedCategoriesTtlMs
      ) {
        return this.usedCategoriesCache.ids;
      }

      // derive used categories from existing services, not from salons.categoryIds
      const distinct = await this.prisma.service.findMany({
        where: { serviceCategoryId: { not: null } },
        select: { serviceCategoryId: true },
        distinct: ['serviceCategoryId'],
      });
      const ids = distinct
        .map((r) => r.serviceCategoryId)
        .filter((v): v is number => typeof v === 'number');
      this.usedCategoriesCache = { ids, at: now };
      return ids;
    } catch (error) {
      console.error('❌ Error getting used category IDs:', error);
      return [];
    }
  }

  // Search recommended services by text match (Booksy style)
  async searchRecommendedServices(
    query: string,
    language: string = 'en',
    limit: number = 10,
  ) {
    try {
      const q = query.trim().toLowerCase();
      const lang = language === 'vn' ? 'vn' : language === 'ru' ? 'ru' : 'en';

      const whereCondition =
        lang === 'vn'
          ? {
              OR: [
                { nameVi: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { nameEn: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { nameRu: { contains: q, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : lang === 'ru'
            ? {
                OR: [
                  { nameRu: { contains: q, mode: Prisma.QueryMode.insensitive } },
                  { nameEn: { contains: q, mode: Prisma.QueryMode.insensitive } },
                  { nameVi: { contains: q, mode: Prisma.QueryMode.insensitive } },
                ],
              }
            : {
                OR: [
                  { nameEn: { contains: q, mode: Prisma.QueryMode.insensitive } },
                  { nameVi: { contains: q, mode: Prisma.QueryMode.insensitive } },
                  { nameRu: { contains: q, mode: Prisma.QueryMode.insensitive } },
                ],
              };

      const services = await this.prisma.recommendedService.findMany({
        where: whereCondition,
        orderBy: [{ priority: 'desc' }, { nameEn: 'asc' }],
        take: limit,
      });

      return services.map((service) => ({
        id: `recommended-${service.id}`,
        name:
          lang === 'vn'
            ? service.nameVi || service.nameEn
            : lang === 'ru'
              ? service.nameRu || service.nameEn
              : service.nameEn || service.nameVi,
        type: 'recommended' as const,
        priority: service.priority,
      }));
    } catch (error) {
      console.error('❌ Error searching recommended services:', error);
      return [];
    }
  }

  // Get popular recommended services (for 0-2 chars input)
  async getPopularRecommendedServices(
    language: string = 'en',
    limit: number = 10,
  ) {
    try {
      const lang = language === 'vn' ? 'vn' : language === 'ru' ? 'ru' : 'en';

      const services = await this.prisma.recommendedService.findMany({
        orderBy: [{ priority: 'desc' }, { nameEn: 'asc' }],
        take: limit,
      });

      return services.map((service) => ({
        id: `recommended-${service.id}`,
        name:
          lang === 'vn'
            ? service.nameVi || service.nameEn
            : lang === 'ru'
              ? service.nameRu || service.nameEn
              : service.nameEn || service.nameVi,
        type: 'recommended' as const,
        priority: service.priority,
      }));
    } catch (error) {
      console.error('❌ Error getting popular recommended services:', error);
      return [];
    }
  }

  // Unified suggest: RecommendedServices + Salon names (Booksy style)
  async unifiedSuggest(
    query: string,
    language: string = 'en',
    limit: number = 10,
  ) {
    try {
      const q = query.trim();
      const lang = language === 'vn' ? 'vn' : language === 'ru' ? 'ru' : 'en';

      // If query is empty or too short, return popular recommended services only
      if (q.length < 3) {
        const popularServices = await this.getPopularRecommendedServices(
          lang,
          limit,
        );
        return {
          recommendedServices: popularServices,
          salons: [],
        };
      }

      // Search recommended services and salons in parallel
      const [recommendedServices, salons] = await Promise.all([
        this.searchRecommendedServices(q, lang, Math.ceil(limit * 0.7)), // 70% for services
        this.searchSalonNames(q, Math.ceil(limit * 0.3)), // 30% for salons
      ]);

      return {
        recommendedServices,
        salons,
      };
    } catch (error) {
      console.error('❌ Error in unified suggest:', error);
      return {
        recommendedServices: [],
        salons: [],
      };
    }
  }

  // Search salon names only
  private async searchSalonNames(query: string, limit: number = 5) {
    try {
      const q = query.trim();
      if (q.length < 3) {
        return [];
      }

      const salons = await this.prisma.salon.findMany({
        where: {
          name: { contains: q, mode: Prisma.QueryMode.insensitive },
        },
        select: {
          id: true,
          name: true,
          address: true,
        },
        orderBy: { name: 'asc' },
        take: limit,
      });

      return salons.map((salon) => ({
        id: salon.id,
        name: salon.name,
        type: 'salon' as const,
        address: salon.address,
      }));
    } catch (error) {
      console.error('❌ Error searching salon names:', error);
      return [];
    }
  }
}
