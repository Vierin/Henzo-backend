#!/bin/bash

# Скрипт для очистки дискового пространства на сервере
# Запускать на сервере DigitalOcean

set -e

echo "🧹 Начинаем очистку дискового пространства..."

# Проверка текущего использования
echo ""
echo "📊 Текущее использование диска:"
df -h

echo ""
echo "🔍 Размер Docker:"
docker system df

# Остановка контейнеров (опционально, только если нужно)
read -p "Остановить контейнеры перед очисткой? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🛑 Остановка контейнеров..."
    cd /var/www/henzo/apps/backend 2>/dev/null || true
    docker-compose down 2>/dev/null || true
fi

# Очистка Docker
echo ""
echo "🗑️  Очистка неиспользуемых Docker ресурсов..."

# Удаление остановленных контейнеров
echo "  - Удаление остановленных контейнеров..."
docker container prune -f

# Удаление неиспользуемых образов
echo "  - Удаление неиспользуемых образов..."
docker image prune -af

# Удаление неиспользуемых volumes
echo "  - Удаление неиспользуемых volumes..."
docker volume prune -f

# Удаление неиспользуемых networks
echo "  - Удаление неиспользуемых networks..."
docker network prune -f

# Полная очистка Docker (build cache, все неиспользуемое)
echo "  - Полная очистка Docker (включая build cache)..."
docker system prune -af --volumes

# Очистка npm кеша (если есть)
echo ""
echo "🧹 Очистка npm кеша..."
npm cache clean --force 2>/dev/null || true

# Очистка старых логов (если они занимают много места)
echo ""
echo "🧹 Очистка старых логов..."
journalctl --vacuum-time=7d 2>/dev/null || true

# Очистка apt кеша
echo ""
echo "🧹 Очистка apt кеша..."
apt-get clean 2>/dev/null || true
apt-get autoclean 2>/dev/null || true

# Показать результаты
echo ""
echo "✅ Очистка завершена!"
echo ""
echo "📊 Использование диска после очистки:"
df -h

echo ""
echo "🔍 Размер Docker после очистки:"
docker system df

# Перезапуск контейнеров (если были остановлены)
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Запустить контейнеры обратно? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "▶️  Запуск контейнеров..."
        cd /var/www/henzo/apps/backend
        docker-compose up -d
    fi
fi

