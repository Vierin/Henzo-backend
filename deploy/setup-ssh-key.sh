#!/bin/bash

# Скрипт для настройки SSH ключа для GitHub на сервере
# Запускать на сервере

set -e

echo "🔑 Настройка SSH ключа для GitHub"
echo "=========================================="
echo ""

# Проверка существующего ключа
SSH_DIR="$HOME/.ssh"
KEY_FILE="$SSH_DIR/id_ed25519"

if [ -f "$KEY_FILE" ]; then
    echo "⚠️  SSH ключ уже существует: $KEY_FILE"
    read -p "Сгенерировать новый ключ? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "✅ Используем существующий ключ"
        cat "$KEY_FILE.pub"
        exit 0
    fi
fi

# Создание директории .ssh если не существует
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

# Генерация SSH ключа
echo "🔑 Генерация нового SSH ключа..."
ssh-keygen -t ed25519 -C "henzo-server-$(hostname)" -f "$KEY_FILE" -N ""

# Установка правильных прав
chmod 600 "$KEY_FILE"
chmod 644 "$KEY_FILE.pub"

echo ""
echo "✅ SSH ключ создан!"
echo ""
echo "📋 Публичный ключ (скопируй и добавь в GitHub):"
echo "=========================================="
cat "$KEY_FILE.pub"
echo "=========================================="
echo ""

# Добавление GitHub в known_hosts
echo "🔍 Добавление GitHub в known_hosts..."
ssh-keyscan github.com >> "$SSH_DIR/known_hosts" 2>/dev/null || true
chmod 600 "$SSH_DIR/known_hosts"

echo ""
echo "📝 Инструкция:"
echo "1. Скопируй публичный ключ выше"
echo "2. Открой: https://github.com/settings/keys"
echo "3. Нажми 'New SSH key'"
echo "4. Вставь ключ и сохрани"
echo ""
echo "После добавления ключа проверь:"
echo "  ssh -T git@github.com"
echo ""

