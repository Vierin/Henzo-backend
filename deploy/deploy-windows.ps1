# Скрипт для деплоя на сервер с Windows (Docker только на сервере)
# Запускать: PowerShell -ExecutionPolicy Bypass -File deploy-windows.ps1

$SERVER_IP = "165.22.101.13"
$SERVER_USER = "root"
$BACKEND_DIR = "/var/www/henzo/apps/backend"

Write-Host "🚀 Деплой бэкенда на Digital Ocean (Windows -> Linux)" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Проверка .env файла
if (-not (Test-Path ".env")) {
    Write-Host "❌ Файл .env не найден!" -ForegroundColor Red
    Write-Host "Убедитесь, что вы находитесь в apps/backend/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Файл .env найден" -ForegroundColor Green
Write-Host ""

# Проверка SSH
Write-Host "🔌 Проверка SSH подключения..." -ForegroundColor Cyan
try {
    $null = ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 "${SERVER_USER}@${SERVER_IP}" "echo OK" 2>&1
    Write-Host "✅ Подключение установлено" -ForegroundColor Green
} catch {
    Write-Host "❌ Не удалось подключиться к серверу" -ForegroundColor Red
    Write-Host "Проверьте SSH доступ: ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Создание бэкапа на сервере
Write-Host "💾 Создание бэкапа старого .env.production..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_IP}" "if [ -f '${BACKEND_DIR}/.env.production' ]; then cp '${BACKEND_DIR}/.env.production' '${BACKEND_DIR}/.env.production.backup.$(date +%Y%m%d_%H%M%S)' && echo '✅ Бэкап создан' || echo '⚠️  Ошибка создания бэкапа'; fi"
Write-Host ""

# Копирование .env через SCP (более надежно на Windows)
Write-Host "📤 Копирование .env на сервер..." -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no ".env" "${SERVER_USER}@${SERVER_IP}:${BACKEND_DIR}/.env.production"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ .env.production обновлен на сервере" -ForegroundColor Green
} else {
    Write-Host "❌ Ошибка копирования файла" -ForegroundColor Red
    Write-Host "Попробуйте альтернативный метод..." -ForegroundColor Yellow
    # Альтернативный метод через cat
    Get-Content .env | ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_IP}" "cat > ${BACKEND_DIR}/.env.production"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ .env.production обновлен (альтернативный метод)" -ForegroundColor Green
    } else {
        Write-Host "❌ Оба метода не сработали" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Перезапуск контейнеров
Write-Host "🔄 Перезапуск контейнеров на сервере..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_IP}" "cd ${BACKEND_DIR} && docker-compose restart backend"
Write-Host "⏳ Ожидание запуска (10 секунд)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Проверка health
Write-Host ""
Write-Host "🔍 Проверка работоспособности..." -ForegroundColor Cyan
$healthCheck = ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_IP}" "curl -s -o /dev/null -w '%{http_code}' http://localhost/health"
if ($healthCheck -eq "200") {
    Write-Host "✅ Backend работает!" -ForegroundColor Green
    $healthResponse = ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_IP}" "curl -s http://localhost/health"
    Write-Host $healthResponse -ForegroundColor Gray
} else {
    Write-Host "⚠️  Backend не отвечает (код: $healthCheck)" -ForegroundColor Yellow
    Write-Host "Проверьте логи: ssh ${SERVER_USER}@${SERVER_IP} 'cd ${BACKEND_DIR} && docker-compose logs backend'" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Деплой завершен!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Проверка извне:" -ForegroundColor Cyan
Write-Host "   curl http://${SERVER_IP}/health" -ForegroundColor White
Write-Host ""
Write-Host "📝 Полезные команды:" -ForegroundColor Cyan
Write-Host "   Логи:    ssh ${SERVER_USER}@${SERVER_IP} 'cd ${BACKEND_DIR} && docker-compose logs -f backend'" -ForegroundColor White
Write-Host "   Статус:  ssh ${SERVER_USER}@${SERVER_IP} 'cd ${BACKEND_DIR} && docker-compose ps'" -ForegroundColor White
Write-Host ""

