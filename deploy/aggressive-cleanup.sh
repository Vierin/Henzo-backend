#!/bin/bash

# Агрессивная очистка диска - освободит максимальное место
# ВНИМАНИЕ: Удалит все неиспользуемые Docker ресурсы!

set -e

echo "🧹 Агрессивная очистка диска..."
echo "ВНИМАНИЕ: Будет удалено всё неиспользуемое!"
echo ""

# Показать текущее использование
echo "📊 Использование ДО очистки:"
df -h | grep -E "Filesystem|/dev/vda"

# Остановка контейнеров
echo ""
echo "🛑 Остановка всех контейнеров..."
cd /var/www/henzo/apps/backend 2>/dev/null || true
docker-compose down 2>/dev/null || true

# Удаление ВСЕХ неиспользуемых образов (включая используемые контейнерами, но не запущенные)
echo ""
echo "🗑️  Удаление всех неиспользуемых Docker образов..."
docker image prune -af

# Удаление build cache
echo "🗑️  Удаление Docker build cache..."
docker builder prune -af

# Полная очистка Docker системы
echo "🗑️  Полная очистка Docker системы..."
docker system prune -af --volumes

# Очистка npm кеша
echo "🗑️  Очистка npm кеша..."
npm cache clean --force 2>/dev/null || true
rm -rf ~/.npm/_cacache 2>/dev/null || true
rm -rf /root/.npm/_cacache 2>/dev/null || true

# Очистка старых логов журнала (оставить только последние 3 дня)
echo "🗑️  Очистка старых логов системы (оставить последние 3 дня)..."
journalctl --vacuum-time=3d 2>/dev/null || true

# Очистка apt кеша
echo "🗑️  Очистка apt кеша..."
apt-get clean 2>/dev/null || true
apt-get autoclean 2>/dev/null || true

# Очистка старых логов в /var/log
echo "🗑️  Очистка старых логов в /var/log..."
find /var/log -type f -name "*.log" -mtime +7 -delete 2>/dev/null || true
find /var/log -type f -name "*.gz" -delete 2>/dev/null || true

# Удаление старых ядер (оставить только текущее)
echo "🗑️  Проверка старых ядер Linux..."
OLD_KERNELS=$(dpkg -l | grep -E 'linux-image-[0-9]' | grep -v $(uname -r) | awk '{print $2}')
if [ ! -z "$OLD_KERNELS" ]; then
    echo "  Найдены старые ядра, можно удалить: $OLD_KERNELS"
    read -p "  Удалить старые ядра? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        apt-get purge -y $OLD_KERNELS 2>/dev/null || true
    fi
fi

# Показать результаты
echo ""
echo "✅ Очистка завершена!"
echo ""
echo "📊 Использование ПОСЛЕ очистки:"
df -h | grep -E "Filesystem|/dev/vda"

echo ""
echo "🔍 Docker использование:"
docker system df 2>/dev/null || echo "Docker не запущен"

# Перезапуск контейнеров
echo ""
read -p "Запустить контейнеры обратно? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "▶️  Запуск контейнеров..."
    cd /var/www/henzo/apps/backend
    docker-compose up -d
fi

