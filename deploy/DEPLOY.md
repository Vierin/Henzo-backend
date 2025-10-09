# Деплой Henzo Backend на DigitalOcean с Docker

## Быстрый старт

### 1. Первоначальная настройка сервера (один раз)

```bash
# Подключение к серверу
ssh root@165.22.101.13

# Запуск скрипта настройки
curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/apps/backend/deploy/setup-server.sh | bash
```

Или вручную:

```bash
ssh root@165.22.101.13
cd /tmp
# Скопируйте setup-server.sh на сервер
bash setup-server.sh
```

### 2. Клонирование репозитория

```bash
cd /var/www/henzo
git clone YOUR_REPO_URL .

# Или если репозиторий приватный
git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/henzo.git .
```

### 3. Настройка окружения

```bash
cd /var/www/henzo/apps/backend

# Создайте .env.production
cp deploy/.env.production.example .env.production
nano .env.production
```

Заполните все необходимые переменные:

- `DATABASE_URL` - из Supabase (Connection pooling)
- `DIRECT_URL` - из Supabase (Direct connection)
- `SUPABASE_URL` и `SUPABASE_KEY`
- `JWT_SECRET` - генерируйте: `openssl rand -base64 32`
- `FRONTEND_URL` - ваш домен на Vercel
- Остальные ключи API

### 4. Первый деплой

```bash
cd /var/www/henzo/apps/backend
bash deploy/deploy-docker.sh
```

Скрипт спросит:

- Удалить старые образы? (y/n) - при первом деплое можно n
- Применить миграции? (y/n) - при первом деплое обязательно y

### 5. Проверка

```bash
# Статус контейнеров
docker-compose ps

# Логи
docker-compose logs -f

# Health check
curl http://165.22.101.13/health

# Или с другой машины
curl http://165.22.101.13/health
```

## Обновление кода

### Обычное обновление (с пересборкой)

```bash
ssh root@165.22.101.13
cd /var/www/henzo/apps/backend
bash deploy/quick-update.sh
```

### Полный деплой (с миграциями)

```bash
ssh root@165.22.101.13
cd /var/www/henzo/apps/backend
bash deploy/deploy-docker.sh
```

## Полезные команды

```bash
# Логи всех сервисов
docker-compose logs -f

# Логи только backend
docker-compose logs -f backend

# Логи только nginx
docker-compose logs -f nginx

# Статус контейнеров
docker-compose ps

# Перезапуск сервиса
docker-compose restart backend

# Остановка всех сервисов
docker-compose down

# Запуск всех сервисов
docker-compose up -d

# Выполнить команду в контейнере
docker-compose exec backend sh

# Применить миграции вручную
docker-compose run --rm backend npx prisma migrate deploy

# Посмотреть использование ресурсов
docker stats
```

## Масштабирование

### Увеличить количество инстансов backend

```bash
# Редактируйте docker-compose.yml
nano docker-compose.yml
```

Добавьте:

```yaml
services:
  backend:
    deploy:
      replicas: 3 # количество инстансов
```

Или запустите:

```bash
docker-compose up -d --scale backend=3
```

### Мониторинг

Установка мониторинга (опционально):

```bash
# Установить ctop для мониторинга контейнеров
docker run --rm -ti \
  --name=ctop \
  --volume /var/run/docker.sock:/var/run/docker.sock:ro \
  quay.io/vektorlab/ctop:latest
```

## SSL/HTTPS (Опционально)

### Настройка домена

1. Укажите A-запись вашего домена на IP: 165.22.101.13

2. Установите Certbot:

```bash
apt install -y certbot

# Получите сертификат
certbot certonly --standalone -d api.yourdomain.com

# Сертификаты будут в /etc/letsencrypt/live/api.yourdomain.com/
```

3. Обновите docker-compose.yml:

```yaml
nginx:
  volumes:
    - /etc/letsencrypt:/etc/nginx/ssl:ro
```

4. Раскомментируйте HTTPS блок в deploy/nginx.conf

5. Перезапустите:

```bash
docker-compose restart nginx
```

## Бэкапы

### База данных

База на Supabase - бэкапы настраиваются там автоматически.

### Код и конфигурация

```bash
# Создать бэкап .env
cp .env.production .env.production.backup.$(date +%Y%m%d)
```

## Откат на предыдущую версию

```bash
cd /var/www/henzo
git log --oneline  # найдите нужный коммит
git checkout COMMIT_HASH

cd apps/backend
bash deploy/quick-update.sh
```

## Troubleshooting

### Backend не запускается

```bash
# Смотрим логи
docker-compose logs backend

# Проверяем .env файл
docker-compose exec backend env | grep DATABASE_URL

# Перезапускаем с чистого листа
docker-compose down
docker-compose up -d
```

### Нет подключения к БД

```bash
# Проверьте DATABASE_URL в .env.production
# Убедитесь что IP сервера добавлен в allowed connections Supabase
```

### 502 Bad Gateway

```bash
# Проверьте что backend запущен
docker-compose ps

# Проверьте логи nginx
docker-compose logs nginx

# Проверьте health endpoint
docker-compose exec backend curl http://localhost:3001/health
```

## Контакты и поддержка

IP сервера: 165.22.101.13
Backend URL: http://165.22.101.13
Health check: http://165.22.101.13/health
