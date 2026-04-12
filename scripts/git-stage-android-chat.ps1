<#
.SYNOPSIS
  В репозитории android-chat в индекс попадают только Android + общий Dart (без ios/).

.DESCRIPTION
  Запускайте из корня клона android-chat (или укажите -RepoPath).
  После скрипта: git status, затем git commit.
  Не добавляет артефакты, если они не в .gitignore — перед коммитом лучше clean-flutter-artifacts.ps1.

.EXAMPLE
  cd C:\path\to\android-chat
  ..\паыфп\scripts\git-stage-android-chat.ps1
#>
param(
  [string] $RepoPath = ""
)

$ErrorActionPreference = "Stop"
$root = if ($RepoPath) { $RepoPath.TrimEnd('\', '/') } else { (Get-Location).Path }

Set-Location -LiteralPath $root

if (-not (Test-Path -LiteralPath (Join-Path $root "android"))) {
  Write-Error "Каталог android\ не найден — это не android-chat?: $root"
}

git reset

$toAdd = @(
  "android",
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

Write-Host "В индексе только android/ + общие файлы (lib, pubspec, …). ios/ не трогался."
Write-Host "Проверьте: git status"
git status --short
