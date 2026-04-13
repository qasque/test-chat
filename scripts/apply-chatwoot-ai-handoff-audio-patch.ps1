# Применяет patches/chatwoot/ai-handoff-audio-gate.diff к клону форка Chatwoot (до docker build).
# Пример:
#   .\scripts\apply-chatwoot-ai-handoff-audio-patch.ps1 -ChatwootRoot "C:\Users\me\Desktop\chatwoot-custom"

param(
    [Parameter(Mandatory = $true)]
    [string]$ChatwootRoot
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$patchFile = Join-Path $repoRoot "patches\chatwoot\ai-handoff-audio-gate.diff"

if (-not (Test-Path $patchFile)) {
    Write-Error "Patch not found: $patchFile"
}
if (-not (Test-Path (Join-Path $ChatwootRoot "docker\Dockerfile"))) {
    Write-Error "Not a Chatwoot repo root (no docker\Dockerfile): $ChatwootRoot"
}

Set-Location $ChatwootRoot
# Git apply keeps line endings consistent with the repo
git apply --verbose $patchFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "git apply failed (maybe already applied or branch differs). Resolve conflicts manually."
}
Write-Host "OK: patch applied. Rebuild image: .\scripts\build-chatwoot-image.ps1 -ChatwootRoot `"$ChatwootRoot`""
