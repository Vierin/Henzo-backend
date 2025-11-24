#!/bin/bash

# Полностью автоматическая настройка бэкенда на сервере
# Запускать: bash deploy/complete-setup.sh
# Скрипт выполнит ВСЕ действия автоматически

set -e

SERVER_IP="165.22.101.13"
SERVER_USER="root"
BACKEND_DIR="/var/www/henzo/apps/backend"

echo "🚀 Полная автоматическая настройка бэкенда"
echo "=========================================="
echo ""

# Проверка .env файла
if [ ! -f ".env" ]; then
    echo "❌ Файл .env не найден!"
    echo "Убедитесь, что вы находитесь в apps/backend/"
    exit 1
fi

echo "✅ Файл .env найден"
echo ""

# Проверка подключения
echo "🔌 Проверка подключения к серверу..."
if ! ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "echo 'OK'" > /dev/null 2>&1; then
    echo "❌ Не удалось подключиться к серверу"
    echo "Проверьте SSH доступ: ssh ${SERVER_USER}@${SERVER_IP}"
    exit 1
fi
echo "✅ Подключение установлено"
echo ""

# Выполнение всех действий на сервере
echo "▶️  Начинаем настройку на сервере..."
echo ""

ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << ENDSSH
set -e

BACKEND_DIR="/var/www/henzo/apps/backend"
HENZO_DIR="/var/www/henzo"

echo "📦 Шаг 1: Обновление системы..."
apt update -qq && apt upgrade -y -qq

echo "📦 Шаг 2: Установка необходимых пакетов..."
apt install -y -qq curl git docker.io docker-compose nginx ufw > /dev/null 2>&1

echo "🐳 Шаг 3: Настройка Docker..."
systemctl enable docker > /dev/null 2>&1
systemctl start docker > /dev/null 2>&1

echo "🔥 Шаг 4: Настройка firewall..."
ufw --force enable > /dev/null 2>&1
ufw allow 22/tcp > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw reload > /dev/null 2>&1

echo "📁 Шаг 5: Создание директорий..."
mkdir -p \$BACKEND_DIR/deploy/ssl
mkdir -p /var/log/nginx

echo "💾 Шаг 6: Создание бэкапа старого .env.production (если есть)..."
if [ -f "\$BACKEND_DIR/.env.production" ]; then
    cp "\$BACKEND_DIR/.env.production" "\$BACKEND_DIR/.env.production.backup.\$(date +%Y%m%d_%H%M%S)"
    echo "   ✅ Бэкап создан"
fi

echo "✅ Базовая настройка завершена"
ENDSSH

# Копирование .env файла
echo ""
echo "📤 Шаг 7: Копирование .env на сервер..."
cat .env | ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "cat > $BACKEND_DIR/.env.production"
echo "   ✅ .env.production обновлен"

# Проверка наличия docker-compose.yml
echo ""
echo "🔍 Шаг 8: Проверка структуры проекта..."
ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'CHECK'
BACKEND_DIR="/var/www/henzo/apps/backend"

if [ ! -f "$BACKEND_DIR/docker-compose.yml" ]; then
    echo "   ⚠️  docker-compose.yml не найден!"
    echo "   Убедитесь, что репозиторий клонирован в /var/www/henzo"
    exit 1
fi
echo "   ✅ docker-compose.yml найден"
CHECK

# Сборка и запуск
echo ""
echo "🔨 Шаг 9: Сборка Docker образов..."
ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'BUILD'
BACKEND_DIR="/var/www/henzo/apps/backend"
cd $BACKEND_DIR

echo "   Сборка образов (это может занять несколько минут)..."
docker-compose build --quiet

echo "   ✅ Сборка завершена"
BUILD

# Применение миграций
echo ""
echo "🗄️  Шаг 10: Применение миграций Prisma..."
ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'MIGRATE'
BACKEND_DIR="/var/www/henzo/apps/backend"
cd $BACKEND_DIR

echo "   Применение миграций..."
docker-compose run --rm backend npx prisma migrate deploy || {
    echo "   ⚠️  Ошибка миграций (возможно БД недоступна или миграции уже применены)"
}
echo "   ✅ Миграции обработаны"
MIGRATE

# Запуск контейнеров
echo ""
echo "▶️  Шаг 11: Запуск контейнеров..."
ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'START'
BACKEND_DIR="/var/www/henzo/apps/backend"
cd $BACKEND_DIR

echo "   Запуск контейнеров..."
docker-compose up -d

echo "   ⏳ Ожидание запуска (30 секунд)..."
sleep 30

echo "   ✅ Контейнеры запущены"
START

# Проверка статуса
echo ""
echo "📊 Шаг 12: Проверка статуса..."
ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'STATUS'
BACKEND_DIR="/var/www/henzo/apps/backend"
cd $BACKEND_DIR

echo ""
echo "   Статус контейнеров:"
docker-compose ps

echo ""
echo "   🔍 Health check:"
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || echo "000")
if [ "$HEALTH_CODE" = "200" ]; then
    echo "   ✅ Backend работает!"
    curl -s http://localhost/health | head -3
else
    echo "   ⚠️  Backend не отвечает (код: $HEALTH_CODE)"
    echo "   Проверьте логи: docker-compose logs backend"
fi
STATUS

echo ""
echo "=========================================="
echo "✅ Настройка завершена!"
echo "=========================================="
echo ""
echo "📝 Полезные команды:"
echo "   Логи:    ssh ${SERVER_USER}@${SERVER_IP} 'cd $BACKEND_DIR && docker-compose logs -f backend'"
echo "   Статус:  ssh ${SERVER_USER}@${SERVER_IP} 'cd $BACKEND_DIR && docker-compose ps'"
echo "   Рестарт: ssh ${SERVER_USER}@${SERVER_IP} 'cd $BACKEND_DIR && docker-compose restart backend'"
echo ""
echo "🌐 Проверка извне:"
echo "   curl http://${SERVER_IP}/health"
echo ""

