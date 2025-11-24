#!/bin/bash

# Скрипт для исправления ошибки 404 на /auth/send-business-magic-link
# Запускать на сервере или через SSH

set -e

BACKEND_DIR="/var/www/henzo/apps/backend"

echo "🔧 Исправление ошибки 404 на /auth/send-business-magic-link"
echo "=========================================="
echo ""

# Проверка что мы на сервере или через SSH
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ Директория $BACKEND_DIR не найдена!"
    echo "Запустите скрипт на сервере или через SSH"
    exit 1
fi

cd $BACKEND_DIR

# 1. Проверка статуса контейнеров
echo "📊 Шаг 1: Проверка статуса контейнеров..."
docker-compose ps

# 2. Проверка что backend запущен
echo ""
echo "🔍 Шаг 2: Проверка что backend запущен..."
if ! docker-compose ps | grep -q "henzo-backend.*Up"; then
    echo "⚠️  Backend контейнер не запущен!"
    echo "▶️  Запуск контейнеров..."
    docker-compose up -d
    echo "⏳ Ожидание запуска (15 секунд)..."
    sleep 15
else
    echo "✅ Backend контейнер запущен"
fi

# 3. Проверка health endpoint
echo ""
echo "🔍 Шаг 3: Проверка health endpoint..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || echo "000")
if [ "$HEALTH" = "200" ]; then
    echo "✅ Health endpoint работает"
    curl -s http://localhost/health | head -3
else
    echo "❌ Health endpoint не отвечает (код: $HEALTH)"
    echo "📋 Логи backend:"
    docker-compose logs backend | tail -20
    exit 1
fi

# 4. Проверка что эндпоинт доступен напрямую
echo ""
echo "🔍 Шаг 4: Проверка эндпоинта /auth/send-business-magic-link..."
TEST_RESPONSE=$(docker-compose exec -T backend curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/auth/send-business-magic-link -H "Content-Type: application/json" -d '{"email":"test@test.com","name":"Test"}' || echo "000")

if [ "$TEST_RESPONSE" = "400" ] || [ "$TEST_RESPONSE" = "200" ]; then
    echo "✅ Эндпоинт доступен (код: $TEST_RESPONSE - ожидаемо, т.к. это ошибка валидации)"
else
    if [ "$TEST_RESPONSE" = "404" ]; then
        echo "❌ Эндпоинт возвращает 404 - проблема в коде или роутинге"
        echo "📋 Проверка логов..."
        docker-compose logs backend | grep -i "auth\|route\|controller" | tail -20
    else
        echo "⚠️  Неожиданный ответ (код: $TEST_RESPONSE)"
    fi
fi

# 5. Проверка через nginx
echo ""
echo "🔍 Шаг 5: Проверка через nginx..."
NGINX_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost/auth/send-business-magic-link -H "Content-Type: application/json" -d '{"email":"test@test.com","name":"Test"}' || echo "000")
echo "Ответ через nginx: $NGINX_RESPONSE"

# 6. Перезапуск контейнеров
echo ""
echo "🔄 Шаг 6: Перезапуск контейнеров для применения изменений..."
docker-compose restart backend nginx
echo "⏳ Ожидание запуска (15 секунд)..."
sleep 15

# 7. Финальная проверка
echo ""
echo "🔍 Шаг 7: Финальная проверка..."
FINAL_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || echo "000")
if [ "$FINAL_HEALTH" = "200" ]; then
    echo "✅ Backend работает после перезапуска"
else
    echo "❌ Backend не отвечает после перезапуска"
    echo "📋 Последние логи:"
    docker-compose logs backend | tail -30
fi

# 8. Проверка доступности извне
echo ""
echo "🌐 Шаг 8: Проверка извне..."
EXTERNAL_IP=$(curl -s ifconfig.me || echo "165.22.101.13")
echo "Проверьте извне: curl -X POST http://${EXTERNAL_IP}/auth/send-business-magic-link -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"name\":\"Test\"}'"

echo ""
echo "=========================================="
echo "✅ Диагностика завершена!"
echo "=========================================="
echo ""
echo "📝 Полезные команды:"
echo "   Логи backend:  docker-compose logs -f backend"
echo "   Логи nginx:    docker-compose logs -f nginx"
echo "   Статус:        docker-compose ps"
echo "   Рестарт:       docker-compose restart"
echo ""

