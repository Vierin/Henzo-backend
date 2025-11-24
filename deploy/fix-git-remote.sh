#!/bin/bash

# Скрипт для настройки SSH ключа для GitHub
# Настраивает SSH ключ вместо переключения на HTTPS

set -e

BACKEND_DIR="/var/www/henzo/apps/backend"

echo "🔧 Настройка SSH для GitHub"
echo "=========================================="
echo ""

cd $BACKEND_DIR

# Проверка текущего remote
echo "📋 Текущий remote:"
git remote -v
echo ""

# Проверка SSH ключа
SSH_DIR="$HOME/.ssh"
KEY_FILE="$SSH_DIR/id_ed25519"

if [ ! -f "$KEY_FILE" ]; then
    echo "🔑 SSH ключ не найден, генерирую..."
    mkdir -p "$SSH_DIR"
    chmod 700 "$SSH_DIR"
    ssh-keygen -t ed25519 -C "henzo-server-$(hostname)" -f "$KEY_FILE" -N ""
    chmod 600 "$KEY_FILE"
    chmod 644 "$KEY_FILE.pub"
    echo "✅ SSH ключ создан"
else
    echo "✅ SSH ключ уже существует"
fi

echo ""
echo "📋 Публичный ключ (добавь в GitHub):"
echo "=========================================="
cat "$KEY_FILE.pub"
echo "=========================================="
echo ""

# Добавление GitHub в known_hosts
echo "🔍 Добавление GitHub в known_hosts..."
ssh-keyscan github.com >> "$SSH_DIR/known_hosts" 2>/dev/null || true
chmod 600 "$SSH_DIR/known_hosts" 2>/dev/null || true

# Тест подключения
echo ""
echo "🔍 Тест подключения к GitHub..."
if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    echo "✅ SSH ключ уже настроен в GitHub!"
elif ssh -T git@github.com 2>&1 | grep -q "Permission denied"; then
    echo "⚠️  SSH ключ еще не добавлен в GitHub"
    echo ""
    echo "📝 Инструкция:"
    echo "1. Скопируй публичный ключ выше"
    echo "2. Открой: https://github.com/settings/keys"
    echo "3. Нажми 'New SSH key'"
    echo "4. Вставь ключ и сохрани"
    echo ""
    echo "После добавления проверь:"
    echo "  ssh -T git@github.com"
    echo ""
    exit 1
else
    echo "⚠️  Не удалось проверить подключение"
fi

# Тест git pull
echo ""
echo "🔍 Тест git pull..."
if git pull origin main --dry-run > /dev/null 2>&1; then
    echo "✅ Git pull работает!"
else
    echo "⚠️  Git pull не работает, проверь SSH ключ в GitHub"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ SSH настроен!"
echo "=========================================="
echo ""

