#!/usr/bin/env bash
# Deploy Chatwoot + telegram-bridge (Linux/macOS, Docker Compose v2)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Копирую .env.example -> .env (отредактируйте секреты при необходимости)"
  cp "$ROOT/.env.example" "$ROOT/.env"
fi

echo "Проверка доступа к Docker Hub (docker pull alpine)..."
if ! docker pull alpine:3.20; then
  echo ""
  echo "=== ОШИБКА: образы не скачиваются ==="
  echo "Проверьте сеть, прокси и доступ к Docker Hub."
  exit 1
fi

echo "docker compose pull..."
docker compose pull

echo "db:chatwoot_prepare..."
docker compose run --rm rails bundle exec rails db:chatwoot_prepare

echo "build & up..."
docker compose up -d --build

echo ""
echo "Готово. Chatwoot: http://127.0.0.1:3000  Мост: http://127.0.0.1:4000/health  Портал: http://127.0.0.1:18080"
echo ""
echo "Первый ответ Chatwoot может занять 1–3 минуты после старта контейнеров."
echo "Проверка URL: ./scripts/demo-smoke.sh"
echo "Проверка .env: node scripts/validate-env.mjs  (с токеном API: --bridge или --demo)"
echo "Сценарий: docs/DEMO.md  Полный сценарий с Telegram: docs/QUICKSTART.md"
echo "Демо-бот: docker compose --profile demo up -d --build"
echo ""
docker compose ps
