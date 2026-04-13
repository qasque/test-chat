#requires -Version 5.1
<#
.SYNOPSIS
  Копирует Flutter-проект в локальный клон android-chat или ios-chat без смешивания платформ.

.DESCRIPTION
  Android: копируются lib, android, assets, test, third_party (если есть) + корневые pubspec/analysis.
 Каталог ios (и др. платформы) в целевом репозитории удаляется.
  iOS:     то же, но ios вместо android; каталог android в целевом репо удаляется.

.PARAMETER Platform
  android | ios

.PARAMETER MobileRoot
  Путь к корню Flutter-приложения (где лежат pubspec.yaml, lib/, android/, ios/).

.PARAMETER RepoRoot
  Путь к локальному git-клону целевого репозитория (android-chat или ios-chat).

.PARAMETER CommitMessage
  Сообщение коммита (по умолчанию sync: android / sync: ios).

.PARAMETER NoGit
  Только копирование файлов, без git add/commit/push.

.PARAMETER NoPush
  Коммит без push.

.EXAMPLE
  .\scripts\flutter-sync-to-repo.ps1 -Platform android -MobileRoot "C:\work\apps\mobile" -RepoRoot "C:\work\android-chat"
  .\scripts\flutter-sync-to-repo.ps1 -Platform ios -MobileRoot "C:\work\apps\mobile" -RepoRoot "C:\work\ios-chat"
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("android", "ios")]
  [string] $Platform,

  [Parameter(Mandatory = $true)]
  [string] $MobileRoot,

  [Parameter(Mandatory = $true)]
  [string] $RepoRoot,

  [string] $CommitMessage = "",

  [switch] $NoGit,
  [switch] $NoPush
)

$ErrorActionPreference = "Stop"
$MobileRoot = (Resolve-Path -LiteralPath $MobileRoot).Path
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path

if (-not (Test-Path -LiteralPath (Join-Path $MobileRoot "pubspec.yaml"))) {
  throw "Не найден pubspec.yaml в MobileRoot: $MobileRoot"
}
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot ".git"))) {
  throw "RepoRoot не похож на git-репозиторий (нет .git): $RepoRoot"
}

function Mirror-Dir {
  param([string] $Src, [string] $Dst)
  if (-not (Test-Path -LiteralPath $Src)) { return }
  New-Item -ItemType Directory -Path $Dst -Force | Out-Null
  robocopy $Src $Dst /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $Src -> $Dst (code $LASTEXITCODE)" }
}

function Remove-RepoPath {
  param([string] $Rel)
  $full = Join-Path $RepoRoot $Rel
  if (Test-Path -LiteralPath $full) {
    Remove-Item -LiteralPath $full -Recurse -Force
  }
}

# --- Удалить из целевого репо всё «чужое» ---
$stripDirs = @(
  "android", "ios", "macos", "windows", "linux", "web",
  "build", ".dart_tool", ".idea", ".vscode"
)
foreach ($d in $stripDirs) {
  Remove-RepoPath $d
}

$includeDirs = @("lib", "test", "assets", "third_party")
if ($Platform -eq "android") {
  $includeDirs = @("lib", "android", "test", "assets", "third_party")
} else {
  $includeDirs = @("lib", "ios", "test", "assets", "third_party")
}

foreach ($d in $includeDirs) {
  $src = Join-Path $MobileRoot $d
  $dst = Join-Path $RepoRoot $d
  Mirror-Dir -Src $src -Dst $dst
}

$rootFiles = @(
  "pubspec.yaml", "pubspec.lock", "analysis_options.yaml", ".metadata"
)
foreach ($f in $rootFiles) {
  $src = Join-Path $MobileRoot $f
  if (Test-Path -LiteralPath $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $RepoRoot $f) -Force
  }
}

# Жёстко: в android-репо не должно быть ios и наоборот
if ($Platform -eq "android") {
  Remove-RepoPath "ios"
} else {
  Remove-RepoPath "android"
}

Write-Host "Synced $Platform : $MobileRoot -> $RepoRoot"

if ($NoGit) { return }

$msg = $CommitMessage
if (-not $msg) { $msg = "sync: flutter $Platform from monorepo" }

Push-Location $RepoRoot
try {
  & git add -A
  $st = & git status --porcelain
  if (-not $st) {
    Write-Host "Nothing to commit."
    return
  }
  & git commit -m $msg
  if (-not $NoPush) {
    & git push
  }
} finally {
  Pop-Location
}
