# Сборка образа Chatwoot (кастом) на Windows и экспорт в .tar для переноса на сервер.
# Требуется: Docker Desktop, включённый WSL2/Linux engine.
#
# Запуск из корня репозитория test-chat:
#   .\scripts\build-chatwoot-image.ps1
#
# Или с путём к клону chatwoot-custom:
#   .\scripts\build-chatwoot-image.ps1 -ChatwootRoot "C:\Users\...\chatwoot-custom"
#
# После сборки: скопировать .tar на сервер и выполнить: docker load -i chatwoot-custom-*.tar

param(
    [string]$ChatwootRoot = "",
    [string]$ImageName = "qasque-chatwoot",
    [string]$Tag = "custom",
    [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker недоступен. Запустите Docker Desktop и дождитесь статуса Running, затем повторите."
}

if (-not $ChatwootRoot) {
    $desktop = [Environment]::GetFolderPath("Desktop")
    $candidates = @(
        (Join-Path $desktop "chatwoot-fresh-push"),
        (Join-Path $desktop "chatwoot-custom"),
        (Join-Path $desktop "chatwoot-custom-src")
    )
    foreach ($p in $candidates) {
        $df = Join-Path $p "docker\Dockerfile"
        if (Test-Path $df) {
            $ChatwootRoot = $p
            break
        }
    }
}

if (-not $ChatwootRoot -or -not (Test-Path (Join-Path $ChatwootRoot "docker\Dockerfile"))) {
    Write-Error "Не найден каталог с docker\Dockerfile. Укажите -ChatwootRoot `"путь\к\chatwoot-custom`""
}

if (-not $OutDir) {
    $OutDir = Join-Path $PSScriptRoot "..\dist-docker"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$fullTag = "${ImageName}:${Tag}"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tarFile = Join-Path $OutDir "chatwoot-custom_${stamp}.tar"

Write-Host "Каталог исходников: $ChatwootRoot"
Write-Host "Образ: $fullTag"
Write-Host "Сборка (долго, 30–90+ мин)..."
Write-Host ""

Set-Location $ChatwootRoot
docker build -t $fullTag -f docker/Dockerfile .

if ($LASTEXITCODE -ne 0) {
    Write-Error "docker build завершился с ошибкой"
}

Write-Host ""
Write-Host "Экспорт образа в $tarFile ..."
docker save $fullTag -o $tarFile

if ($LASTEXITCODE -ne 0) {
    Write-Error "docker save завершился с ошибкой"
}

$sizeMb = [math]::Round((Get-Item $tarFile).Length / 1MB, 1)
Write-Host ""
Write-Host "Готово. Файл: $tarFile ($sizeMb MB)"
Write-Host ""
Write-Host "=== На сервере (после копирования .tar) ==="
Write-Host "  docker load -i /path/to/chatwoot-custom_${stamp}.tar"
Write-Host "В docker-compose.yml (test-chat) у base:"
Write-Host "  image: $fullTag"
Write-Host "Затем:"
Write-Host "  cd ~/test-chat && docker compose up -d --force-recreate rails sidekiq"
Write-Host ""
Write-Host "Копирование по SSH (пример):"
Write-Host "  scp `"$tarFile`" root@ВАШ_СЕРВЕР:/root/"
