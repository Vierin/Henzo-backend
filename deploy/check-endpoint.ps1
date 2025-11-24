# Скрипт для диагностики и исправления ошибки 404 на /auth/send-business-magic-link
# Запускать: PowerShell -ExecutionPolicy Bypass -File check-endpoint.ps1

$SERVER_IP = "165.22.101.13"
$SERVER_USER = "root"
$BACKEND_DIR = "/var/www/henzo/apps/backend"

Write-Host "🔍 Диагностика и исправление ошибки 404" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Функция для выполнения SSH команд
function Invoke-SSHCommand {
    param([string]$Command)
    $fullCommand = "ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} `"$Command`""
    return Invoke-Expression $fullCommand
}

# 1. Проверка health
Write-Host "1️⃣  Проверка health endpoint..." -ForegroundColor Cyan
try {
    $health = Invoke-WebRequest -Uri "http://${SERVER_IP}/health" -Method GET -UseBasicParsing -ErrorAction Stop
    if ($health.StatusCode -eq 200) {
        Write-Host "✅ Health endpoint работает" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Health endpoint не отвечает" -ForegroundColor Red
    Write-Host "Проверяю статус контейнеров..." -ForegroundColor Yellow
}

Write-Host ""

# 2. Проверка статуса контейнеров на сервере
Write-Host "2️⃣  Проверка статуса контейнеров на сервере..." -ForegroundColor Cyan
$containerStatus = Invoke-SSHCommand "cd ${BACKEND_DIR} && docker-compose ps"
Write-Host $containerStatus

# Проверка что backend запущен
if ($containerStatus -match "henzo-backend.*Up") {
    Write-Host "✅ Backend контейнер запущен" -ForegroundColor Green
} else {
    Write-Host "❌ Backend контейнер не запущен!" -ForegroundColor Red
    Write-Host "🔄 Запускаю контейнеры..." -ForegroundColor Yellow
    Invoke-SSHCommand "cd ${BACKEND_DIR} && docker-compose up -d"
    Start-Sleep -Seconds 15
}

Write-Host ""

# 3. Проверка что эндпоинт существует в коде на сервере
Write-Host "3️⃣  Проверка наличия эндпоинта в коде на сервере..." -ForegroundColor Cyan
$codeCheck = Invoke-SSHCommand "cd ${BACKEND_DIR} && grep -r 'send-business-magic-link' src/auth/auth.controller.ts 2>/dev/null || echo 'NOT_FOUND'"
if ($codeCheck -match "NOT_FOUND") {
    Write-Host "❌ Эндпоинт не найден в коде на сервере!" -ForegroundColor Red
    Write-Host "⚠️  Нужно обновить код на сервере" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Выполните на сервере:" -ForegroundColor Yellow
    Write-Host "  cd ${BACKEND_DIR}" -ForegroundColor White
    Write-Host "  git pull origin main" -ForegroundColor White
    Write-Host "  docker-compose build backend" -ForegroundColor White
    Write-Host "  docker-compose up -d --no-deps backend" -ForegroundColor White
} else {
    Write-Host "✅ Эндпоинт найден в коде" -ForegroundColor Green
}

Write-Host ""

# 4. Проверка эндпоинта напрямую в контейнере
Write-Host "4️⃣  Проверка эндпоинта напрямую в контейнере..." -ForegroundColor Cyan
$directTest = Invoke-SSHCommand "cd ${BACKEND_DIR} && docker-compose exec -T backend curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3001/auth/send-business-magic-link -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"name\":\"Test\"}' 2>/dev/null || echo '000'"
Write-Host "Ответ от backend контейнера: $directTest" -ForegroundColor $(if ($directTest -match "^(200|400)$") { "Green" } else { "Red" })

if ($directTest -match "^(200|400)$") {
    Write-Host "✅ Эндпоинт работает в контейнере" -ForegroundColor Green
} elseif ($directTest -eq "404") {
    Write-Host "❌ 404 в контейнере - проблема с роутингом или кодом" -ForegroundColor Red
} else {
    Write-Host "⚠️  Неожиданный ответ: $directTest" -ForegroundColor Yellow
}

Write-Host ""

# 5. Проверка через nginx
Write-Host "5️⃣  Проверка через nginx..." -ForegroundColor Cyan
$body = @{
    email = "test@test.com"
    name = "Test User"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://${SERVER_IP}/auth/send-business-magic-link" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Эндпоинт работает через nginx (IP)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "❌ 404 через nginx" -ForegroundColor Red
    } elseif ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Эндпоинт доступен (400 - ожидаемо, ошибка валидации)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Ошибка: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""

# 6. Проверка логов backend
Write-Host "6️⃣  Последние логи backend (последние 20 строк)..." -ForegroundColor Cyan
$logs = Invoke-SSHCommand "cd ${BACKEND_DIR} && docker-compose logs backend --tail=20 2>&1"
Write-Host $logs -ForegroundColor Gray

Write-Host ""

# 7. Проверка nginx логов
Write-Host "7️⃣  Последние логи nginx (последние 10 строк)..." -ForegroundColor Cyan
$nginxLogs = Invoke-SSHCommand "cd ${BACKEND_DIR} && docker-compose logs nginx --tail=10 2>&1"
Write-Host $nginxLogs -ForegroundColor Gray

Write-Host ""

# 8. Предложение исправления
Write-Host "8️⃣  Рекомендации по исправлению..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Если эндпоинт не работает, выполните на сервере:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  # Обновление кода" -ForegroundColor White
Write-Host "  cd ${BACKEND_DIR}" -ForegroundColor White
Write-Host "  git pull origin main" -ForegroundColor White
Write-Host ""
Write-Host "  # Пересборка и перезапуск" -ForegroundColor White
Write-Host "  docker-compose build backend" -ForegroundColor White
Write-Host "  docker-compose up -d --no-deps backend" -ForegroundColor White
Write-Host ""
Write-Host "  # Или полный перезапуск" -ForegroundColor White
Write-Host "  docker-compose restart backend nginx" -ForegroundColor White
Write-Host ""

# 9. Финальная проверка
Write-Host "9️⃣  Финальная проверка..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
try {
    $finalCheck = Invoke-WebRequest -Uri "http://${SERVER_IP}/health" -Method GET -UseBasicParsing -ErrorAction Stop
    if ($finalCheck.StatusCode -eq 200) {
        Write-Host "✅ Backend работает" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Backend не отвечает" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Диагностика завершена!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Полезные команды для SSH:" -ForegroundColor Yellow
Write-Host "   ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor White
Write-Host "   cd ${BACKEND_DIR}" -ForegroundColor White
Write-Host "   docker-compose logs -f backend" -ForegroundColor White
Write-Host "   docker-compose ps" -ForegroundColor White
Write-Host ""

