# Проверка доступности Chatwoot, моста и портала после docker compose up.
# Rails может отвечать с задержкой 1–3 минуты после старта контейнеров.
param(
    [int] $TimeoutSec = 180,
    [int] $IntervalSec = 5,
    [int] $PortalPort = 18080
)

$ErrorActionPreference = "Continue"
$targets = @(
    @{ Name = "Chatwoot";    Url = "http://127.0.0.1:3000/" }
    @{ Name = "Мост";        Url = "http://127.0.0.1:4000/health" }
    @{ Name = "Веб-портал"; Url = "http://127.0.0.1:$PortalPort/" }
)

function Test-UrlOk([string] $Url) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8 -MaximumRedirection 3
        return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500)
    }
    catch {
        return $false
    }
}

$ok = @{}
$deadline = (Get-Date).AddSeconds($TimeoutSec)

Write-Host "Ожидание ответа (до $TimeoutSec с, интервал ${IntervalSec}s)..."

while (((Get-Date) -lt $deadline) -and ($ok.Count -lt $targets.Count)) {
    foreach ($t in $targets) {
        if (-not $ok.ContainsKey($t.Name)) {
            if (Test-UrlOk $t.Url) {
                Write-Host "[OK] $($t.Name) — $($t.Url)" -ForegroundColor Green
                $ok[$t.Name] = $true
            }
        }
    }
    if ($ok.Count -lt $targets.Count) {
        Start-Sleep -Seconds $IntervalSec
    }
}

Write-Host ""
if ($ok.Count -eq $targets.Count) {
    Write-Host "Все проверки пройдены." -ForegroundColor Green
    exit 0
}

Write-Host "Не ответили за $TimeoutSec с:" -ForegroundColor Yellow
foreach ($t in $targets) {
    if (-not $ok.ContainsKey($t.Name)) {
        Write-Host "  - $($t.Name) ($($t.Url))"
    }
}
Write-Host ""
Write-Host "Подождите ещё 1–2 минуты (особенно Chatwoot) и запустите скрипт снова."
Write-Host "Логи: docker compose logs -f rails telegram-bridge portal"
exit 1
