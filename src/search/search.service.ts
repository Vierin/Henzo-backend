import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchServicesByCategory(query: string, language: string = 'en') {
    try {
      console.log(`🔍 Booksy-style search for query: "${query}" (${language})`);

      // Определяем язык запроса
      const detectedLanguage = this.detectLanguage(query) || language;

      // Этап 1: Поиск по синонимам (как у Booksy)
      const synonymResults = await this.searchBySynonyms(
        query,
        detectedLanguage,
      );

      // Этап 2: Поиск по категориям
      const categoryResults = await this.searchByCategories(
        query,
        detectedLanguage,
      );

      // Этап 3: Прямой поиск по названию услуги
      const directResults = await this.searchServicesByName(query);

      // Объединяем результаты и убираем дубликаты
      const allResults = [
        ...synonymResults,
        ...categoryResults,
        ...directResults,
      ];
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
    const englishChars = /[a-zA-Z]/;

    if (vietnameseChars.test(query)) {
      return 'vn';
    } else if (englishChars.test(query)) {
      return 'en';
    }

    return null; // Неопределенный язык
  }

  // Новый метод: поиск по синонимам (как у Booksy)
  async searchBySynonyms(query: string, language: string = 'en') {
    try {
      // Ищем синонимы, которые содержат запрос, с приоритетом по языку
      const synonyms = await this.prisma.$queryRaw`
        SELECT DISTINCT s.category_id, s.weight, sc.name_en, sc.name_vn,
               CASE 
                 WHEN s.language = ${language} THEN s.weight * 1.5
                 ELSE s.weight
               END as adjusted_weight
        FROM service_synonyms s
        JOIN service_categories sc ON s.category_id = sc.id
        WHERE s.keyword ILIKE ${`%${query}%`}
        ORDER BY adjusted_weight DESC, s.weight DESC
      `;

      if (!synonyms || (synonyms as any[]).length === 0) {
        return [];
      }

      const categoryIds = (synonyms as any[]).map((s) => s.category_id);

      // Ищем услуги по найденным категориям
      const services = await this.prisma.service.findMany({
        where: {
          OR: [
            {
              serviceCategoryId: {
                in: categoryIds,
              },
            },
            // Также ищем по названию услуги, содержащему ключевые слова
            {
              name: {
                contains: query,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        },
        include: {
          serviceCategory: true,
          salon: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
              email: true,
              logo: true,
              photos: true,
              workingHours: true,
            },
          },
          staff: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      console.log(`📋 Found ${services.length} services via synonyms`);
      return services;
    } catch (error) {
      console.error('❌ Error searching by synonyms:', error);
      return [];
    }
  }

  // Новый метод: поиск по категориям
  async searchByCategories(query: string, language: string = 'en') {
    try {
      // Приоритет поиска по языку
      const whereCondition =
        language === 'vn'
          ? {
              OR: [
                {
                  nameVn: {
                    contains: query,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  nameEn: {
                    contains: query,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            }
          : {
              OR: [
                {
                  nameEn: {
                    contains: query,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  nameVn: {
                    contains: query,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            };

      const categories = await this.prisma.serviceCategory.findMany({
        where: whereCondition,
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
        include: {
          serviceCategory: true,
          salon: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
              email: true,
              logo: true,
              photos: true,
              workingHours: true,
            },
          },
          staff: {
            select: {
              id: true,
              name: true,
            },
          },
        },
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
            service.serviceCategory?.nameVn
              ?.toLowerCase()
              .includes(query.toLowerCase())
          ) {
            score += 12; // Высший приоритет для вьетнамского
          } else if (
            service.serviceCategory?.nameEn
              ?.toLowerCase()
              .includes(query.toLowerCase())
          ) {
            score += 8; // Меньший приоритет для английского
          }
        } else {
          if (
            service.serviceCategory?.nameEn
              ?.toLowerCase()
              .includes(query.toLowerCase())
          ) {
            score += 12; // Высший приоритет для английского
          } else if (
            service.serviceCategory?.nameVn
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
        include: {
          serviceCategory: true,
          salon: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
              email: true,
              logo: true,
              photos: true,
              workingHours: true,
            },
          },
          staff: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          salon: {
            name: 'asc',
          },
        },
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
                      nameVn: {
                        contains: query,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      nameEn: {
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
                      nameEn: {
                        contains: query,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      nameVn: {
                        contains: query,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                  ],
                },
              ],
            };

      const categories = await this.prisma.serviceCategory.findMany({
        where: whereCondition,
        orderBy: language === 'vn' ? { nameVn: 'asc' } : { nameEn: 'asc' },
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

      const categories = await this.prisma.serviceCategory.findMany({
        where: {
          id: {
            in: usedCategoryIds,
          },
        },
        orderBy: {
          nameEn: 'asc',
        },
      });

      return categories;
    } catch (error) {
      console.error('❌ Error getting all categories:', error);
      throw new Error(`Failed to get categories: ${error.message}`);
    }
  }

  async getUsedCategoryIds(): Promise<number[]> {
    try {
      // Получаем все уникальные categoryIds из салонов
      const salons = await this.prisma.salon.findMany({
        select: {
          categoryIds: true,
        },
      });

      const usedCategoryIds = new Set<number>();
      salons.forEach((salon) => {
        if (salon.categoryIds && Array.isArray(salon.categoryIds)) {
          salon.categoryIds.forEach((id) => usedCategoryIds.add(id));
        }
      });

      return Array.from(usedCategoryIds);
    } catch (error) {
      console.error('❌ Error getting used category IDs:', error);
      return [];
    }
  }
}
