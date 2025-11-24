# Скрипт для автоматического исправления ошибки 404 через SSH
# Запускать: PowerShell -ExecutionPolicy Bypass -File fix-404-remote.ps1

$SERVER_IP = "165.22.101.13"
$SERVER_USER = "root"
$BACKEND_DIR = "/var/www/henzo/apps/backend"

Write-Host "🔧 Автоматическое исправление ошибки 404" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Функция для выполнения SSH команд
function Invoke-SSHCommand {
    param([string]$Command)
    $fullCommand = "ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} `"$Command`""
    return Invoke-Expression $fullCommand
}

# 1. Проверка и настройка SSH для GitHub
Write-Host "1️⃣  Проверка git remote и SSH..." -ForegroundColor Cyan
$remoteCheck = Invoke-SSHCommand "cd ${BACKEND_DIR} && git remote -v 2>&1"
Write-Host $remoteCheck -ForegroundColor Gray

# Проверка на SSH URL
if ($remoteCheck -match "git@github.com") {
    Write-Host "⚠️  Обнаружен SSH URL, проверяю SSH ключ..." -ForegroundColor Yellow
    $sshTest = Invoke-SSHCommand "ssh -T git@github.com 2>&1" 
    if ($sshTest -match "Permission denied|publickey") {
        Write-Host "❌ SSH ключ не настроен в GitHub" -ForegroundColor Red
        Write-Host "Настраиваю SSH ключ на сервере..." -ForegroundColor Yellow
        $fixRemote = Invoke-SSHCommand "cd ${BACKEND_DIR} && bash deploy/fix-git-remote.sh 2>&1"
        Write-Host $fixRemote
        Write-Host ""
        Write-Host "⚠️  ВАЖНО: Добавь публичный ключ в GitHub!" -ForegroundColor Yellow
        Write-Host "1. Скопируй публичный ключ из вывода выше" -ForegroundColor White
        Write-Host "2. Открой: https://github.com/settings/keys" -ForegroundColor White
        Write-Host "3. Нажми 'New SSH key' и вставь ключ" -ForegroundColor White
        Write-Host "4. Затем запусти этот скрипт снова" -ForegroundColor White
        exit 1
    } else {
        Write-Host "✅ SSH ключ настроен" -ForegroundColor Green
    }
}

Write-Host ""

# 2. Обновление кода
Write-Host "2️⃣  Обновление кода на сервере..." -ForegroundColor Cyan
$gitStatus = Invoke-SSHCommand "cd ${BACKEND_DIR} && git status --porcelain 2>&1"
$gitPull = Invoke-SSHCommand "cd ${BACKEND_DIR} && git pull origin main 2>&1"
Write-Host $gitPull

if ($gitPull -match "Permission denied|publickey|fatal") {
    Write-Host "❌ Ошибка при git pull" -ForegroundColor Red
    Write-Host ""
    Write-Host "Исправьте git remote вручную на сервере:" -ForegroundColor Yellow
    Write-Host "  ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor White
    Write-Host "  cd ${BACKEND_DIR}" -ForegroundColor White
    Write-Host "  bash deploy/fix-git-remote.sh" -ForegroundColor White
    Write-Host ""
    Write-Host "Или для приватного репо с токеном:" -ForegroundColor Yellow
    Write-Host "  git remote set-url origin https://YOUR_TOKEN@github.com/YOUR_USERNAME/henzo.git" -ForegroundColor White
    exit 1
} elseif ($gitPull -match "Already up to date") {
    Write-Host "✅ Код уже актуальный" -ForegroundColor Green
} else {
    Write-Host "✅ Код обновлен" -ForegroundColor Green
}

Write-Host ""

# 3. Пересборка backend образа
Write-Host "3️⃣  Пересборка backend образа..." -ForegroundColor Cyan
Write-Host "⏳ Это может занять несколько минут..." -ForegroundColor Yellow
$buildOutput = Invoke-SSHCommand "cd ${BACKEND_DIR} && docker-compose build backend 2>&1"
Write-Host $buildOutput -ForegroundColor Gray

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Образ пересобран" -ForegroundColor Green
} else {
    Write-Host "❌ Ошибка при сборке образа" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 4. Перезапуск backend контейнера
Write-Host "4️⃣  Перезапуск backend контейнера..." -ForegroundColor Cyan
$restartOutput = Invoke-SSHCommand "cd ${BACKEND_DIR} && docker-compose up -d --no-deps backend 2>&1"
Write-Host $restartOutput

Write-Host "⏳ Ожидание запуска (15 секунд)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host ""

# 5. Проверка статуса
Write-Host "5️⃣  Проверка статуса контейнеров..." -ForegroundColor Cyan
$status = Invoke-SSHCommand "cd ${BACKEND_DIR} && docker-compose ps"
Write-Host $status

Write-Host ""

# 6. Проверка health
Write-Host "6️⃣  Проверка health endpoint..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
try {
    $health = Invoke-WebRequest -Uri "http://${SERVER_IP}/health" -Method GET -UseBasicParsing -ErrorAction Stop
    if ($health.StatusCode -eq 200) {
        Write-Host "✅ Health endpoint работает" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Health endpoint не отвечает" -ForegroundColor Red
    Write-Host "Проверьте логи: ssh ${SERVER_USER}@${SERVER_IP} 'cd ${BACKEND_DIR} && docker-compose logs backend'" -ForegroundColor Yellow
}

Write-Host ""

# 7. Проверка проблемного эндпоинта
Write-Host "7️⃣  Проверка /auth/send-business-magic-link..." -ForegroundColor Cyan
$body = @{
    email = "test@test.com"
    name = "Test User"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://${SERVER_IP}/auth/send-business-magic-link" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Эндпоинт работает!" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "❌ Все еще 404 ошибка" -ForegroundColor Red
        Write-Host ""
        Write-Host "Проверьте:" -ForegroundColor Yellow
        Write-Host "  1. Что код на сервере содержит эндпоинт:" -ForegroundColor White
        Write-Host "     ssh ${SERVER_USER}@${SERVER_IP} 'cd ${BACKEND_DIR} && grep send-business-magic-link src/auth/auth.controller.ts'" -ForegroundColor Gray
        Write-Host "  2. Логи backend:" -ForegroundColor White
        Write-Host "     ssh ${SERVER_USER}@${SERVER_IP} 'cd ${BACKEND_DIR} && docker-compose logs backend | tail -50'" -ForegroundColor Gray
    } elseif ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Эндпоинт доступен (400 - ожидаемо, ошибка валидации)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Ошибка: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Исправление завершено!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

