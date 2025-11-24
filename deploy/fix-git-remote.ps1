# Скрипт для исправления git remote на сервере
# Запускать: PowerShell -ExecutionPolicy Bypass -File fix-git-remote.ps1

$SERVER_IP = "165.22.101.13"
$SERVER_USER = "root"
$BACKEND_DIR = "/var/www/henzo/apps/backend"

Write-Host "🔧 Исправление git remote на сервере" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Копирование скрипта на сервер
Write-Host "📤 Копирование fix-git-remote.sh на сервер..." -ForegroundColor Cyan
$scriptPath = Join-Path $PSScriptRoot "fix-git-remote.sh"
scp -o StrictHostKeyChecking=no $scriptPath "${SERVER_USER}@${SERVER_IP}:${BACKEND_DIR}/deploy/fix-git-remote.sh"

# Запуск скрипта на сервере
Write-Host ""
Write-Host "🚀 Запуск исправления на сервере..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_IP}" "chmod +x ${BACKEND_DIR}/deploy/fix-git-remote.sh && cd ${BACKEND_DIR} && bash deploy/fix-git-remote.sh"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Готово!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Теперь можно запустить:" -ForegroundColor Yellow
Write-Host "  PowerShell -ExecutionPolicy Bypass -File fix-404-remote.ps1" -ForegroundColor White
Write-Host ""

