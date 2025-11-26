#!/bin/bash

# Скрипт для проверки сборки и содержимого образа
# Использование: bash check-build.sh

set -e

echo "🔍 Проверка сборки и образа..."
echo "=========================================="
echo ""

cd /var/www/henzo/apps/backend

# Остановка контейнеров
echo "🛑 Остановка контейнеров..."
docker-compose down

# Проверка что код обновлен
echo "📋 Проверка последних изменений..."
git log --oneline -5

# Пересборка образа с подробными логами
echo ""
echo "🔨 Пересборка образа (с подробными логами)..."
echo "Это может занять несколько минут..."
docker-compose build --progress=plain --no-cache backend 2>&1 | tee /tmp/build-full.log

# Проверка ошибок в сборке
echo ""
echo "🔍 Проверка ошибок в сборке..."
if grep -i "error" /tmp/build-full.log | grep -v "node_modules"; then
    echo "❌ Найдены ошибки в сборке:"
    grep -i "error" /tmp/build-full.log | grep -v "node_modules" | head -20
    exit 1
else
    echo "✅ Ошибок в сборке не найдено"
fi

# Проверка что сборка прошла успешно
if ! grep -q "Successfully built" /tmp/build-full.log && ! grep -q "Successfully tagged" /tmp/build-full.log; then
    echo "❌ Сборка не завершилась успешно!"
    echo "Последние 50 строк логов:"
    tail -50 /tmp/build-full.log
    exit 1
fi

echo ""
echo "✅ Образ успешно собран"

# Создание временного контейнера для проверки содержимого
echo ""
echo "🔍 Проверка содержимого образа..."
docker run --rm --entrypoint sh backend-backend -c "ls -la /app/" || echo "Не удалось проверить /app"
docker run --rm --entrypoint sh backend-backend -c "ls -la /app/dist/" || echo "Директория dist не найдена"
docker run --rm --entrypoint sh backend-backend -c "ls -la /app/dist/main.js" || echo "Файл main.js не найден"

# Запуск контейнеров
echo ""
echo "🚀 Запуск контейнеров..."
docker-compose up -d

# Ожидание
echo "⏳ Ожидание запуска (20 секунд)..."
sleep 20

# Проверка статуса
echo ""
echo "📊 Статус контейнеров:"
docker-compose ps

# Проверка логов
echo ""
echo "📋 Последние логи backend:"
docker-compose logs --tail=30 backend

echo ""
echo "✅ Проверка завершена"

