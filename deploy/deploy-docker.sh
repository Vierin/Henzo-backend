#!/bin/bash

# Скрипт для деплоя Henzo Backend с Docker
# Запускать из директории /var/www/henzo/apps/backend

set -e

echo "🚀 Начинаем деплой Henzo Backend (Docker)..."

# Проверка .env файла
if [ ! -f .env.production ]; then
    echo "❌ Ошибка: файл .env.production не найден!"
    echo "📝 Создайте файл на основе .env.production.example"
    exit 1
fi

# Остановка старых контейнеров
echo "🛑 Остановка старых контейнеров..."
docker-compose down

# Удаление старых образов (опционально)
read -p "Удалить старые Docker образы? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Удаление старых образов..."
    docker system prune -f
fi

# Сборка новых образов
echo "🔨 Сборка Docker образов..."
docker-compose build --no-cache

# Проверка миграций
read -p "Применить миграции базы данных? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗄️  Применение миграций..."
    docker-compose run --rm backend npx prisma migrate deploy
fi

# Запуск контейнеров
echo "▶️  Запуск контейнеров..."
docker-compose up -d

# Ожидание запуска
echo "⏳ Ожидание запуска сервисов..."
sleep 10

# Проверка статуса
echo ""
echo "✅ Деплой завершен!"
echo ""
echo "📊 Статус контейнеров:"
docker-compose ps
echo ""
echo "🔍 Health check:"
curl -f http://localhost/health && echo "✅ Backend работает!" || echo "❌ Backend не отвечает"
echo ""
echo "📝 Полезные команды:"
echo "   Логи:              docker-compose logs -f"
echo "   Логи backend:      docker-compose logs -f backend"
echo "   Перезапуск:        docker-compose restart"
echo "   Остановка:         docker-compose down"
echo "   Статус:            docker-compose ps"
