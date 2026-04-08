#!/usr/bin/env bash
# Wait until Chatwoot, bridge, and portal respond (Rails may need 1–3 min after up).
set -eu

TIMEOUT_SEC="${1:-180}"
INTERVAL_SEC="${2:-5}"
PORTAL_PORT="${3:-18080}"

names=(Chatwoot Мост "Веб-портал")
urls=(
  "http://127.0.0.1:3000/"
  "http://127.0.0.1:4000/health"
  "http://127.0.0.1:${PORTAL_PORT}/"
)

test_url() {
  local url="$1"
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 8 --max-time 15 -L "$url" 2>/dev/null || echo "000")"
  [[ "$code" =~ ^[23] ]] && return 0
  return 1
}

n="${#names[@]}"
ok_count=0
ok_flags=()
for ((i=0; i<n; i++)); do ok_flags[i]=0; done

start_ts=$(date +%s)
end_ts=$((start_ts + TIMEOUT_SEC))

echo "Ожидание ответа (до ${TIMEOUT_SEC} с, интервал ${INTERVAL_SEC}s)..."

while (( $(date +%s) < end_ts )); do
  ok_count=0
  for ((i=0; i<n; i++)); do
    if [[ "${ok_flags[i]}" -eq 1 ]]; then
      ((ok_count++)) || true
      continue
    fi
    if test_url "${urls[i]}"; then
      echo "[OK] ${names[i]} — ${urls[i]}"
      ok_flags[i]=1
      ((ok_count++)) || true
    fi
  done
  if (( ok_count == n )); then
    echo ""
    echo "Все проверки пройдены."
    exit 0
  fi
  sleep "$INTERVAL_SEC"
done

echo ""
echo "Не ответили за ${TIMEOUT_SEC} с:"
for ((i=0; i<n; i++)); do
  if [[ "${ok_flags[i]}" -eq 0 ]]; then
    echo "  - ${names[i]} (${urls[i]})"
  fi
done
echo ""
echo "Подождите ещё 1–2 минуты (особенно Chatwoot) и запустите скрипт снова."
echo "Логи: docker compose logs -f rails telegram-bridge portal"
exit 1
