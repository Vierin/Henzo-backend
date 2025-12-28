#!/bin/bash

# Скрипт для установки автоматической очистки через cron
# Запускать один раз на сервере

set -e

SCRIPT_DIR="/var/www/henzo/apps/backend/deploy"
CLEANUP_SCRIPT="$SCRIPT_DIR/auto-cleanup.sh"

echo "🔧 Установка автоматической очистки диска..."
echo ""

# Проверка что скрипт существует
if [ ! -f "$CLEANUP_SCRIPT" ]; then
    echo "❌ Ошибка: скрипт $CLEANUP_SCRIPT не найден!"
    exit 1
fi

# Делаем скрипт исполняемым
chmod +x "$CLEANUP_SCRIPT"

# Добавляем в crontab (еженедельно в воскресенье в 3 ночи)
CRON_JOB="0 3 * * 0 bash $CLEANUP_SCRIPT >> /var/log/docker-cleanup.log 2>&1"

# Проверяем есть ли уже такая задача
if crontab -l 2>/dev/null | grep -q "auto-cleanup.sh"; then
    echo "⚠️  Задача уже есть в crontab"
    echo "Текущий crontab:"
    crontab -l | grep "auto-cleanup"
    read -p "Заменить? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Удаляем старую задачу и добавляем новую
        crontab -l 2>/dev/null | grep -v "auto-cleanup.sh" | crontab -
        (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
        echo "✅ Задача обновлена"
    fi
else
    # Добавляем новую задачу
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Задача добавлена в crontab"
fi

echo ""
echo "📋 Текущий crontab:"
crontab -l

echo ""
echo "✅ Автоматическая очистка настроена!"
echo "   Скрипт будет запускаться каждое воскресенье в 3:00 ночи"
echo "   Логи будут сохраняться в /var/log/docker-cleanup.log"
echo ""
echo "💡 Для запуска вручную: bash $CLEANUP_SCRIPT"
echo "💡 Для удаления из cron: crontab -e"

