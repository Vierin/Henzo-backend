#!/bin/bash

# Полная автоматическая установка Henzo Backend на Digital Ocean
# Запускать на сервере: bash full-setup.sh

set -e

echo "🚀 Начинаем полную установку Henzo Backend на Digital Ocean"
echo "=========================================="

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Пожалуйста, запустите скрипт от root${NC}"
    exit 1
fi

# Переменные
HENZO_DIR="/var/www/henzo"
BACKEND_DIR="$HENZO_DIR/apps/backend"
REPO_URL="${REPO_URL:-}"  # Можно задать через переменную окружения

echo -e "${GREEN}✅ Скрипт запущен от root${NC}"

# 1. Обновление системы
echo ""
echo "📦 Обновление системы..."
apt update && apt upgrade -y

# 2. Установка необходимых пакетов
echo ""
echo "📦 Установка необходимых пакетов..."
apt install -y \
    curl \
    git \
    docker.io \
    docker-compose \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw \
    fail2ban

# 3. Настройка Docker
echo ""
echo "🐳 Настройка Docker..."
systemctl enable docker
systemctl start docker
usermod -aG docker $USER 2>/dev/null || true

# 4. Настройка firewall
echo ""
echo "🔥 Настройка firewall..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw reload

# 5. Создание директорий
echo ""
echo "📁 Создание директорий..."
mkdir -p $HENZO_DIR
mkdir -p $BACKEND_DIR
mkdir -p $BACKEND_DIR/deploy/ssl
mkdir -p /var/log/nginx

# 6. Клонирование репозитория (если не существует)
if [ ! -d "$HENZO_DIR/.git" ]; then
    echo ""
    echo "📥 Клонирование репозитория..."
    if [ -z "$REPO_URL" ]; then
        read -p "Введите URL репозитория (или нажмите Enter для пропуска): " REPO_URL
    fi
    
    if [ ! -z "$REPO_URL" ]; then
        cd $HENZO_DIR
        git clone $REPO_URL . || {
            echo -e "${YELLOW}⚠️  Репозиторий уже существует или ошибка клонирования${NC}"
        }
    else
        echo -e "${YELLOW}⚠️  Пропуск клонирования. Убедитесь, что код уже в $HENZO_DIR${NC}"
    fi
else
    echo -e "${GREEN}✅ Репозиторий уже существует${NC}"
    cd $HENZO_DIR
    git pull || echo -e "${YELLOW}⚠️  Не удалось обновить репозиторий${NC}"
fi

# 7. Настройка .env.production
echo ""
echo "⚙️  Настройка переменных окружения..."
cd $BACKEND_DIR

if [ ! -f .env.production ]; then
    echo ""
    echo "📝 Создание .env.production..."
    
    # Копируем шаблон если есть
    if [ -f deploy/env-template.txt ]; then
        cp deploy/env-template.txt .env.production
    else
        touch .env.production
    fi
    
    echo ""
    echo -e "${YELLOW}⚠️  ВАЖНО: Необходимо заполнить .env.production${NC}"
    echo "Откройте файл: nano $BACKEND_DIR/.env.production"
    echo ""
    echo "Минимально необходимые переменные:"
    echo "  - DATABASE_URL (из Supabase)"
    echo "  - DIRECT_URL (из Supabase)"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_KEY"
    echo "  - SUPABASE_SERVICE_ROLE_KEY"
    echo "  - JWT_SECRET (сгенерируйте: openssl rand -base64 32)"
    echo "  - BREVO_API_KEY"
    echo "  - FRONTEND_URL (ваш домен на Vercel)"
    echo ""
    
    read -p "Нажмите Enter после заполнения .env.production..."
else
    echo -e "${GREEN}✅ .env.production уже существует${NC}"
fi

# 8. Генерация JWT_SECRET если не задан
if ! grep -q "JWT_SECRET=" .env.production || grep -q "JWT_SECRET=.*YOUR.*" .env.production; then
    echo ""
    echo "🔑 Генерация JWT_SECRET..."
    JWT_SECRET=$(openssl rand -base64 32)
    if grep -q "JWT_SECRET=" .env.production; then
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET\"|" .env.production
    else
        echo "JWT_SECRET=\"$JWT_SECRET\"" >> .env.production
    fi
    echo -e "${GREEN}✅ JWT_SECRET сгенерирован${NC}"
fi

# 9. Проверка Docker Compose
echo ""
echo "🐳 Проверка Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    echo "Установка docker-compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# 10. Сборка и запуск
echo ""
echo "🔨 Сборка Docker образов..."
cd $BACKEND_DIR
docker-compose build

echo ""
echo "🗄️  Применение миграций базы данных..."
read -p "Применить миграции Prisma? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose run --rm backend npx prisma migrate deploy || {
        echo -e "${YELLOW}⚠️  Ошибка миграций. Проверьте DATABASE_URL${NC}"
    }
fi

echo ""
echo "▶️  Запуск контейнеров..."
docker-compose up -d

# 11. Ожидание запуска
echo ""
echo "⏳ Ожидание запуска сервисов (30 секунд)..."
sleep 30

# 12. Проверка статуса
echo ""
echo "📊 Проверка статуса контейнеров..."
docker-compose ps

echo ""
echo "🔍 Health check..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || echo "000")
if [ "$HEALTH_CHECK" = "200" ]; then
    echo -e "${GREEN}✅ Backend работает!${NC}"
    curl http://localhost/health
else
    echo -e "${RED}❌ Backend не отвечает (код: $HEALTH_CHECK)${NC}"
    echo "Проверьте логи: docker-compose logs backend"
fi

# 13. Настройка SSL (опционально)
echo ""
read -p "Настроить SSL сертификат? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Введите домен для API (например, api.henzo.app): " DOMAIN
    if [ ! -z "$DOMAIN" ]; then
        echo "Настройка SSL для $DOMAIN..."
        bash $BACKEND_DIR/deploy/setup-ssl.sh $DOMAIN || {
            echo -e "${YELLOW}⚠️  Ошибка настройки SSL. Проверьте домен и DNS записи${NC}"
        }
    fi
fi

# 14. Финальная информация
echo ""
echo "=========================================="
echo -e "${GREEN}✅ Установка завершена!${NC}"
echo "=========================================="
echo ""
echo "📝 Полезные команды:"
echo "  Логи backend:    cd $BACKEND_DIR && docker-compose logs -f backend"
echo "  Логи nginx:       cd $BACKEND_DIR && docker-compose logs -f nginx"
echo "  Перезапуск:       cd $BACKEND_DIR && docker-compose restart"
echo "  Статус:           cd $BACKEND_DIR && docker-compose ps"
echo "  Health check:     curl http://localhost/health"
echo ""
echo "🌐 Проверка извне:"
echo "  curl http://165.22.101.13/health"
if [ ! -z "$DOMAIN" ]; then
    echo "  curl https://$DOMAIN/health"
fi
echo ""
echo "📧 Для настройки .env.production:"
echo "  nano $BACKEND_DIR/.env.production"
echo ""
echo -e "${YELLOW}⚠️  Не забудьте:${NC}"
echo "  1. Заполнить все переменные в .env.production"
echo "  2. Добавить IP сервера (165.22.101.13) в allowed IPs Supabase"
echo "  3. Настроить DNS записи для домена (если используется)"
echo "  4. Перезапустить контейнеры после изменения .env: docker-compose restart"
echo ""

