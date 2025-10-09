#!/bin/bash

# Быстрое обновление кода (без пересборки, для hotfix)
# Для изменений, не требующих пересборки образа

set -e

cd /var/www/henzo

echo "🔄 Получение последних изменений..."
git pull origin main

cd apps/backend

echo "🔨 Пересборка образа..."
docker-compose build backend

echo "🔄 Перезапуск backend..."
docker-compose up -d --no-deps backend

echo "⏳ Ожидание запуска..."
sleep 5

echo ""
echo "✅ Обновление завершено!"
docker-compose ps
echo ""
echo "🔍 Health check:"
curl -f http://localhost/health && echo "✅ OK" || echo "❌ Fail"
