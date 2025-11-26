# Скрипт для исправления состояния миграций
# Запускать: PowerShell -ExecutionPolicy Bypass -File fix-migration.ps1

Write-Host "🔧 Исправление состояния миграций" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

Write-Host "1️⃣  Помечаем неудачную миграцию как примененную..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Выполни команду:" -ForegroundColor Yellow
Write-Host "  npx prisma migrate resolve --applied 20250120000000_remove_synonyms_add_subcategories_tags" -ForegroundColor White
Write-Host ""

Write-Host "2️⃣  Затем примени новую миграцию:" -ForegroundColor Cyan
Write-Host "  npx prisma migrate deploy" -ForegroundColor White
Write-Host ""

Write-Host "Или если миграция действительно не применена, откати её:" -ForegroundColor Yellow
Write-Host "  npx prisma migrate resolve --rolled-back 20250120000000_remove_synonyms_add_subcategories_tags" -ForegroundColor White
Write-Host ""

