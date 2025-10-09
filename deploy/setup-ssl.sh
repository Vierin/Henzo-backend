#!/bin/bash

# Скрипт для настройки SSL с Let's Encrypt для api.henzo.app
# Запускать после того как DNS настроен и резолвится

set -e

DOMAIN="api.henzo.app"
EMAIL="contact@henzo.app"

echo "🔒 Настройка SSL для $DOMAIN..."

# Проверка DNS
echo "📡 Проверка DNS..."
if ! nslookup $DOMAIN | grep -q "Address:"; then
    echo "❌ DNS для $DOMAIN еще не настроен!"
    echo "Добавьте A-запись: api → 165.22.101.13"
    exit 1
fi

echo "✓ DNS настроен правильно"

# Остановка docker контейнеров (чтобы освободить порты)
echo "🛑 Остановка контейнеров..."
cd /var/www/henzo/apps/backend
docker-compose down

# Установка certbot если нет
if ! command -v certbot &> /dev/null; then
    echo "📦 Установка certbot..."
    apt update
    apt install -y certbot
fi

# Получение SSL сертификата
echo "📜 Получение SSL сертификата..."
certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email $EMAIL \
    -d $DOMAIN

echo "✓ Сертификат получен"

# Создание директории для SSL в проекте
mkdir -p /var/www/henzo/apps/backend/deploy/ssl

# Копирование сертификатов
echo "📋 Копирование сертификатов..."
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /var/www/henzo/apps/backend/deploy/ssl/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /var/www/henzo/apps/backend/deploy/ssl/

# Создание nginx конфига с HTTPS
cat > /var/www/henzo/apps/backend/deploy/nginx-ssl.conf <<'EOF'
upstream backend {
    server backend:3001;
    keepalive 64;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name api.henzo.app;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name api.henzo.app;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Ограничения
    client_max_body_size 10M;
    client_body_timeout 30s;
    client_header_timeout 30s;

    # Логи
    access_log /var/log/nginx/henzo-access.log;
    error_log /var/log/nginx/henzo-error.log warn;

    # Health check endpoint (без логов)
    location /health {
        proxy_pass http://backend/health;
        access_log off;
    }

    # Основное проксирование
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;

        # Заголовки
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Буферизация
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;

        proxy_cache_bypass $http_upgrade;
    }

    # Отключаем логи для статики (если будет)
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://backend;
        expires 30d;
        access_log off;
    }
}
EOF

# Обновление docker-compose для использования нового nginx конфига
echo "📝 Обновление docker-compose.yml..."
cd /var/www/henzo/apps/backend
sed -i 's|./deploy/nginx.conf|./deploy/nginx-ssl.conf|g' docker-compose.yml

# Запуск контейнеров
echo "🚀 Запуск контейнеров с SSL..."
docker-compose up -d

echo ""
echo "✅ SSL настроен успешно!"
echo ""
echo "📊 Проверка:"
echo "curl https://api.henzo.app/health"
echo ""
echo "🔄 Для автоматического обновления сертификата (каждые 3 месяца):"
echo "Добавьте в crontab:"
echo "0 0 1 */3 * certbot renew --quiet && cp /etc/letsencrypt/live/api.henzo.app/*.pem /var/www/henzo/apps/backend/deploy/ssl/ && cd /var/www/henzo/apps/backend && docker-compose restart nginx"

