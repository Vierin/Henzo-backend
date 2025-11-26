#!/bin/bash

# Скрипт для пересборки backend контейнера
# Использование: bash rebuild-backend.sh

set -e

echo "🔧 Пересборка backend контейнера..."
echo "=========================================="
echo ""

cd /var/www/henzo/apps/backend

# Остановка контейнеров
echo "🛑 Остановка контейнеров..."
docker-compose down

# Удаление старого образа backend
echo "🗑️  Удаление старого образа..."
docker-compose rm -f backend || true
docker rmi backend-backend || true

# Пересборка образа
echo "🔨 Пересборка образа (это может занять несколько минут)..."
docker-compose build --no-cache backend

# Проверка что образ собран
echo "✅ Образ пересобран"
echo ""

# Запуск контейнеров
echo "🚀 Запуск контейнеров..."
docker-compose up -d

# Ожидание запуска
echo "⏳ Ожидание запуска backend (15 секунд)..."
sleep 15

# Проверка что файл существует в контейнере
echo "🔍 Проверка наличия dist/main.js в контейнере..."
if docker-compose exec -T backend ls -la /app/dist/main.js 2>/dev/null; then
    echo "✅ Файл dist/main.js найден"
else
    echo "❌ Файл dist/main.js НЕ найден!"
    echo "📋 Содержимое /app:"
    docker-compose exec -T backend ls -la /app/ || true
    echo "📋 Содержимое /app/dist (если существует):"
    docker-compose exec -T backend ls -la /app/dist/ || true
    exit 1
fi

# Проверка статуса
echo ""
echo "📊 Статус контейнеров:"
docker-compose ps

# Проверка логов
echo ""
echo "📋 Последние логи backend:"
docker-compose logs --tail=20 backend

echo ""
echo "✅ Готово!"

