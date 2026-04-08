# Deploy Chatwoot + telegram-bridge (Windows PowerShell, Docker Desktop Linux engine)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path (Join-Path $Root ".env"))) {
    Write-Host "Копирую .env.example -> .env (отредактируйте секреты при необходимости)"
    Copy-Item (Join-Path $Root ".env.example") (Join-Path $Root ".env")
}

Write-Host "Проверка доступа к Docker Hub (docker pull alpine)..."
docker pull alpine:3.20 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "=== ОШИБКА: образы не скачиваются ===" -ForegroundColor Yellow
    Write-Host "Частая причина: в Docker Desktop включён прокси на 127.0.0.1, а локальный прокси/VPN не запущен."
    Write-Host "См. раздел в docs/deployment.md: «Если docker compose pull падает с 127.0.0.1»"
    Write-Host "Исправьте Proxies в Docker Desktop, затем запустите этот скрипт снова."
    exit 1
}

Write-Host "docker compose pull..."
docker compose pull
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "db:chatwoot_prepare..."
docker compose run --rm rails bundle exec rails db:chatwoot_prepare
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "build & up..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Готово. Chatwoot: http://127.0.0.1:3000  Мост: http://127.0.0.1:4000/health  Портал: http://127.0.0.1:18080"
Write-Host ""
Write-Host "Первый ответ Chatwoot может занять 1–3 минуты после старта контейнеров."
Write-Host "Проверка URL: .\scripts\demo-smoke.ps1"
Write-Host "Проверка .env: node scripts/validate-env.mjs  (с токеном API: --bridge или --demo)"
Write-Host "Сценарий показа: docs/DEMO.md  Полный сценарий с Telegram: docs/QUICKSTART.md"
Write-Host "Демо-бот: docker compose --profile demo up -d --build"
docker compose ps
