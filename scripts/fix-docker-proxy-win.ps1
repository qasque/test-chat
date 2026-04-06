# Сброс системного прокси WinHTTP (часто 127.0.0.1:12334), из-за которого Docker не тянет образы.
# Запуск: PowerShell от пользователя, затем перезапуск Docker Desktop.
# Требует прав: обычно достаточно без администратора.
$ErrorActionPreference = "Stop"
Write-Host "Текущие настройки WinHTTP:"
netsh winhttp show proxy
Write-Host "`nСброс к прямому доступу (без прокси)..."
netsh winhttp reset proxy
Write-Host "`nГотово:"
netsh winhttp show proxy
Write-Host "`nПерезапустите Docker Desktop: docker desktop restart"
Write-Host "Затем: docker pull alpine:3.20"
