#!/bin/bash

# Скрипт для деплоя Henzo Backend
# Запускать из директории /var/www/henzo/apps/backend

set -e

echo "🚀 Начинаем деплой Henzo Backend..."

# Проверка .env файла
if [ ! -f .env.production ]; then
    echo "❌ Ошибка: файл .env.production не найден!"
    echo "📝 Создайте файл .env.production с необходимыми переменными"
    exit 1
fi

# Копирование production env
cp .env.production .env

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm ci --only=production

# Генерация Prisma Client
echo "🔧 Генерация Prisma Client..."
npx prisma generate

# Применение миграций (осторожно на production!)
read -p "Применить миграции базы данных? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗄️  Применение миграций..."
    npx prisma migrate deploy
fi

# Сборка приложения
echo "🔨 Сборка приложения..."
npm run build

# Перезапуск PM2
echo "🔄 Перезапуск приложения через PM2..."
if pm2 list | grep -q "henzo-backend"; then
    pm2 reload henzo-backend --update-env
else
    pm2 start ecosystem.config.js
    pm2 save
fi

# Показываем логи
echo "✅ Деплой завершен!"
echo "📊 Статус приложения:"
pm2 status
echo ""
echo "📝 Логи в реальном времени:"
echo "   pm2 logs henzo-backend"
