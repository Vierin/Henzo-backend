#!/bin/bash

# Скрипт для анализа использования диска
# Показывает что занимает больше всего места

echo "📊 Анализ использования диска..."
echo "================================"
echo ""

echo "📁 Топ-10 самых больших директорий в корне:"
du -sh /* 2>/dev/null | sort -h | tail -10

echo ""
echo "📁 Топ-10 самых больших директорий в /var:"
du -sh /var/* 2>/dev/null | sort -h | tail -10

echo ""
echo "🐳 Docker использование:"
docker system df -v 2>/dev/null || echo "Docker не запущен или не установлен"

echo ""
echo "📦 Размер node_modules (если есть):"
find /var/www -name "node_modules" -type d -exec du -sh {} \; 2>/dev/null | head -10

echo ""
echo "📦 Размер Docker образов:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" 2>/dev/null || echo "Docker не запущен"

echo ""
echo "📦 Размер Docker volumes:"
docker volume ls -q | xargs -r docker volume inspect 2>/dev/null | grep -E "Mountpoint|Name" || echo "Нет volumes"

echo ""
echo "🗄️  Размер логов журнала:"
journalctl --disk-usage 2>/dev/null || echo "Не удалось проверить логи"

echo ""
echo "📁 Размер .npm кеша:"
du -sh ~/.npm 2>/dev/null || du -sh /root/.npm 2>/dev/null || echo "npm кеш не найден"

echo ""
echo "📁 Размер Docker build cache:"
du -sh /var/lib/docker 2>/dev/null | head -1 || echo "Docker директория не найдена"

echo ""
echo "✅ Анализ завершен"

