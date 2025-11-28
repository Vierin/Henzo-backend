# PowerShell script to apply RecommendedServices migration
# This applies SQL directly without Prisma shadow database

Write-Host "Applying RecommendedServices migration..." -ForegroundColor Cyan

$migrationFile = Join-Path $PSScriptRoot "migrations\20250129000000_add_recommended_services\migration.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "Error: Migration file not found at $migrationFile" -ForegroundColor Red
    exit 1
}

# Read SQL file
$sql = Get-Content $migrationFile -Raw

Write-Host "SQL to execute:" -ForegroundColor Yellow
Write-Host $sql -ForegroundColor Gray

Write-Host "`nTo apply this migration:" -ForegroundColor Cyan
Write-Host "1. Copy the SQL above" -ForegroundColor White
Write-Host "2. Go to Supabase Dashboard -> SQL Editor" -ForegroundColor White
Write-Host "3. Paste and execute the SQL" -ForegroundColor White
Write-Host "`nOr run via psql if you have it installed:" -ForegroundColor Cyan
Write-Host "psql `$env:DATABASE_URL -f `"$migrationFile`"" -ForegroundColor White

Write-Host "`nAfter applying, run seed:" -ForegroundColor Cyan
Write-Host "npx ts-node prisma/seed-recommended-services.ts" -ForegroundColor White

