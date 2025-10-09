#!/bin/bash

# Быстрый деплой (без миграций)
# Для быстрого обновления кода без изменений БД

set -e

cd /var/www/henzo/apps/backend

echo "🔄 Получение последних изменений..."
git pull origin main

echo "📦 Установка зависимостей..."
npm ci --only=production

echo "🔨 Сборка..."
npm run build

echo "🔄 Перезапуск..."
pm2 reload henzo-backend

echo "✅ Готово!"
pm2 status henzo-backend
