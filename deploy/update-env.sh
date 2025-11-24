#!/bin/bash

# Скрипт для обновления переменных окружения на сервере
# Использование: bash deploy/update-env.sh [SSH_KEY_PATH]

set -e

SERVER_IP="165.22.101.13"
SERVER_USER="root"
SSH_KEY="${1:-}"
BACKEND_DIR="/var/www/henzo/apps/backend"

# Определяем SSH команду
if [ -n "$SSH_KEY" ]; then
    SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"
else
    SSH_CMD="ssh -o StrictHostKeyChecking=no"
fi

echo "🔄 Обновление переменных окружения на сервере"
echo "=========================================="
echo ""

# Проверка .env файла
if [ ! -f ".env" ]; then
    echo "❌ Файл .env не найден!"
    echo "Убедитесь, что вы находитесь в apps/backend/"
    exit 1
fi

echo "✅ Файл .env найден"

# Проверка подключения
echo "🔌 Проверка подключения к серверу..."
if ! $SSH_CMD ${SERVER_USER}@${SERVER_IP} "echo 'OK'" > /dev/null 2>&1; then
    echo "❌ Не удалось подключиться к серверу"
    exit 1
fi
echo "✅ Подключение установлено"

# Создание бэкапа старого .env.production
echo "💾 Создание бэкапа старого .env.production..."
$SSH_CMD ${SERVER_USER}@${SERVER_IP} << 'BACKUP'
BACKEND_DIR="/var/www/henzo/apps/backend"
if [ -f "$BACKEND_DIR/.env.production" ]; then
    cp "$BACKEND_DIR/.env.production" "$BACKEND_DIR/.env.production.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ Бэкап создан"
else
    echo "⚠️  Старый .env.production не найден, создается новый"
fi
BACKUP

# Копирование нового .env на сервер
echo "📤 Копирование .env на сервер..."
cat .env | $SSH_CMD ${SERVER_USER}@${SERVER_IP} "cat > $BACKEND_DIR/.env.production"

echo "✅ .env.production обновлен на сервере"

# Перезапуск контейнеров для применения изменений
echo ""
read -p "Перезапустить контейнеры для применения изменений? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Перезапуск контейнеров..."
    $SSH_CMD ${SERVER_USER}@${SERVER_IP} << 'RESTART'
cd /var/www/henzo/apps/backend
docker-compose restart backend
echo "⏳ Ожидание запуска (10 секунд)..."
sleep 10
echo "🔍 Проверка health..."
curl -f http://localhost/health && echo "✅ Backend работает!" || echo "⚠️  Backend не отвечает, проверьте логи"
RESTART
fi

echo ""
echo "=========================================="
echo "✅ Обновление завершено!"
echo "=========================================="
echo ""
echo "📝 Проверка на сервере:"
echo "   ssh ${SERVER_USER}@${SERVER_IP}"
echo "   cd $BACKEND_DIR"
echo "   docker-compose logs -f backend"
echo ""

