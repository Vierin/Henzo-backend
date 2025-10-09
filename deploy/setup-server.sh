#!/bin/bash

# Скрипт для первоначальной настройки сервера DigitalOcean с Docker
# Запускать от root

set -e

echo "🚀 Начинаем настройку сервера для Henzo Backend (Docker)..."

# Обновление системы
echo "📦 Обновление системы..."
apt update && apt upgrade -y

# Установка необходимых пакетов
echo "📦 Установка базовых пакетов..."
apt install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git

# Установка Docker
echo "🐳 Установка Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    # Добавляем пользователя в группу docker (опционально)
    # usermod -aG docker $USER
else
    echo "✅ Docker уже установлен"
fi

# Установка Docker Compose
echo "🐳 Установка Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo "✅ Docker Compose уже установлен"
fi

# Запуск Docker
echo "▶️  Запуск Docker..."
systemctl start docker
systemctl enable docker

# Создание директории для приложения
echo "📁 Создание директорий..."
mkdir -p /var/www/henzo
mkdir -p /var/log/nginx
chown -R $USER:$USER /var/www/henzo

# Настройка firewall
echo "🔥 Настройка firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Настройка swap (если нужно)
if [ ! -f /swapfile ]; then
    echo "💾 Создание swap файла (2GB)..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
fi

# Настройка логирования Docker
echo "📝 Настройка логирования Docker..."
cat > /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

systemctl restart docker

# Проверка версий
echo ""
echo "✅ Настройка сервера завершена!"
echo ""
echo "📊 Установленные версии:"
docker --version
docker-compose --version
echo ""
echo "📝 Следующие шаги:"
echo "1. Клонируйте репозиторий: cd /var/www/henzo && git clone YOUR_REPO_URL ."
echo "2. Создайте файл .env.production в apps/backend/"
echo "3. Запустите: cd /var/www/henzo/apps/backend && bash deploy/deploy-docker.sh"