# Быстрый старт: RecommendedServices

## Шаг 1: Создать таблицу в БД

### Вариант A: Через Supabase Dashboard (рекомендуется)
1. Откройте Supabase Dashboard → SQL Editor
2. Скопируйте и выполните SQL из файла:
   `migrations/20250129000000_add_recommended_services/migration.sql`

### Вариант B: Через PowerShell (если есть доступ к БД)
```powershell
# Применить SQL напрямую (требует psql или подключение к БД)
# SQL файл: migrations/20250129000000_add_recommended_services/migration.sql
```

## Шаг 2: Запустить seed

После создания таблицы:

```powershell
npm run seed:recommended-services
```

Или напрямую:
```powershell
npx tsx prisma/seed-recommended-services.ts
```

## Проверка

После выполнения seed проверьте что данные появились:
- В Supabase Dashboard → Table Editor → RecommendedService
- Должно быть 28 записей (19 основных + 9 мужских услуг)

## Если таблица уже создана, но миграция не применена:

Пометьте миграцию как примененную:
```powershell
npx prisma migrate resolve --applied 20250129000000_add_recommended_services
```

