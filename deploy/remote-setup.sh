#!/bin/bash

# Скрипт для автоматической установки на удаленный сервер
# Использование: bash remote-setup.sh [SSH_KEY_PATH]
# Если SSH_KEY_PATH не указан, будет использован пароль

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Параметры
SERVER_IP="165.22.101.13"
SERVER_USER="root"
SSH_KEY="${1:-}"

echo -e "${GREEN}🚀 Автоматическая установка Henzo Backend на Digital Ocean${NC}"
echo "=========================================="
echo ""

# Проверка наличия .env файла
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Файл .env не найден в текущей директории!${NC}"
    echo "Убедитесь, что вы находитесь в apps/backend/"
    exit 1
fi

echo -e "${GREEN}✅ Файл .env найден${NC}"

# Проверка SSH подключения
echo ""
echo "🔌 Проверка подключения к серверу..."
if [ -n "$SSH_KEY" ]; then
    SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"
else
    SSH_CMD="ssh -o StrictHostKeyChecking=no"
fi

# Тест подключения
if $SSH_CMD ${SERVER_USER}@${SERVER_IP} "echo 'Connection test'" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Подключение к серверу успешно${NC}"
else
    echo -e "${RED}❌ Не удалось подключиться к серверу${NC}"
    echo "Проверьте:"
    echo "  - SSH доступ к $SERVER_IP"
    echo "  - Правильность SSH ключа (если используется)"
    exit 1
fi

# Создание временного скрипта установки на сервере
echo ""
echo "📦 Подготовка установки на сервере..."

# Читаем .env файл и создаем команды для передачи
ENV_CONTENT=$(cat "$ENV_FILE")

# Создаем скрипт установки
cat > /tmp/henzo-remote-install.sh << 'REMOTE_SCRIPT'
#!/bin/bash
set -e

HENZO_DIR="/var/www/henzo"
BACKEND_DIR="$HENZO_DIR/apps/backend"

echo "🚀 Начинаем установку..."

# 1. Обновление системы
echo "📦 Обновление системы..."
apt update && apt upgrade -y

# 2. Установка пакетов
echo "📦 Установка необходимых пакетов..."
apt install -y curl git docker.io docker-compose nginx certbot python3-certbot-nginx ufw fail2ban

# 3. Настройка Docker
echo "🐳 Настройка Docker..."
systemctl enable docker
systemctl start docker

# 4. Настройка firewall
echo "🔥 Настройка firewall..."
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload

# 5. Создание директорий
echo "📁 Создание директорий..."
mkdir -p $HENZO_DIR
mkdir -p $BACKEND_DIR
mkdir -p $BACKEND_DIR/deploy/ssl
mkdir -p /var/log/nginx

# 6. Клонирование репозитория (если нужно)
if [ ! -d "$HENZO_DIR/.git" ]; then
    echo "⚠️  Репозиторий не найден. Необходимо клонировать вручную."
    echo "Выполните: cd /var/www/henzo && git clone YOUR_REPO_URL ."
fi

echo "✅ Базовая настройка завершена"
REMOTE_SCRIPT

# Копируем скрипт на сервер
echo "📤 Копирование скрипта установки на сервер..."
$SSH_CMD ${SERVER_USER}@${SERVER_IP} "cat > /tmp/henzo-install.sh" < /tmp/henzo-remote-install.sh
$SSH_CMD ${SERVER_USER}@${SERVER_IP} "chmod +x /tmp/henzo-install.sh"

# Копируем .env файл
echo "📤 Копирование .env файла на сервер..."
echo "$ENV_CONTENT" | $SSH_CMD ${SERVER_USER}@${SERVER_IP} "cat > $BACKEND_DIR/.env.production"

# Запускаем установку на сервере
echo ""
echo "▶️  Запуск установки на сервере..."
$SSH_CMD ${SERVER_USER}@${SERVER_IP} "bash /tmp/henzo-install.sh"

# Копируем код проекта (если нужно)
echo ""
read -p "Клонировать репозиторий на сервер? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Введите URL репозитория: " REPO_URL
    if [ ! -z "$REPO_URL" ]; then
        echo "📥 Клонирование репозитория..."
        $SSH_CMD ${SERVER_USER}@${SERVER_IP} "cd /var/www/henzo && git clone $REPO_URL . || echo 'Репозиторий уже существует'"
    fi
fi

# Запуск Docker контейнеров
echo ""
echo "🐳 Настройка Docker контейнеров..."
$SSH_CMD ${SERVER_USER}@${SERVER_IP} << 'DOCKER_SETUP'
cd /var/www/henzo/apps/backend

# Проверка docker-compose.yml
if [ ! -f docker-compose.yml ]; then
    echo "❌ docker-compose.yml не найден!"
    exit 1
fi

# Сборка
echo "🔨 Сборка Docker образов..."
docker-compose build

# Применение миграций
echo "🗄️  Применение миграций..."
docker-compose run --rm backend npx prisma migrate deploy || echo "⚠️  Ошибка миграций (возможно БД недоступна)"

# Запуск
echo "▶️  Запуск контейнеров..."
docker-compose up -d

# Ожидание
echo "⏳ Ожидание запуска (30 секунд)..."
sleep 30

# Проверка
echo "🔍 Проверка статуса..."
docker-compose ps

echo ""
echo "🔍 Health check..."
curl -f http://localhost/health && echo "✅ Backend работает!" || echo "❌ Backend не отвечает"
DOCKER_SETUP

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Установка завершена!${NC}"
echo "=========================================="
echo ""
echo "📝 Проверка работы:"
echo "  ssh ${SERVER_USER}@${SERVER_IP}"
echo "  cd /var/www/henzo/apps/backend"
echo "  docker-compose ps"
echo "  curl http://localhost/health"
echo ""
echo "🌐 Проверка извне:"
echo "  curl http://${SERVER_IP}/health"
echo ""

# Очистка
rm -f /tmp/henzo-remote-install.sh

