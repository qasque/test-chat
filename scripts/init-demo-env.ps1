# Fill .env demo secrets where values still match .env.example placeholders; skips manual edits.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root ".env"
$Example = Join-Path $Root ".env.example"

if (-not (Test-Path $Example)) {
    Write-Error "Не найден .env.example"
    exit 1
}

if (-not (Test-Path $EnvFile)) {
    Write-Host "Копирую .env.example -> .env"
    Copy-Item $Example $EnvFile
}

function New-HexSecret([int] $ByteCount) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] $ByteCount
    $rng.GetBytes($bytes)
    -join ($bytes | ForEach-Object { $_.ToString("x2") })
}

function New-AlphaNumSecret([int] $Length) {
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] $Length
    $rng.GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

$lines = Get-Content $EnvFile -Encoding UTF8
$redisPass = New-AlphaNumSecret 28
$pgPass = New-AlphaNumSecret 28
$bridgeSecret = New-AlphaNumSecret 40
$secretKeyBase = New-HexSecret 64

$out = foreach ($line in $lines) {
    if ($line -match '^\s*#' -or $line -match '^\s*$') {
        $line
        continue
    }
    if ($line -notmatch '^([^#=]+)=(.*)$') {
        $line
        continue
    }
    $key = $matches[1].Trim()
    $val = $matches[2]

    switch ($key) {
        "SECRET_KEY_BASE" {
            if ($val -match "replace_with" -or $val -eq "") {
                "SECRET_KEY_BASE=$secretKeyBase"
            }
            else { $line }
        }
        "POSTGRES_PASSWORD" {
            if ($val -eq "change_me_postgres_strong" -or $val -eq "") {
                "POSTGRES_PASSWORD=$pgPass"
            }
            else { $line }
        }
        "REDIS_PASSWORD" {
            if ($val -eq "change_me_redis_strong" -or $val -eq "") {
                "REDIS_PASSWORD=$redisPass"
            }
            else { $line }
        }
        "REDIS_URL" {
            if ($val -match "change_me_redis_strong" -or ($val -eq "" -and $line -match "^REDIS_URL=")) {
                "REDIS_URL=redis://:${redisPass}@redis:6379"
            }
            elseif ($val -match "^redis://:([^@]+)@" -and $matches[1] -eq "change_me_redis_strong") {
                "REDIS_URL=redis://:${redisPass}@redis:6379"
            }
            else { $line }
        }
        "BRIDGE_SECRET" {
            if ($val -eq "change_me_long_random_for_telegram_webhook_auth" -or $val -eq "") {
                "BRIDGE_SECRET=$bridgeSecret"
            }
            else { $line }
        }
        Default { $line }
    }
}

Set-Content -Path $EnvFile -Value $out -Encoding UTF8

Write-Host ""
Write-Host "Готово: в .env подставлены случайные секреты там, где были плейсхолдеры."
Write-Host "Дальше:"
Write-Host "  1. .\scripts\setup-all.ps1"
Write-Host "  2. Настройте Chatwoot (учётка, Access Token, инбокс) — см. docs/QUICKSTART.md"
Write-Host "  3. Заполните TELEGRAM_BOTS_JSON и токены при демо с Telegram — см. docs/DEMO.md"
Write-Host "  4. После docker compose up: .\scripts\demo-smoke.ps1"
Write-Host ""
