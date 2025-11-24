# Быстрая установка на Digital Ocean

## Автоматическая установка (рекомендуется)

### Вариант 1: Используя скрипт remote-setup.sh

Скрипт автоматически:
- ✅ Подключится к серверу
- ✅ Установит все зависимости
- ✅ Скопирует .env файл
- ✅ Соберет и запустит Docker контейнеры

**Запуск:**

```bash
cd apps/backend
bash deploy/remote-setup.sh
```

Если используете SSH ключ:
```bash
bash deploy/remote-setup.sh ~/.ssh/id_rsa
```

### Вариант 2: Ручная установка на сервере

Если автоматический скрипт не работает, выполните на сервере:

```bash
# 1. Подключитесь к серверу
ssh root@165.22.101.13

# 2. Установите зависимости
apt update && apt upgrade -y
apt install -y curl git docker.io docker-compose nginx ufw
systemctl enable docker && systemctl start docker

# 3. Настройте firewall
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

# 4. Создайте директории
mkdir -p /var/www/henzo/apps/backend
cd /var/www/henzo

# 5. Клонируйте репозиторий (если нужно)
git clone YOUR_REPO_URL .

# 6. Скопируйте .env файл
cd apps/backend
# Вставьте содержимое вашего .env файла в .env.production
nano .env.production

# 7. Запустите Docker
docker-compose build
docker-compose up -d

# 8. Проверка
curl http://localhost/health
```

## После установки

### Проверка работы

```bash
ssh root@165.22.101.13
cd /var/www/henzo/apps/backend

# Статус контейнеров
docker-compose ps

# Логи
docker-compose logs -f backend

# Health check
curl http://localhost/health
```

### Извне

```bash
curl http://165.22.101.13/health
```

## Важные замечания

1. **Supabase IP Whitelist**: Добавьте IP `165.22.101.13` в Supabase Dashboard → Settings → Database → Allowed IPs

2. **Переменные окружения**: Убедитесь, что все переменные в `.env.production` заполнены

3. **DNS**: Если используете домен, настройте A-запись на `165.22.101.13`

## Troubleshooting

### Backend не запускается

```bash
docker-compose logs backend
docker-compose restart backend
```

### 502 Bad Gateway

```bash
docker-compose ps  # Проверьте что backend запущен
docker-compose logs nginx
```

### Проблемы с базой данных

1. Проверьте `DATABASE_URL` в `.env.production`
2. Убедитесь, что IP добавлен в Supabase whitelist
3. Проверьте логи: `docker-compose logs backend | grep -i database`

