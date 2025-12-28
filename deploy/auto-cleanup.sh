#!/bin/bash

# Автоматическая очистка диска
# Запускается автоматически и очищает только безопасные ресурсы
# Можно добавить в cron для регулярного запуска

set -e

LOG_FILE="/var/log/docker-cleanup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🧹 Начинаем автоматическую очистку..."

# Проверка использования диска
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
log "📊 Текущее использование диска: ${DISK_USAGE}%"

# Очистка build cache (безопасно, не затрагивает работающие контейнеры)
log "🗑️  Очистка Docker build cache (старше 24 часов)..."
BUILD_CACHE_CLEANED=$(docker builder prune -af --filter "until=24h" 2>&1 | grep -oP 'Total:\s+\K[\d.]+[A-Z]+' || echo "0B")
log "   Освобождено: $BUILD_CACHE_CLEANED"

# Очистка остановленных контейнеров (безопасно)
log "🗑️  Очистка остановленных контейнеров..."
CONTAINERS_CLEANED=$(docker container prune -f 2>&1 | grep -oP 'Total:\s+\K[\d.]+[A-Z]+' || echo "0B")
log "   Освобождено: $CONTAINERS_CLEANED"

# Очистка неиспользуемых образов (безопасно, только dangling)
log "🗑️  Очистка dangling образов..."
IMAGES_CLEANED=$(docker image prune -f 2>&1 | grep -oP 'Total:\s+\K[\d.]+[A-Z]+' || echo "0B")
log "   Освобождено: $IMAGES_CLEANED"

# Очистка неиспользуемых volumes (осторожно, только действительно неиспользуемые)
log "🗑️  Очистка неиспользуемых volumes..."
VOLUMES_CLEANED=$(docker volume prune -f 2>&1 | grep -oP 'Total:\s+\K[\d.]+[A-Z]+' || echo "0B")
log "   Освобождено: $VOLUMES_CLEANED"

# Очистка старых логов Docker (если используются json-file driver)
log "🗑️  Очистка старых логов контейнеров..."
find /var/lib/docker/containers/ -name "*-json.log" -mtime +7 -delete 2>/dev/null || true

# Показать результаты
NEW_DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
log "📊 Использование диска после очистки: ${NEW_DISK_USAGE}%"

log "✅ Автоматическая очистка завершена"

# Если диск все еще заполнен больше чем на 85%, показать предупреждение
if [ "$NEW_DISK_USAGE" -gt 85 ]; then
    log "⚠️  ВНИМАНИЕ: Использование диска все еще высокое (${NEW_DISK_USAGE}%)"
    log "   Рекомендуется запустить агрессивную очистку: bash deploy/aggressive-cleanup.sh"
fi

