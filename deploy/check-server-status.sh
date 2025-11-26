#!/bin/bash

# Скрипт для проверки статуса сервера
# Использование: bash check-server-status.sh

set -e

echo "🔍 Проверка статуса сервера..."
echo "=========================================="
echo ""

cd /var/www/henzo/apps/backend

# Проверка статуса контейнеров
echo "📊 Статус контейнеров:"
docker-compose ps

echo ""
echo "🔍 Проверка логов backend (последние 20 строк):"
docker-compose logs --tail=20 backend

echo ""
echo "🔍 Проверка логов nginx (последние 10 строк):"
docker-compose logs --tail=10 nginx

echo ""
echo "🌐 Проверка доступности портов:"
netstat -tlnp | grep -E ':(80|443|3001)' || ss -tlnp | grep -E ':(80|443|3001)'

echo ""
echo "🔍 Проверка health endpoint:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost/health || echo "❌ Health endpoint недоступен"

echo ""
echo "🔍 Проверка доступности backend напрямую:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3001/health || echo "❌ Backend недоступен на порту 3001"

echo ""
echo "✅ Проверка завершена"

