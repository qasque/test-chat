<#
.SYNOPSIS
  Удаляет локальные артефакты Flutter/Android/iOS (не коммитить).

.DESCRIPTION
  Очищает build/, .dart_tool/, кэши Gradle, CMake .cxx, Pods и т.п.
  По умолчанию — apps/mobile в корне этого репозитория.
  Для клонов android-chat / ios-chat передайте -ProjectPath.

.EXAMPLE
  .\scripts\clean-flutter-artifacts.ps1
.EXAMPLE
  .\scripts\clean-flutter-artifacts.ps1 -ProjectPath "C:\path\to\android-chat"
#>
param(
  [string] $ProjectPath = "",
  [switch] $KeepLocalProperties
)

$ErrorActionPreference = "Stop"

function Get-DefaultFlutterRoot {
  $scriptDir = $PSScriptRoot
  if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
  $repoRoot = Split-Path -Parent $scriptDir
  return Join-Path $repoRoot "apps\mobile"
}

$proj = if ($ProjectPath) { $ProjectPath.TrimEnd('\', '/') } else { Get-DefaultFlutterRoot }

$pubspec = Join-Path $proj "pubspec.yaml"
if (-not (Test-Path -LiteralPath $pubspec)) {
  Write-Error "Не найден pubspec.yaml — не похоже на Flutter-проект: $proj"
}

Write-Host "Очистка артефактов: $proj"

$relativeDirs = @(
  "build",
  ".dart_tool",
  "android\.cxx",
  "android\app\build",
  "android\build",
  "android\.gradle",
  "ios\Pods",
  "ios\.symlinks",
  "ios\Flutter\ephemeral"
)

foreach ($rel in $relativeDirs) {
  $full = Join-Path $proj $rel
  if (Test-Path -LiteralPath $full) {
    Write-Host "  удалить $rel"
    Remove-Item -LiteralPath $full -Recurse -Force
  }
}

$localProps = Join-Path $proj "android\local.properties"
if (-not $KeepLocalProperties -and (Test-Path -LiteralPath $localProps)) {
  Write-Host "  удалить android\local.properties (локальные пути SDK)"
  Remove-Item -LiteralPath $localProps -Force
}

Write-Host "Готово."
