<#
.SYNOPSIS
  В репозитории ios-chat в индекс попадают только iOS + общий Dart (без android/).

.DESCRIPTION
  Запускайте из корня клона ios-chat (или укажите -RepoPath).
  После скрипта: git status, затем git commit.

.EXAMPLE
  cd C:\path\to\ios-chat
  ..\паыфп\scripts\git-stage-ios-chat.ps1
#>
param(
  [string] $RepoPath = ""
)

$ErrorActionPreference = "Stop"
$root = if ($RepoPath) { $RepoPath.TrimEnd('\', '/') } else { (Get-Location).Path }

Set-Location -LiteralPath $root

if (-not (Test-Path -LiteralPath (Join-Path $root "ios"))) {
  Write-Error "Каталог ios\ не найден — это не ios-chat?: $root"
}

git reset

$toAdd = @(
  "ios",
  "lib",
  "pubspec.yaml",
  "pubspec.lock",
  "analysis_options.yaml",
  "third_party",
  "test",
  ".metadata"
)

foreach ($p in $toAdd) {
  $full = Join-Path $root $p
  if (Test-Path -LiteralPath $full) {
    git add -- $p
  }
}

Write-Host "В индексе только ios/ + общие файлы (lib, pubspec, …). android/ не трогался."
Write-Host "Проверьте: git status"
git status --short
