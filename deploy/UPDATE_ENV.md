# Обновление переменных окружения на сервере

## Автоматическое обновление (рекомендуется)

### Использование скрипта update-env.sh

```bash
cd apps/backend
bash deploy/update-env.sh
```

Если используете SSH ключ:

```bash
bash deploy/update-env.sh ~/.ssh/id_rsa
```

**Что делает скрипт:**

1. ✅ Создает бэкап старого `.env.production`
2. ✅ Копирует ваш локальный `.env` на сервер
3. ✅ Перезапускает контейнеры (опционально)

## Ручное обновление

### Вариант 1: Через SSH

```bash
# 1. Подключитесь к серверу
ssh root@165.22.101.13

# 2. Перейдите в директорию
cd /var/www/henzo/apps/backend

# 3. Создайте бэкап
cp .env.production .env.production.backup.$(date +%Y%m%d)

# 4. Откройте файл для редактирования
nano .env.production

# 5. Вставьте новые переменные или отредактируйте существующие
# Сохраните: Ctrl+O, Enter, Ctrl+X

# 6. Перезапустите контейнер
docker-compose restart backend

# 7. Проверка
curl http://localhost/health
```

### Вариант 2: Прямое копирование файла

```bash
# С локальной машины
cd apps/backend
scp .env root@165.22.101.13:/var/www/henzo/apps/backend/.env.production

# Затем на сервере
ssh root@165.22.101.13
cd /var/www/henzo/apps/backend
docker-compose restart backend
```

### Вариант 3: Через переменные окружения в docker-compose

Если нужно добавить только несколько переменных:

```bash
ssh root@165.22.101.13
cd /var/www/henzo/apps/backend

# Добавьте переменную в docker-compose.yml в секцию environment:
# environment:
#   - NEW_VAR=value

# Или добавьте в .env.production
echo "NEW_VAR=value" >> .env.production

# Перезапустите
docker-compose restart backend
```

## Проверка изменений

```bash
ssh root@165.22.101.13
cd /var/www/henzo/apps/backend

# Проверьте что переменные загружены
docker-compose exec backend env | grep YOUR_VAR_NAME

# Проверьте логи
docker-compose logs -f backend

# Health check
curl http://localhost/health
```

## Важные замечания

1. **Бэкап**: Скрипт автоматически создает бэкап перед обновлением
2. **Перезапуск**: После изменения `.env.production` обязательно перезапустите контейнер
3. **Формат**: Убедитесь, что переменные в правильном формате (без пробелов вокруг `=`)
4. **Кавычки**: Используйте кавычки для значений с пробелами: `VAR="value with spaces"`

## Откат изменений

Если что-то пошло не так:

```bash
ssh root@165.22.101.13
cd /var/www/henzo/apps/backend

# Восстановите из бэкапа
cp .env.production.backup.YYYYMMDD .env.production

# Перезапустите
docker-compose restart backend
```
