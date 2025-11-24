# Скрипт для исправления проблемы Docker на Windows
# Запускать от администратора: PowerShell -ExecutionPolicy Bypass -File fix-docker-windows.ps1

Write-Host "🔧 Исправление проблемы Docker WSL2 на Windows" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Проверка прав администратора
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ Запустите PowerShell от администратора!" -ForegroundColor Red
    Write-Host "Правый клик на PowerShell -> Запуск от имени администратора" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Права администратора подтверждены" -ForegroundColor Green
Write-Host ""

# 1. Остановка Docker
Write-Host "🛑 Шаг 1: Остановка Docker..." -ForegroundColor Cyan
Stop-Service -Name "com.docker.service" -ErrorAction SilentlyContinue
Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# 2. Очистка WSL
Write-Host "🧹 Шаг 2: Очистка WSL..." -ForegroundColor Cyan
wsl --shutdown
Start-Sleep -Seconds 2

# 3. Проверка и перерегистрация WSL дистрибутива Docker
Write-Host "🔍 Шаг 3: Проверка WSL дистрибутивов..." -ForegroundColor Cyan
$wslList = wsl -l -v
Write-Host $wslList

# 4. Удаление проблемного дистрибутива (если нужно)
Write-Host ""
$recreate = Read-Host "Пересоздать WSL дистрибутив Docker? (y/n)"
if ($recreate -eq "y" -or $recreate -eq "Y") {
    Write-Host "🗑️  Удаление старого дистрибутива..." -ForegroundColor Yellow
    wsl --unregister docker-desktop
    wsl --unregister docker-desktop-data
    Write-Host "✅ Дистрибутивы удалены" -ForegroundColor Green
}

# 5. Запуск Docker Desktop
Write-Host ""
Write-Host "▶️  Шаг 4: Запуск Docker Desktop..." -ForegroundColor Cyan
$dockerPath = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
if (Test-Path $dockerPath) {
    Start-Process $dockerPath
    Write-Host "⏳ Ожидание запуска Docker (30 секунд)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
} else {
    Write-Host "⚠️  Docker Desktop не найден по стандартному пути" -ForegroundColor Yellow
    Write-Host "Запустите Docker Desktop вручную" -ForegroundColor Yellow
}

# 6. Проверка статуса
Write-Host ""
Write-Host "🔍 Шаг 5: Проверка статуса Docker..." -ForegroundColor Cyan
try {
    docker version 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker работает!" -ForegroundColor Green
        docker version
    } else {
        Write-Host "❌ Docker не отвечает" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Docker не установлен или не запущен" -ForegroundColor Red
    Write-Host "Установите Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Процесс завершен!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Если проблема сохраняется:" -ForegroundColor Yellow
Write-Host "1. Перезагрузите компьютер" -ForegroundColor White
Write-Host "2. Убедитесь, что WSL2 установлен: wsl --install" -ForegroundColor White
Write-Host "3. Переустановите Docker Desktop" -ForegroundColor White
Write-Host ""

