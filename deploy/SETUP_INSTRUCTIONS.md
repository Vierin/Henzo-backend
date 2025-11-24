# Инструкция по автоматической установке на Digital Ocean

## Что нужно перед запуском

### 1. Данные для .env.production

Подготовьте следующие данные:

- **DATABASE_URL** - из Supabase Dashboard → Settings → Database → Connection String (Connection pooling, порт 6543)
- **DIRECT_URL** - из Supabase Dashboard → Settings → Database → Connection String (Direct connection, порт 5432)
- **SUPABASE_URL** - из Supabase Dashboard → Settings → API → Project URL
- **SUPABASE_KEY** - из Supabase Dashboard → Settings → API → anon/public key
- **SUPABASE_SERVICE_ROLE_KEY** - из Supabase Dashboard → Settings → API → service_role key (секретный!)
- **BREVO_API_KEY** - из https://app.brevo.com/settings/keys/api
- **FRONTEND_URL** - URL вашего фронтенда на Vercel (например, https://henzo.app)
- **EMAIL_FROM** - email для отправки писем (например, noreply@henzo.app)
- **EMAIL_FROM_NAME** - имя отправителя (например, Henzo)

### 2. SSH доступ к серверу

Убедитесь, что у вас есть:
- IP сервера: `165.22.101.13`
- SSH ключ или пароль для root

## Вариант 1: Автоматическая установка (рекомендуется)

### Шаг 1: Подключитесь к серверу

```bash
ssh root@165.22.101.13
```

### Шаг 2: Загрузите скрипт установки

```bash
# Создайте директорию
mkdir -p /var/www/henzo/apps/backend/deploy
cd /var/www/henzo/apps/backend/deploy

# Загрузите скрипт (замените на ваш способ)
# Вариант A: Если код уже на сервере
# Просто перейдите в директорию проекта

# Вариант B: Скачайте скрипт напрямую
curl -o full-setup.sh https://raw.githubusercontent.com/YOUR_REPO/main/apps/backend/deploy/full-setup.sh
chmod +x full-setup.sh
```

### Шаг 3: Запустите установку

```bash
bash full-setup.sh
```

Скрипт автоматически:
- ✅ Обновит систему
- ✅ Установит Docker и Docker Compose
- ✅ Настроит firewall
- ✅ Клонирует репозиторий (если нужно)
- ✅ Создаст .env.production
- ✅ Сгенерирует JWT_SECRET
- ✅ Соберет Docker образы
- ✅ Запустит контейнеры
- ✅ Настроит SSL (опционально)

### Шаг 4: Заполните .env.production

Скрипт остановится и попросит заполнить `.env.production`. Откройте файл:

```bash
nano /var/www/henzo/apps/backend/.env.production
```

Вставьте все необходимые переменные из шага 1.

### Шаг 5: Завершите установку

После сохранения `.env.production`, скрипт продолжит работу автоматически.

## Вариант 2: Ручная установка

Если автоматический скрипт не подходит, следуйте инструкциям в `DEPLOY.md`.

## После установки

### Проверка работы

```bash
# Проверка статуса
cd /var/www/henzo/apps/backend
docker-compose ps

# Health check
curl http://localhost/health

# Проверка извне
curl http://165.22.101.13/health
```

### Просмотр логов

```bash
cd /var/www/henzo/apps/backend

# Все логи
docker-compose logs -f

# Только backend
docker-compose logs -f backend

# Только nginx
docker-compose logs -f nginx
```

### Перезапуск после изменений

```bash
cd /var/www/henzo/apps/backend

# После изменения .env.production
docker-compose restart backend

# После изменения кода
git pull
docker-compose build
docker-compose up -d
```

## Настройка SSL (опционально)

Если у вас есть домен `api.henzo.app`:

1. Настройте A-запись DNS на `165.22.101.13`
2. Запустите скрипт настройки SSL:

```bash
cd /var/www/henzo/apps/backend
bash deploy/setup-ssl.sh api.henzo.app
```

## Важные замечания

1. **Supabase IP Whitelist**: Добавьте IP `165.22.101.13` в список разрешенных IP в Supabase Dashboard → Settings → Database → Connection Pooling → Allowed IPs

2. **Переменные окружения**: Все переменные в `.env.production` должны быть заполнены, иначе бэкенд не запустится

3. **Порты**: Убедитесь, что порты 80 и 443 открыты в firewall

4. **Логи**: При проблемах всегда проверяйте логи: `docker-compose logs backend`

## Troubleshooting

### Backend не запускается

```bash
# Проверьте логи
docker-compose logs backend

# Проверьте .env
docker-compose exec backend env | grep DATABASE_URL

# Перезапустите
docker-compose restart backend
```

### 502 Bad Gateway

```bash
# Проверьте что backend запущен
docker-compose ps

# Проверьте health endpoint внутри контейнера
docker-compose exec backend curl http://localhost:3001/health
```

### Проблемы с базой данных

1. Проверьте `DATABASE_URL` в `.env.production`
2. Убедитесь, что IP сервера добавлен в Supabase whitelist
3. Проверьте логи: `docker-compose logs backend | grep -i database`

## Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker-compose logs -f`
2. Проверьте статус: `docker-compose ps`
3. Проверьте health: `curl http://localhost/health`

