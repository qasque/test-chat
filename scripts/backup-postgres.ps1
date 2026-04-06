# Создание дампа PostgreSQL контейнера chatwoot (PowerShell)
param(
    [string]$OutDir = (Join-Path $PSScriptRoot "..\backups")
)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$file = Join-Path $OutDir "chatwoot_$stamp.sql"
$compose = Join-Path $PSScriptRoot "..\docker-compose.yml"
docker compose -f $compose exec -T postgres pg_dump -U postgres chatwoot | Set-Content -Encoding utf8 $file
Write-Host "Saved: $file"
