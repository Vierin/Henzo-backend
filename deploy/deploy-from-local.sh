#!/bin/bash

# Скрипт для деплоя с локальной машины на сервер Digital Ocean
# Автоматически копирует .env и выполняет установку
# Использование: bash deploy-from-local.sh [SSH_KEY_PATH]

set -e

SERVER_IP="165.22.101.13"
SERVER_USER="root"
SSH_KEY="${1:-}"

# Определяем SSH команду
if [ -n "$SSH_KEY" ]; then
    SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"
else
    SSH_CMD="ssh -o StrictHostKeyChecking=no"
fi

echo "🚀 Деплой Henzo Backend на Digital Ocean"
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

# Копируем .env на сервер
echo "📤 Копирование .env на сервер..."
cat .env | $SSH_CMD ${SERVER_USER}@${SERVER_IP} "mkdir -p /var/www/henzo/apps/backend && cat > /var/www/henzo/apps/backend/.env.production"

# Выполняем установку на сервере
echo "▶️  Запуск установки на сервере..."
$SSH_CMD ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
set -e

HENZO_DIR="/var/www/henzo"
BACKEND_DIR="$HENZO_DIR/apps/backend"

echo "🚀 Начинаем установку..."

# Обновление системы
echo "📦 Обновление системы..."
apt update && apt upgrade -y

# Установка пакетов
echo "📦 Установка пакетов..."
apt install -y curl git docker.io docker-compose nginx ufw

# Docker
echo "🐳 Настройка Docker..."
systemctl enable docker
systemctl start docker

# Firewall
echo "🔥 Настройка firewall..."
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload

# Директории
echo "📁 Создание директорий..."
mkdir -p $BACKEND_DIR/deploy/ssl
mkdir -p /var/log/nginx

# Клонирование репозитория (если нужно)
if [ ! -d "$HENZO_DIR/.git" ]; then
    echo "⚠️  Репозиторий не найден. Клонируйте вручную:"
    echo "   cd /var/www/henzo && git clone YOUR_REPO_URL ."
    read -p "Нажмите Enter после клонирования репозитория..."
fi

# Переход в директорию
cd $BACKEND_DIR

# Проверка docker-compose.yml
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml не найден!"
    exit 1
fi

# Сборка
echo "🔨 Сборка Docker образов..."
docker-compose build

# Миграции
echo "🗄️  Применение миграций..."
read -p "Применить миграции Prisma? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose run --rm backend npx prisma migrate deploy || echo "⚠️  Ошибка миграций"
fi

# Запуск
echo "▶️  Запуск контейнеров..."
docker-compose up -d

# Ожидание
echo "⏳ Ожидание запуска (30 секунд)..."
sleep 30

# Проверка
echo ""
echo "📊 Статус контейнеров:"
docker-compose ps

echo ""
echo "🔍 Health check:"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || echo "000")
if [ "$HEALTH" = "200" ]; then
    echo "✅ Backend работает!"
    curl http://localhost/health
else
    echo "❌ Backend не отвечает (код: $HEALTH)"
    echo "Проверьте логи: docker-compose logs backend"
fi

echo ""
echo "✅ Установка завершена!"
echo ""
echo "📝 Полезные команды:"
echo "   Логи:    docker-compose logs -f backend"
echo "   Статус:  docker-compose ps"
echo "   Рестарт: docker-compose restart"
ENDSSH

echo ""
echo "=========================================="
echo "✅ Деплой завершен!"
echo "=========================================="
echo ""
echo "🌐 Проверка извне:"
echo "   curl http://${SERVER_IP}/health"
echo ""

