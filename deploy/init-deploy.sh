#!/bin/bash

# Скрипт для копирования на новый сервер и запуска первоначальной настройки
# Использование: bash init-deploy.sh

set -e

SERVER_IP="165.22.101.13"
REPO_URL="YOUR_GITHUB_REPO_URL"  # Замените на ваш репозиторий

echo "🚀 Инициализация деплоя на $SERVER_IP"
echo ""

# Копируем setup-server.sh на сервер
echo "📤 Копирование setup-server.sh на сервер..."
scp deploy/setup-server.sh root@$SERVER_IP:/tmp/

# Запускаем настройку сервера
echo "⚙️  Запуск настройки сервера..."
ssh root@$SERVER_IP "bash /tmp/setup-server.sh"

# Клонируем репозиторий
echo "📥 Клонирование репозитория..."
ssh root@$SERVER_IP "cd /var/www/henzo && git clone $REPO_URL ."

echo ""
echo "✅ Базовая настройка завершена!"
echo ""
echo "📝 Следующие шаги (выполнить на сервере):"
echo ""
echo "1. Подключитесь к серверу:"
echo "   ssh root@$SERVER_IP"
echo ""
echo "2. Создайте .env.production:"
echo "   cd /var/www/henzo/apps/backend"
echo "   cp deploy/.env.production.example .env.production"
echo "   nano .env.production"
echo ""
echo "3. Запустите деплой:"
echo "   bash deploy/deploy-docker.sh"
echo ""
