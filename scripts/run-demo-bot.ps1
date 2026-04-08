# Run demo bot locally (no Docker): root .env needs TELEGRAM_BOT_TOKEN and TELEGRAM_BOTS_JSON
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
Set-Location telegram-demo-bot
if (-not (Test-Path "node_modules")) { npm ci }
$env:BRIDGE_URL = if ($env:BRIDGE_URL) { $env:BRIDGE_URL } else { "http://127.0.0.1:4000" }
npm start
