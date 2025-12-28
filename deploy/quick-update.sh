#!/bin/bash

# Быстрое обновление кода (без пересборки, для hotfix)
# Для изменений, не требующих пересборки образа

set -e

# Находим корень репозитория
if [ -d "/var/www/henzo/.git" ]; then
    REPO_ROOT="/var/www/henzo"
elif [ -d "/var/www/henzo/apps/backend/.git" ]; then
    REPO_ROOT="/var/www/henzo/apps/backend"
else
    # Пытаемся найти .git в родительских директориях
    CURRENT_DIR=$(pwd)
    while [ "$CURRENT_DIR" != "/" ]; do
        if [ -d "$CURRENT_DIR/.git" ]; then
            REPO_ROOT="$CURRENT_DIR"
            break
        fi
        CURRENT_DIR=$(dirname "$CURRENT_DIR")
    done
fi

if [ -z "$REPO_ROOT" ] || [ ! -d "$REPO_ROOT/.git" ]; then
    echo "⚠️  Git репозиторий не найден. Пропускаем git pull."
    echo "📦 Обновление кода вручную или через другой метод."
else
    echo "📂 Найден репозиторий: $REPO_ROOT"
    cd "$REPO_ROOT"
    echo "🔄 Получение последних изменений..."
    git pull origin main || git pull origin master || echo "⚠️  Не удалось обновить код из Git"
fi

cd /var/www/henzo/apps/backend

# Очистка build cache перед сборкой (освободит место)
echo "🧹 Очистка старого build cache..."
docker builder prune -f

echo "🔨 Пересборка образа..."
docker-compose build backend

# Очистка неиспользуемых образов после успешной сборки
echo "🧹 Очистка неиспользуемых образов..."
docker image prune -f

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
