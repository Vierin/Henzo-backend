#!/bin/bash

# Скрипт для обновления backend на DigitalOcean
# Использование: bash deploy/update-backend.sh

set -e

echo "🚀 Обновление Henzo Backend на DigitalOcean"
echo "=========================================="
echo ""

# Переходим в директорию backend
cd /var/www/henzo/apps/backend || {
    echo "❌ Директория /var/www/henzo/apps/backend не найдена!"
    echo "📝 Убедитесь, что вы находитесь на правильном сервере"
    exit 1
}

# Проверка наличия .env.production
if [ ! -f .env.production ]; then
    echo "⚠️  Файл .env.production не найден!"
    echo "📝 Убедитесь, что файл существует"
fi

# Обновление кода (если есть Git)
if [ -d "/var/www/henzo/.git" ]; then
    echo "🔄 Обновление кода из Git..."
    cd /var/www/henzo
    git pull origin main || git pull origin master || echo "⚠️  Не удалось обновить из Git"
    cd apps/backend
else
    echo "⚠️  Git репозиторий не найден. Пропускаем обновление кода."
    echo "📝 Если нужно обновить код, скопируйте файлы вручную"
fi

# Пересборка образа
echo ""
echo "🔨 Пересборка Docker образа backend..."
docker-compose build backend

# Перезапуск контейнера
echo ""
echo "🔄 Перезапуск backend контейнера..."
docker-compose up -d --no-deps backend

# Ожидание запуска
echo ""
echo "⏳ Ожидание запуска backend (10 секунд)..."
sleep 10

# Проверка статуса
echo ""
echo "📊 Статус контейнеров:"
docker-compose ps

# Проверка health endpoint
echo ""
echo "🔍 Проверка health endpoint..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Backend работает!"
else
    echo "❌ Backend не отвечает на /health"
    echo "📋 Последние логи:"
    docker-compose logs --tail=30 backend
fi

echo ""
echo "✅ Обновление завершено!"
echo ""
echo "📝 Полезные команды:"
echo "   Логи:              docker-compose logs -f backend"
echo "   Перезапуск:        docker-compose restart backend"
echo "   Статус:            docker-compose ps"

