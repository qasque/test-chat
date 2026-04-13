# Build custom Chatwoot image on Windows and export to .tar for the server.
# Needs: Docker Desktop (WSL2/Linux engine).
# Перед сборкой (опционально): звук в дашборде только после ai_handoff — см.
#   .\scripts\apply-chatwoot-ai-handoff-audio-patch.ps1 -ChatwootRoot "C:\path\to\chatwoot-custom"
#   .\scripts\build-chatwoot-image.ps1
#   .\scripts\build-chatwoot-image.ps1 -ChatwootRoot "C:\path\to\chatwoot-custom"
# Server: docker load -i chatwoot-custom_*.tar

param(
    [string]$ChatwootRoot = "",
    [string]$ImageName = "qasque-chatwoot",
    [string]$Tag = "custom",
    [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker is not available. Start Docker Desktop and wait until it is running."
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
    Write-Error "No folder with docker\Dockerfile found. Pass -ChatwootRoot path\to\chatwoot-custom"
}

if (-not $OutDir) {
    $OutDir = Join-Path $PSScriptRoot "..\dist-docker"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$fullTag = "${ImageName}:${Tag}"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tarFile = Join-Path $OutDir "chatwoot-custom_${stamp}.tar"

Write-Host "Source: $ChatwootRoot"
Write-Host "Image: $fullTag"
Write-Host "Building (often 30–90+ min)..."
Write-Host ""

Set-Location $ChatwootRoot
docker build -t $fullTag -f docker/Dockerfile .

if ($LASTEXITCODE -ne 0) {
    Write-Error "docker build failed"
}

Write-Host ""
Write-Host "Saving image to $tarFile ..."
docker save $fullTag -o $tarFile

if ($LASTEXITCODE -ne 0) {
    Write-Error "docker save failed"
}

$sizeMb = [math]::Round((Get-Item $tarFile).Length / 1MB, 1)
Write-Host ""
Write-Host "Done: $tarFile ($sizeMb MB)"
Write-Host ""
Write-Host "=== On server (after copying .tar) ==="
Write-Host "  docker load -i /path/to/chatwoot-custom_${stamp}.tar"
Write-Host "In docker-compose.yml base service:"
Write-Host "  image: $fullTag"
Write-Host "Then:"
Write-Host "  cd ~/test-chat && docker compose up -d --force-recreate rails sidekiq"
Write-Host ""
Write-Host "SCP example:"
Write-Host "  scp `"$tarFile`" root@YOUR_SERVER:/root/"
