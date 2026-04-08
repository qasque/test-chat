# Reset WinHTTP proxy (often 127.0.0.1:*) that blocks Docker pulls.
# Run as user, then restart Docker Desktop.
$ErrorActionPreference = "Stop"
Write-Host "Текущие настройки WinHTTP:"
netsh winhttp show proxy
Write-Host "`nСброс к прямому доступу (без прокси)..."
netsh winhttp reset proxy
Write-Host "`nГотово:"
netsh winhttp show proxy
Write-Host "`nПерезапустите Docker Desktop: docker desktop restart"
Write-Host "Затем: docker pull alpine:3.20"
